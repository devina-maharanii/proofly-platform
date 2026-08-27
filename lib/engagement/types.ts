/** Phase 33 domain vocabulary: private, evidence-led engagement records with immutable accepted terms and no client-controlled funding authority. */

export const engagementTypes = [
  "paid_trial",
  "milestone_contract",
  "ongoing_contract",
] as const;
export type EngagementType = (typeof engagementTypes)[number];

export const engagementStates = [
  "draft",
  "proposed",
  "negotiating",
  "accepted",
  "funding_required",
  "funded",
  "in_progress",
  "submitted",
  "changes_requested",
  "accepted_for_payment",
  "completed",
  "declined",
  "expired",
  "cancelled_before_start",
  "terminated",
  "disputed",
  "resolved",
  "refunded",
] as const;
export type EngagementState = (typeof engagementStates)[number];

export type EngagementActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  engagementId?: string;
}>;

export const initialEngagementActionState: EngagementActionState = {
  status: "idle",
  message: "",
};

export type EngagementMarketOption = Readonly<{
  marketCode: string;
  currency: string;
  state: "approved" | "limited";
  limitationNotice: string;
  supportRoute: string;
  termsVersionLabel: string;
}>;

export type EngagementMilestone = Readonly<{
  id: string;
  index: number;
  title: string;
  description: string;
  deliverableType: string;
  definitionOfDone: string;
  dueDate: string;
  amountMinor: number;
  currency: string;
  revisionAllowance: number;
  state: string;
  timeoutPolicy: string;
  evidencePolicy: string;
  submissionCount: number;
}>;

export type EngagementTerms = Readonly<{
  id: string;
  version: number;
  state: string;
  acceptedAt: string | null;
  snapshot: Record<string, unknown>;
}>;

export type EngagementDetail = Readonly<{
  id: string;
  engagementType: EngagementType;
  state: EngagementState;
  fundingState: string;
  marketCode: string;
  currency: string;
  projectId: string;
  applicationId: string;
  workspaceId: string | null;
  parentEngagementId: string | null;
  projectTitle: string;
  organizationName: string;
  participantRole: "talent" | "company";
  proposalExpiresAt: string | null;
  terms: EngagementTerms | null;
  termsHistory: EngagementTerms[];
  acceptances: Array<{
    termsVersionId: string;
    participantRole: "talent" | "company";
    isCurrentActor: boolean;
    acceptedAt: string | null;
  }>;
  negotiation: Array<{
    id: string;
    entryType: string;
    body: string;
    isCurrentActor: boolean;
    createdAt: string | null;
  }>;
  milestones: EngagementMilestone[];
  accessGrants: Array<{
    id: string;
    accessKind: string;
    resourceLabel: string;
    purpose: string;
    state: string;
    expiresAt: string | null;
    isCurrentActorRequest: boolean;
  }>;
  disputes: Array<{
    id: string;
    milestoneId: string | null;
    category: string;
    reason: string;
    requestedRemedy: string;
    state: string;
    openedAt: string | null;
  }>;
  events: Array<{
    eventType: string;
    previousState: string | null;
    nextState: string | null;
    occurredAt: string | null;
  }>;
  safety: Readonly<{
    platformRecordNotLegalDetermination: boolean;
    paymentExecution: string;
    productionAccess: string;
    personalCredentials: string;
    supportRoute: string;
  }>;
}>;

export type EngagementListItem = Readonly<{
  id: string;
  applicationId: string | null;
  engagementType: EngagementType;
  state: EngagementState;
  fundingState: string;
  projectTitle: string;
  organizationName: string;
  updatedAt: string | null;
}>;

export type EngagementDisputeQueueItem = Readonly<{
  id: string;
  engagementId: string;
  milestoneId: string | null;
  category: string;
  reason: string;
  requestedRemedy: string;
  state: string;
  openedAt: string | null;
}>;

export const engagementPath = (engagementId: string) =>
  `/engagements/${engagementId}`;

export const engagementTypeLabel = (type: EngagementType) =>
  ({
    paid_trial: "Paid trial",
    milestone_contract: "Milestone contract",
    ongoing_contract: "Ongoing contract",
  })[type];

export const engagementStateLabel = (state: EngagementState) =>
  state.replaceAll("_", " ");
