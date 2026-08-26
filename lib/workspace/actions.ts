"use server";

/** Phase 26 command boundary: verified participants use bounded RPCs for task, private artifact, and versioned submission work; the database derives active context, ownership, state, visibility, and audit truth. */
import { createHash, randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import {
  maxPrivateFileBytes,
  privateStorageBucket,
} from "@/lib/security/file-access";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  initialWorkspaceActionState,
  workspacePath,
  workspaceStateLabel,
  workspaceStates,
  type WorkspaceActionState,
  type WorkspaceState,
} from "./types";
import {
  parseWorkspaceSubmissionForm,
  parseWorkspaceTaskForm,
  parseWorkspaceTaskTransitionForm,
} from "./validation";

const failure = (message: string): WorkspaceActionState => ({
  status: "error",
  message,
});

async function requestAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

export async function transitionProjectWorkspaceAction(
  _previousState: WorkspaceActionState = initialWorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  void _previousState;
  const workspaceId = formData.get("workspaceId");
  const requestedState = formData.get("requestedState");
  if (
    typeof workspaceId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(workspaceId) ||
    typeof requestedState !== "string" ||
    !workspaceStates.includes(requestedState as WorkspaceState)
  ) {
    return failure("Choose a valid workspace state.");
  }

  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "company_member" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) {
    return failure("Your session has expired. Sign in again to continue.");
  }
  if (!authorization.ok) {
    return failure(
      "Switch to the authorized company context before changing this private workspace state."
    );
  }
  const limit = securityRateLimiter.check(
    "mutation",
    session.userId,
    await requestAddress()
  );
  if (!limit.ok) {
    return failure(
      `Too many workspace changes. Try again in about ${limit.retryAfterSeconds} seconds.`
    );
  }

  const { data, error } = await supabase.rpc("transition_project_workspace", {
    requested_workspace_id: workspaceId,
    requested_state: requestedState as WorkspaceState,
  });
  if (error || !data || typeof data !== "object") {
    return failure(
      "This workspace state could not be changed safely. Check the active company context and the allowed next state."
    );
  }
  revalidatePath(workspacePath(workspaceId));
  return {
    status: "success",
    message: `Workspace state recorded as ${workspaceStateLabel(
      requestedState as WorkspaceState
    )}.`,
  };
}

async function participantCommand() {
  const [session, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) {
    return {
      ok: false as const,
      state: failure("Your session has expired. Sign in again to continue."),
    };
  }
  const limit = securityRateLimiter.check(
    "mutation",
    session.userId,
    await requestAddress()
  );
  if (!limit.ok) {
    return {
      ok: false as const,
      state: failure(
        `Too many private workspace changes. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  }
  return { ok: true as const, session, supabase };
}

const refreshWorkspace = (workspaceId: string) => {
  revalidatePath(workspacePath(workspaceId));
  revalidatePath("/workspaces/[workspaceId]/tasks/[taskId]", "page");
};

export async function createProjectWorkspaceTaskAction(
  _previousState: WorkspaceActionState = initialWorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  void _previousState;
  const parsed = parseWorkspaceTaskForm(formData);
  if (!parsed.success) {
    return failure("Provide a concise task title and check the task fields.");
  }
  const command = await participantCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "create_project_workspace_task",
    {
      requested_workspace_id: parsed.data.workspaceId,
      requested_title: parsed.data.title,
      requested_description: parsed.data.description,
      requested_priority: parsed.data.priority,
      requested_due_date: parsed.data.dueDate || null,
      requested_acceptance_criteria: parsed.data.acceptanceCriteria,
      requested_dependency_task_ids: [],
    }
  );
  if (error) {
    return failure(
      "This task could not be created safely. Check the active company context and private workspace state."
    );
  }
  refreshWorkspace(parsed.data.workspaceId);
  return {
    status: "success",
    message: "Task created in the private workspace.",
  };
}

export async function transitionProjectWorkspaceTaskAction(
  _previousState: WorkspaceActionState = initialWorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  void _previousState;
  const parsed = parseWorkspaceTaskTransitionForm(formData);
  const workspaceId = formData.get("workspaceId");
  if (
    !parsed.success ||
    typeof workspaceId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(workspaceId)
  ) {
    return failure("Choose a valid task state.");
  }
  const command = await participantCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "transition_project_workspace_task",
    {
      requested_task_id: parsed.data.taskId,
      requested_state: parsed.data.state,
    }
  );
  if (error) {
    return failure(
      "This task state cannot be changed in the current private workspace context."
    );
  }
  refreshWorkspace(workspaceId);
  return {
    status: "success",
    message: "Task state recorded in the private activity history.",
  };
}

const detectedContentType = (bytes: Uint8Array): string | null => {
  const textPrefix = new TextDecoder().decode(
    bytes.subarray(0, Math.min(bytes.length, 512))
  );
  if (
    bytes.length >= 5 &&
    String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-"
  ) {
    return "application/pdf";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    String.fromCharCode(...bytes.subarray(0, 8)) === "\x89PNG\r\n\x1a\n"
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return !textPrefix.includes("\u0000") ? "text/plain" : null;
};

const extensionFor = (contentType: string) =>
  (
    ({
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "text/plain": "txt",
    }) as const
  )[contentType as "application/pdf"] ?? "bin";

export async function uploadProjectWorkspaceFileAction(
  _previousState: WorkspaceActionState = initialWorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  void _previousState;
  const workspaceId = formData.get("workspaceId");
  const displayName = formData.get("displayName");
  const description = formData.get("description");
  const upload = formData.get("file");
  if (
    typeof workspaceId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(workspaceId) ||
    typeof displayName !== "string" ||
    displayName.trim().length < 1 ||
    displayName.trim().length > 180 ||
    typeof description !== "string" ||
    description.length > 600 ||
    !(upload instanceof File) ||
    upload.size < 1 ||
    upload.size > maxPrivateFileBytes
  ) {
    return failure(
      "Choose one permitted file under 10 MB and give it a concise display name."
    );
  }
  const command = await participantCommand();
  if (!command.ok) return command.state;
  const bytes = new Uint8Array(await upload.arrayBuffer());
  const contentType = detectedContentType(bytes);
  if (!contentType) {
    return failure(
      "This file type is not permitted. Upload a PDF, JPEG, PNG, WebP, or plain-text file."
    );
  }
  const originalFilename =
    upload.name.replace(/[\\/\u0000]/g, "_").slice(0, 255) ||
    `artifact.${extensionFor(contentType)}`;
  const objectKey = `${command.session.userId}/workspaces/${workspaceId}/${randomUUID()}.${extensionFor(contentType)}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { data: prepared, error: prepareError } = await command.supabase.rpc(
    "prepare_project_workspace_file_upload",
    {
      requested_workspace_id: workspaceId,
      requested_file_id: null,
      requested_task_id: null,
      requested_display_name: displayName.trim(),
      requested_description: description.trim(),
      requested_original_filename: originalFilename,
      requested_content_type: contentType,
      requested_size_bytes: upload.size,
      requested_sha256: sha256,
      requested_object_key: objectKey,
    }
  );
  if (prepareError || !prepared || typeof prepared !== "object") {
    return failure(
      "The private file record could not be prepared. Check workspace access and try again."
    );
  }
  const preparedRecord = prepared as { file_version_id?: unknown };
  const { error: storageError } = await command.supabase.storage
    .from(privateStorageBucket)
    .upload(objectKey, bytes, { contentType, upsert: false });
  if (storageError || typeof preparedRecord.file_version_id !== "string") {
    if (typeof preparedRecord.file_version_id === "string") {
      await command.supabase.rpc("reject_project_workspace_file_upload", {
        requested_file_version_id: preparedRecord.file_version_id,
      });
    }
    return failure(
      "The private upload failed safely. Your source file was not attached to a submission; retry with the same permitted artifact."
    );
  }
  const { error: completeError } = await command.supabase.rpc(
    "complete_project_workspace_file_upload",
    { requested_file_version_id: preparedRecord.file_version_id }
  );
  if (completeError) {
    return failure(
      "The file was uploaded but is not available until its private validation completes. Retry later or contact support."
    );
  }
  refreshWorkspace(workspaceId);
  return {
    status: "success",
    message: "Private file uploaded and recorded as a new immutable version.",
  };
}

export async function saveProjectWorkspaceSubmissionAction(
  _previousState: WorkspaceActionState = initialWorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  void _previousState;
  const parsed = parseWorkspaceSubmissionForm(formData);
  if (!parsed.success) {
    return failure(
      "Check the bounded submission fields and selected private files before saving this draft."
    );
  }
  const command = await participantCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "save_project_workspace_submission_draft",
    {
      requested_workspace_id: parsed.data.workspaceId,
      requested_task_id: parsed.data.taskId || null,
      requested_summary: parsed.data.summary,
      requested_problem_interpretation: parsed.data.problemInterpretation,
      requested_approach_and_decisions: parsed.data.approachAndDecisions,
      requested_deliverables: parsed.data.deliverables,
      requested_demo_or_repository_link:
        parsed.data.demoOrRepositoryLink || null,
      requested_known_limitations: parsed.data.knownLimitations,
      requested_completion_context: parsed.data.completionContext,
      requested_ownership_confirmed: parsed.data.ownershipConfirmed,
      requested_attribution_confirmed: parsed.data.attributionConfirmed,
      requested_file_version_ids: parsed.data.fileVersionIds,
    }
  );
  if (error) {
    return failure(
      "This private submission draft could not be saved. Check the workspace state, selected clean files, and your Talent context."
    );
  }
  refreshWorkspace(parsed.data.workspaceId);
  return {
    status: "success",
    message: "Private submission draft saved. It has not been sent for review.",
  };
}

export async function submitProjectWorkspaceSubmissionAction(
  _previousState: WorkspaceActionState = initialWorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  void _previousState;
  const submissionId = formData.get("submissionId");
  const workspaceId = formData.get("workspaceId");
  if (
    typeof submissionId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(submissionId) ||
    typeof workspaceId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(workspaceId)
  ) {
    return failure(
      "Save a valid private submission draft before submitting it."
    );
  }
  const command = await participantCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "submit_project_workspace_submission",
    {
      requested_submission_id: submissionId,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error) {
    return failure(
      "Complete every required field, confirm ownership and attribution, and include at least one clean private file before submitting."
    );
  }
  refreshWorkspace(workspaceId);
  return {
    status: "success",
    message:
      "Submission recorded. It is ready for the later human review workflow; no review decision or proof is created yet.",
  };
}

export async function updateProjectWorkspaceTaskAction(
  _previousState: WorkspaceActionState = initialWorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  void _previousState;
  const parsed = parseWorkspaceTaskForm(formData);
  const taskId = formData.get("taskId");
  const assignedUserId = formData.get("assignedUserId");
  if (
    !parsed.success ||
    typeof taskId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(taskId) ||
    (typeof assignedUserId === "string" &&
      assignedUserId &&
      !/^[0-9a-f-]{36}$/i.test(assignedUserId))
  ) {
    return failure("Check the permitted task fields before saving changes.");
  }
  const command = await participantCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "update_project_workspace_task",
    {
      requested_task_id: taskId,
      requested_title: parsed.data.title,
      requested_description: parsed.data.description,
      requested_priority: parsed.data.priority,
      requested_due_date: parsed.data.dueDate || null,
      requested_acceptance_criteria: parsed.data.acceptanceCriteria,
      requested_assigned_user_id:
        typeof assignedUserId === "string" && assignedUserId
          ? assignedUserId
          : null,
      requested_dependency_task_ids: [],
    }
  );
  if (error) {
    return failure(
      "This task could not be updated safely. Check the active company context and the permitted task state."
    );
  }
  refreshWorkspace(parsed.data.workspaceId);
  return {
    status: "success",
    message: "Task details recorded in the private activity history.",
  };
}

export async function assignProjectWorkspaceTaskAction(
  _previousState: WorkspaceActionState = initialWorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  void _previousState;
  const taskId = formData.get("taskId");
  const workspaceId = formData.get("workspaceId");
  if (
    typeof taskId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(taskId) ||
    typeof workspaceId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(workspaceId)
  ) {
    return failure("This private task is unavailable.");
  }
  const command = await participantCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "assign_project_workspace_task_to_active_talent",
    { requested_task_id: taskId }
  );
  if (error) {
    return failure(
      "This task cannot be assigned in the current workspace state or active company context."
    );
  }
  refreshWorkspace(workspaceId);
  return {
    status: "success",
    message: "Task assigned to the accepted active Talent participant.",
  };
}
