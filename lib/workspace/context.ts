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
  ["not_started", "in_progress", "blocked", "completed"].includes(text(value))
    ? (value as WorkspaceTaskState)
    : "not_started";

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
  return error ? null : workspace(data);
}
