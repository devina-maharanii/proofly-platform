/** Phase 26 contract: Workspaces keep participant-scoped tasks, private artifact versions, and versioned submission packages; reviewer decisions, payments, messaging, execution, and AI remain absent. */

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
  | "backlog"
  | "ready"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "done"
  | "cancelled";

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

export type WorkspaceTaskDetail = WorkspaceTask &
  Readonly<{
    workspaceId: string;
    priority: "low" | "normal" | "high";
    dueDate: string | null;
    acceptanceCriteria: string;
    dependencyTaskIds: string[];
    canEdit: boolean;
    canTransition: boolean;
  }>;

export type WorkspaceFileVersion = Readonly<{
  id: string;
  versionNumber: number;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  scanState: "pending" | "clean" | "rejected";
  accessScope: "participants" | "review_material";
  createdAt: string | null;
  canDownload: boolean;
}>;

export type WorkspaceFile = Readonly<{
  id: string;
  taskId: string | null;
  displayName: string;
  description: string;
  lifecycleState: "active" | "archived";
  isOwnedByCurrentActor: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  versions: WorkspaceFileVersion[];
}>;

export type WorkspaceSubmissionVersion = Readonly<{
  id: string;
  versionNumber: number;
  summary: string;
  problemInterpretation: string;
  approachAndDecisions: string;
  deliverables: string;
  demoOrRepositoryLink: string | null;
  knownLimitations: string;
  completionContext: string;
  ownershipConfirmed: boolean;
  attributionConfirmed: boolean;
  createdAt: string | null;
  files: ReadonlyArray<
    Readonly<{
      id: string;
      fileId: string;
      displayName: string;
      versionNumber: number;
      originalFilename: string;
      contentType: string;
      sizeBytes: number;
      scanState: "pending" | "clean" | "rejected";
      canDownload: boolean;
    }>
  >;
}>;

export type WorkspaceSubmission = Readonly<{
  id: string;
  workspaceId: string;
  taskId: string | null;
  state:
    | "draft"
    | "submitted"
    | "under_review"
    | "changes_requested"
    | "resubmitted"
    | "accepted"
    | "rejected";
  currentVersionNumber: number;
  canEdit: boolean;
  versions: WorkspaceSubmissionVersion[];
}>;

export type LockedWorkspaceRubricDimension = Readonly<{
  id: string;
  position: number;
  name: string;
  description: string;
  skillKeys: readonly string[];
  weight: number;
  priority: "essential" | "important" | "supporting";
  observableCriteria: readonly string[];
  evidenceExamples: readonly string[];
  commonFailureModes: readonly string[];
  reviewerGuidance: string | null;
  feedbackVisibility:
    "talent_and_company" | "company_only" | "reviewer_private";
  descriptors: readonly Readonly<{
    level: string;
    description: string;
  }>[];
}>;

export type LockedWorkspaceRubric = Readonly<{
  rubricVersionId: string;
  versionNumber: number;
  lockedAt: string | null;
  dimensions: readonly LockedWorkspaceRubricDimension[];
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
    lockedRubric: LockedWorkspaceRubric | null;
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
      backlog: "Backlog",
      ready: "Ready",
      in_progress: "In progress",
      blocked: "Blocked",
      in_review: "In review",
      done: "Done",
      cancelled: "Cancelled",
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
