/** Phase 25 server reader: workspace visibility derives solely from an authenticated active context and database participant/organization policy. */
import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import type {
  ProjectWorkspace,
  WorkspaceAccessRole,
  WorkspaceActivity,
  WorkspaceMemberStatus,
  WorkspaceParticipant,
  WorkspaceProjectContext,
  WorkspaceState,
  WorkspaceTask,
  WorkspaceTaskState,
  WorkspaceFile,
  WorkspaceFileVersion,
  WorkspaceSubmission,
  WorkspaceSubmissionVersion,
  WorkspaceTaskDetail,
} from "./types";

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const knownState = (value: unknown): WorkspaceState =>
  [
    "preparing",
    "active",
    "paused",
    "awaiting_submission",
    "under_review",
    "completed",
    "closed",
  ].includes(text(value))
    ? (value as WorkspaceState)
    : "preparing";

const knownRole = (value: unknown): WorkspaceAccessRole | null =>
  ["talent_participant", "company_participant", "reviewer"].includes(
    text(value)
  )
    ? (value as WorkspaceAccessRole)
    : null;

const knownMemberStatus = (value: unknown): WorkspaceMemberStatus =>
  value === "removed" ? "removed" : "active";

const knownTaskState = (value: unknown): WorkspaceTaskState =>
  [
    "backlog",
    "ready",
    "in_progress",
    "blocked",
    "in_review",
    "done",
    "cancelled",
  ].includes(text(value))
    ? (value as WorkspaceTaskState)
    : "backlog";

const stringOrNull = (value: unknown) =>
  typeof value === "string" ? value : null;

function milestones(value: unknown): WorkspaceProjectContext["milestones"] {
  return Array.isArray(value)
    ? value.flatMap(item => {
        const itemRecord = record(item);
        const name = text(itemRecord?.name).slice(0, 100);
        return name
          ? [{ name, description: text(itemRecord?.description).slice(0, 480) }]
          : [];
      })
    : [];
}

function evaluationDimensions(
  value: unknown
): WorkspaceProjectContext["evaluationDimensions"] {
  return Array.isArray(value)
    ? value.flatMap(item => {
        const itemRecord = record(item);
        const criterion = text(itemRecord?.criterion).slice(0, 280);
        const priority = itemRecord?.priority;
        return criterion && typeof priority === "number"
          ? [{ criterion, priority }]
          : [];
      })
    : [];
}

function projectContext(value: unknown): WorkspaceProjectContext | null {
  const row = record(value);
  const title = text(row?.title);
  if (!row || !title) return null;
  return {
    publicId: text(row.public_id),
    title,
    oneSentenceGoal: text(row.one_sentence_goal),
    contextAndProblem: text(row.context_and_problem),
    whyItMatters: text(row.why_it_matters),
    expectedRole: text(row.expected_role),
    requiredOutput: text(row.required_output),
    acceptanceCriteria: text(row.acceptance_criteria),
    submissionFormat: text(row.submission_format),
    timeboxHours:
      typeof row.timebox_hours === "number" ? row.timebox_hours : null,
    milestones: milestones(row.milestones),
    outOfScope: text(row.out_of_scope),
    evaluationDimensions: evaluationDimensions(row.evaluation_dimensions),
    reviewMethod: text(row.review_method),
    reviewerExpectations: text(row.reviewer_expectations),
    revisionPolicy: text(row.revision_policy),
    decisionTimeline: text(row.decision_timeline),
    applicationDeadline: text(row.application_deadline),
    participantExpectations: text(row.participant_expectations),
    dataAccessRestrictions: text(row.data_access_restrictions),
    ownershipTerms: text(row.ownership_terms),
  };
}

const participants = (value: unknown): WorkspaceParticipant[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        const row = record(item);
        const role = knownRole(row?.role);
        return role
          ? [
              {
                role,
                status: knownMemberStatus(row?.status),
                isCurrentActor: row?.is_current_actor === true,
              },
            ]
          : [];
      })
    : [];

const tasks = (value: unknown): WorkspaceTask[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        const row = record(item);
        const id = text(row?.id);
        const title = text(row?.title);
        return id && title
          ? [
              {
                id,
                title,
                description: text(row?.description),
                state: knownTaskState(row?.state),
                isAssignedToCurrentActor:
                  row?.is_assigned_to_current_actor === true,
              },
            ]
          : [];
      })
    : [];

const activity = (value: unknown): WorkspaceActivity[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        const row = record(item);
        const eventType = text(row?.event_type);
        return eventType
          ? [
              {
                eventType,
                previousState: row?.previous_state
                  ? knownState(row.previous_state)
                  : null,
                nextState: row?.next_state ? knownState(row.next_state) : null,
                occurredAt: stringOrNull(row?.occurred_at),
              },
            ]
          : [];
      })
    : [];

function workspace(value: unknown): ProjectWorkspace | null {
  const row = record(value);
  const project = projectContext(row?.project);
  const id = text(row?.id);
  const accessRole = knownRole(row?.access_role);
  const permissions = record(row?.permissions);
  const reviewContext = record(row?.review_context);
  if (
    !row ||
    !id ||
    !project ||
    !accessRole ||
    !permissions ||
    !reviewContext
  ) {
    return null;
  }
  return {
    id,
    state: knownState(row.state),
    accessRole,
    deadlineTimezone: text(row.deadline_timezone, "UTC"),
    createdAt: stringOrNull(row.created_at),
    updatedAt: stringOrNull(row.updated_at),
    project,
    participants: participants(row.participants),
    tasks: tasks(row.tasks),
    reviewContext: {
      evaluationDimensions: evaluationDimensions(
        reviewContext.evaluation_dimensions
      ),
      submissionFormat: text(reviewContext.submission_format),
      revisionPolicy: text(reviewContext.revision_policy),
      reviewMethod: text(reviewContext.review_method),
      reviewerExpectations: text(reviewContext.reviewer_expectations),
      reviewState: text(reviewContext.review_state),
    },
    activity: activity(row.activity),
    permissions: {
      canChangeState: permissions.can_change_state === true,
      canManageTasks: permissions.can_manage_tasks === true,
      canUploadFiles: permissions.can_upload_files === true,
      canCreateSubmission: permissions.can_create_submission === true,
      reviewMaterialAssigned: permissions.review_material_assigned === true,
    },
  };
}

export async function getProjectWorkspace(
  workspaceId: string
): Promise<ProjectWorkspace | null> {
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_project_workspace", {
    requested_workspace_id: workspaceId,
  });
  const parsed = error ? null : workspace(data);
  if (!parsed) return null;
  const { data: capabilityData, error: capabilityError } = await supabase.rpc(
    "get_project_workspace_capabilities",
    { requested_workspace_id: workspaceId }
  );
  const capabilities = capabilityError ? null : record(capabilityData);
  if (!capabilities) return null;
  return {
    ...parsed,
    permissions: {
      canChangeState: capabilities.can_change_state === true,
      canManageTasks: capabilities.can_manage_tasks === true,
      canUploadFiles: capabilities.can_upload_files === true,
      canCreateSubmission: capabilities.can_create_submission === true,
      reviewMaterialAssigned: capabilities.review_material_assigned === true,
    },
  };
}

const number = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const knownScanState = (value: unknown): WorkspaceFileVersion["scanState"] =>
  ["pending", "clean", "rejected"].includes(text(value))
    ? (value as WorkspaceFileVersion["scanState"])
    : "pending";

const workspaceFiles = (value: unknown): WorkspaceFile[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        const row = record(item);
        const id = text(row?.id);
        const displayName = text(row?.display_name);
        if (!id || !displayName) return [];
        const versions = Array.isArray(row?.versions)
          ? row.versions.flatMap(version => {
              const versionRow = record(version);
              const versionId = text(versionRow?.id);
              return versionId
                ? [
                    {
                      id: versionId,
                      versionNumber: number(versionRow?.version_number, 1),
                      originalFilename: text(versionRow?.original_filename),
                      contentType: text(versionRow?.content_type),
                      sizeBytes: number(versionRow?.size_bytes),
                      scanState: knownScanState(versionRow?.scan_state),
                      accessScope:
                        versionRow?.access_scope === "review_material"
                          ? ("review_material" as const)
                          : ("participants" as const),
                      createdAt: stringOrNull(versionRow?.created_at),
                      canDownload: versionRow?.can_download === true,
                    },
                  ]
                : [];
            })
          : [];
        return [
          {
            id,
            taskId: stringOrNull(row?.task_id),
            displayName,
            description: text(row?.description),
            lifecycleState:
              row?.lifecycle_state === "archived" ? "archived" : "active",
            isOwnedByCurrentActor: row?.is_owned_by_current_actor === true,
            createdAt: stringOrNull(row?.created_at),
            updatedAt: stringOrNull(row?.updated_at),
            versions,
          },
        ];
      })
    : [];

const submission = (value: unknown): WorkspaceSubmission | null => {
  const row = record(value);
  const id = text(row?.id);
  const workspaceId = text(row?.workspace_id);
  const states = [
    "draft",
    "submitted",
    "under_review",
    "changes_requested",
    "resubmitted",
    "accepted",
    "rejected",
  ] as const;
  const state = states.includes(text(row?.state) as (typeof states)[number])
    ? (text(row?.state) as (typeof states)[number])
    : null;
  if (!row || !id || !workspaceId || !state) return null;
  const versions: WorkspaceSubmissionVersion[] = Array.isArray(row.versions)
    ? row.versions.flatMap(item => {
        const version = record(item);
        const versionId = text(version?.id);
        if (!versionId) return [];
        const files = Array.isArray(version?.files)
          ? version.files.flatMap(file => {
              const fileRow = record(file);
              const fileId = text(fileRow?.id);
              const parentId = text(fileRow?.file_id);
              return fileId && parentId
                ? [
                    {
                      id: fileId,
                      fileId: parentId,
                      displayName: text(fileRow?.display_name),
                      versionNumber: number(fileRow?.version_number, 1),
                      originalFilename: text(fileRow?.original_filename),
                      contentType: text(fileRow?.content_type),
                      sizeBytes: number(fileRow?.size_bytes),
                      scanState: knownScanState(fileRow?.scan_state),
                      canDownload: fileRow?.can_download === true,
                    },
                  ]
                : [];
            })
          : [];
        return [
          {
            id: versionId,
            versionNumber: number(version?.version_number, 1),
            summary: text(version?.summary),
            problemInterpretation: text(version?.problem_interpretation),
            approachAndDecisions: text(version?.approach_and_decisions),
            deliverables: text(version?.deliverables),
            demoOrRepositoryLink: stringOrNull(
              version?.demo_or_repository_link
            ),
            knownLimitations: text(version?.known_limitations),
            completionContext: text(version?.completion_context),
            ownershipConfirmed: version?.ownership_confirmed === true,
            attributionConfirmed: version?.attribution_confirmed === true,
            createdAt: stringOrNull(version?.created_at),
            files,
          },
        ];
      })
    : [];
  return {
    id,
    workspaceId,
    taskId: stringOrNull(row.task_id),
    state,
    currentVersionNumber: number(row.current_version_number, 1),
    canEdit: row.can_edit === true,
    versions,
  };
};

export async function getWorkspaceFiles(
  workspaceId: string
): Promise<WorkspaceFile[]> {
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return [];
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_project_workspace_files", {
    requested_workspace_id: workspaceId,
  });
  return error ? [] : workspaceFiles(data);
}

export async function getWorkspaceSubmission(
  workspaceId: string
): Promise<WorkspaceSubmission | null> {
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(
    "get_project_workspace_submission",
    { requested_workspace_id: workspaceId }
  );
  return error ? null : submission(data);
}

export async function getWorkspaceTask(
  taskId: string
): Promise<WorkspaceTaskDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) return null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_project_workspace_task", {
    requested_task_id: taskId,
  });
  const row = error ? null : record(data);
  const id = text(row?.id);
  if (!row || !id) return null;
  return {
    id,
    workspaceId: text(row.workspace_id),
    title: text(row.title),
    description: text(row.description),
    state: knownTaskState(row.state),
    priority:
      row.priority === "low" || row.priority === "high"
        ? row.priority
        : "normal",
    dueDate: stringOrNull(row.due_date),
    acceptanceCriteria: text(row.acceptance_criteria),
    dependencyTaskIds: Array.isArray(row.dependency_task_ids)
      ? row.dependency_task_ids.filter(
          (value): value is string => typeof value === "string"
        )
      : [],
    isAssignedToCurrentActor: row.is_assigned_to_current_actor === true,
    canEdit: row.can_edit === true,
    canTransition: row.can_transition === true,
  };
}
