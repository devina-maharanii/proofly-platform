/** Phase 25 contract: Workspaces are private project execution shells; presentation never creates a submission, review, payment, file, or AI decision. */

export const workspaceStates = [
  "preparing",
  "active",
  "paused",
  "awaiting_submission",
  "under_review",
  "completed",
  "closed",
] as const;

export type WorkspaceState = (typeof workspaceStates)[number];
export type WorkspaceAccessRole =
  "talent_participant" | "company_participant" | "reviewer";
export type WorkspaceMemberStatus = "active" | "removed";
export type WorkspaceTaskState =
  "not_started" | "in_progress" | "blocked" | "completed";

export type WorkspaceProjectContext = Readonly<{
  publicId: string;
  title: string;
  oneSentenceGoal: string;
  contextAndProblem: string;
  whyItMatters: string;
  expectedRole: string;
  requiredOutput: string;
  acceptanceCriteria: string;
  submissionFormat: string;
  timeboxHours: number | null;
  milestones: ReadonlyArray<Readonly<{ name: string; description: string }>>;
  outOfScope: string;
  evaluationDimensions: ReadonlyArray<
    Readonly<{ criterion: string; priority: number }>
  >;
  reviewMethod: string;
  reviewerExpectations: string;
  revisionPolicy: string;
  decisionTimeline: string;
  applicationDeadline: string;
  participantExpectations: string;
  dataAccessRestrictions: string;
  ownershipTerms: string;
}>;

export type WorkspaceParticipant = Readonly<{
  role: WorkspaceAccessRole;
  status: WorkspaceMemberStatus;
  isCurrentActor: boolean;
}>;

export type WorkspaceTask = Readonly<{
  id: string;
  title: string;
  description: string;
  state: WorkspaceTaskState;
  isAssignedToCurrentActor: boolean;
}>;

export type WorkspaceActivity = Readonly<{
  eventType: string;
  previousState: WorkspaceState | null;
  nextState: WorkspaceState | null;
  occurredAt: string | null;
}>;

export type ProjectWorkspace = Readonly<{
  id: string;
  state: WorkspaceState;
  accessRole: WorkspaceAccessRole;
  deadlineTimezone: string;
  createdAt: string | null;
  updatedAt: string | null;
  project: WorkspaceProjectContext;
  participants: WorkspaceParticipant[];
  tasks: WorkspaceTask[];
  reviewContext: Readonly<{
    evaluationDimensions: WorkspaceProjectContext["evaluationDimensions"];
    submissionFormat: string;
    revisionPolicy: string;
    reviewMethod: string;
    reviewerExpectations: string;
    reviewState: string;
  }>;
  activity: WorkspaceActivity[];
  permissions: Readonly<{
    canChangeState: boolean;
    canManageTasks: boolean;
    canUploadFiles: boolean;
    canCreateSubmission: boolean;
    reviewMaterialAssigned: boolean;
  }>;
}>;

export type WorkspaceActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
}>;

export const initialWorkspaceActionState: WorkspaceActionState = {
  status: "idle",
  message: "",
};

export const workspaceStateLabel = (state: WorkspaceState) =>
  (
    ({
      preparing: "Preparing",
      active: "Active",
      paused: "Paused",
      awaiting_submission: "Awaiting submission",
      under_review: "Under review",
      completed: "Completed",
      closed: "Closed",
    }) as const
  )[state];

export const workspaceRoleLabel = (role: WorkspaceAccessRole) =>
  (
    ({
      talent_participant: "Talent participant",
      company_participant: "Company participant",
      reviewer: "Reviewer",
    }) as const
  )[role];

export const workspaceTaskStateLabel = (state: WorkspaceTaskState) =>
  (
    ({
      not_started: "Not started",
      in_progress: "In progress",
      blocked: "Blocked",
      completed: "Completed",
    }) as const
  )[state];

export const workspacePath = (workspaceId: string) =>
  `/workspaces/${workspaceId}` as const;

export const workspaceTransitions: Readonly<
  Record<WorkspaceState, readonly WorkspaceState[]>
> = {
  preparing: ["active", "paused", "closed"],
  active: ["paused", "awaiting_submission", "closed"],
  paused: ["active", "closed"],
  awaiting_submission: ["active", "under_review", "closed"],
  under_review: ["active", "completed", "closed"],
  completed: ["closed"],
  closed: [],
};
