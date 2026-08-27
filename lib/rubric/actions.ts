"use server";

/** Design: Evidence Ledger Editorial — authoring controls expose one clear action, but authorization and historical immutability remain database-owned. */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  initialRubricActionState,
  type RubricActionState,
  type RubricState,
} from "./types";
import {
  parseRubricForm,
  rubricFieldErrors,
  rubricPayload,
} from "./validation";

function failure(
  message: string,
  fieldErrors?: Record<string, string>
): RubricActionState {
  return { status: "error", message, fieldErrors };
}

async function requestAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

async function rubricAuthorCommand() {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "company_member" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) {
    return {
      ok: false as const,
      state: failure("Your session has expired. Sign in again to continue."),
    };
  }
  if (!authorization.ok || !authorization.context.active?.organizationId) {
    return {
      ok: false as const,
      state: failure(
        "Switch to the authorized company context before authoring a rubric."
      ),
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
        `Too many rubric changes. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  }
  return { ok: true as const, supabase };
}

function projectRubricPath(projectId: string) {
  return `/company/projects/${encodeURIComponent(projectId)}/rubric`;
}

function refreshRubric(projectId: string) {
  revalidatePath(projectRubricPath(projectId));
  revalidatePath(`/company/projects/${encodeURIComponent(projectId)}`);
  revalidatePath(`/workspaces/[workspaceId]`, "page");
}

export async function saveProjectRubricAction(
  _previousState: RubricActionState = initialRubricActionState,
  formData: FormData
): Promise<RubricActionState> {
  void _previousState;
  const projectId = formData.get("projectId");
  const rubricId = formData.get("rubricId");
  if (typeof projectId !== "string" || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return failure("This private project is unavailable for rubric authoring.");
  }
  if (typeof rubricId !== "string" && rubricId !== null) {
    return failure("This rubric reference is invalid.");
  }
  const parsed = parseRubricForm(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted rubric fields and save the private draft again.",
      rubricFieldErrors(parsed.error)
    );
  }
  const command = await rubricAuthorCommand();
  if (!command.ok) return command.state;
  const { data, error } = await command.supabase.rpc("save_project_rubric", {
    requested_project_id: projectId,
    requested_rubric_id: rubricId || null,
    requested_rubric: rubricPayload(parsed.data),
  });
  if (error || !data || typeof data !== "object") {
    return failure(
      error?.code === "42501"
        ? "Your company context does not allow this rubric change."
        : "The rubric draft could not be saved safely. Review the project context and try again."
    );
  }
  const result = data as { id?: unknown };
  refreshRubric(projectId);
  return {
    status: "success",
    message:
      "Rubric draft saved. It is private and has not been used for a review.",
    rubricId: typeof result.id === "string" ? result.id : undefined,
  };
}

export async function transitionProjectRubricAction(
  projectId: string,
  rubricId: string,
  requestedState: RubricState
): Promise<RubricActionState> {
  if (
    !/^[0-9a-f-]{36}$/i.test(projectId) ||
    !/^[0-9a-f-]{36}$/i.test(rubricId) ||
    !["draft", "ready_for_review", "published", "archived"].includes(
      requestedState
    )
  ) {
    return failure("This rubric state request is invalid.");
  }
  const command = await rubricAuthorCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("transition_project_rubric", {
    requested_project_id: projectId,
    requested_rubric_id: rubricId,
    requested_state: requestedState,
  });
  if (error) {
    return failure(
      "This rubric state could not be changed. Complete the private version and check your authoring authority."
    );
  }
  refreshRubric(projectId);
  return {
    status: "success",
    message:
      requestedState === "published"
        ? "Rubric version published. A later active review will lock this version permanently."
        : requestedState === "ready_for_review"
          ? "Rubric marked ready for an authorized human review."
          : "Rubric state updated.",
  };
}

export async function recordRubricCalibrationDisagreementAction(
  workspaceId: string,
  calibrationExampleId: string,
  viewpoint: string
): Promise<RubricActionState> {
  if (
    !/^[0-9a-f-]{36}$/i.test(workspaceId) ||
    !/^[0-9a-f-]{36}$/i.test(calibrationExampleId) ||
    viewpoint.trim().length < 12 ||
    viewpoint.trim().length > 900
  ) {
    return failure("This calibration record is invalid.");
  }
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "reviewer" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase || !authorization.ok) {
    return failure(
      "Only an active reviewer with access to this workspace can record calibration context."
    );
  }
  const limit = securityRateLimiter.check(
    "mutation",
    session.userId,
    await requestAddress()
  );
  if (!limit.ok)
    return failure(`Try again in about ${limit.retryAfterSeconds} seconds.`);
  const { error } = await supabase.rpc(
    "record_project_rubric_calibration_disagreement",
    {
      requested_workspace_id: workspaceId,
      requested_calibration_example_id: calibrationExampleId,
      requested_viewpoint: viewpoint.trim(),
    }
  );
  if (error)
    return failure(
      "The private calibration context could not be recorded safely."
    );
  revalidatePath(`/workspaces/${encodeURIComponent(workspaceId)}`);
  return {
    status: "success",
    message:
      "Private calibration context recorded for the locked rubric version.",
  };
}
