/**
 * Proofly Phase 29 verification domain: accountable human review of one exact
 * submission version against one locked rubric version. Evidence, review, and
 * public Proof remain distinct; no score or automated decision is represented.
 */
import type { CanonicalSkillKey } from "@/lib/profile/types";
import type {
  RubricDescriptorLevel,
  RubricFeedbackVisibility,
} from "@/lib/rubric/types";

export const verificationStates = [
  "not_eligible",
  "ready_for_assignment",
  "assigned",
  "under_review",
  "changes_requested",
  "resubmitted",
  "final_review",
  "verified",
  "not_verified",
  "revoked",
  "appealed",
] as const;

export type VerificationState = (typeof verificationStates)[number];

export const verificationStateLabel: Record<VerificationState, string> = {
  not_eligible: "Not eligible for verification",
  ready_for_assignment: "Ready for qualified reviewer assignment",
  assigned: "Reviewer assigned",
  under_review: "Under human review",
  changes_requested: "Changes requested",
  resubmitted: "Updated version submitted",
  final_review: "Final human review",
  verified: "Verified",
  not_verified: "Not verified",
  revoked: "Verification revoked",
  appealed: "Appeal in progress",
};

export const reviewerAttributionModes = [
  "display_name",
  "withhold_name",
] as const;
export type ReviewerAttributionMode = (typeof reviewerAttributionModes)[number];

export const proofVisibilityChoices = [
  "private",
  "talent_approved_public",
] as const;
export type ProofVisibilityChoice = (typeof proofVisibilityChoices)[number];

export const revocationReasons = [
  "fraud",
  "incorrect_attribution",
  "policy_breach",
  "material_change",
] as const;
export type RevocationReason = (typeof revocationReasons)[number];

export type VerificationObservation = Readonly<{
  id: string;
  rubricDimensionId: string;
  dimensionName: string;
  selectedDescriptorLevel: RubricDescriptorLevel;
  observation: string;
  sharedFeedback: string;
  privateNote: string;
  feedbackVisibility: RubricFeedbackVisibility;
}>;

export type VerificationAssignment = Readonly<{
  reviewerUserId: string;
  assignedAt: string | null;
  acceptedAt: string | null;
  reviewerAttributionMode: ReviewerAttributionMode;
}>;

export type VerificationDecision = Readonly<{
  decidedAt: string;
  decisionSummary: string;
  actionableNextSteps: string;
  verifiedSkillKeys: readonly CanonicalSkillKey[];
  verificationExpiresAt: string | null;
  accountableActor: "reviewer" | "administrator";
}>;

export type VerificationReview = Readonly<{
  id: string;
  reviewerUserId: string | null;
  state:
    | "assigned"
    | "under_review"
    | "changes_requested"
    | "verified"
    | "not_verified"
    | "superseded";
  isAppealReview: boolean;
  assignedAt: string | null;
  startedAt: string | null;
  decidedAt: string | null;
  reviewerAttributionMode: ReviewerAttributionMode;
  decisionSummary: string;
  actionableNextSteps: string;
  observations: readonly VerificationObservation[];
}>;

export type VerificationReviewerCandidate = Readonly<{
  userId: string;
  displayName: string;
  skillKeys: readonly CanonicalSkillKey[];
}>;

export type AdminVerificationQueueItem = Readonly<{
  id: string;
  workspaceId: string;
  state: VerificationState;
  submissionVersionId: string;
  updatedAt: string | null;
  appealState: VerificationAppeal["state"] | null;
  canRevoke: boolean;
}>;

export type TalentEvidencePublicationChoice = Readonly<{
  evidenceId: string;
  title: string;
}>;

export type VerificationAppeal = Readonly<{
  id: string;
  requestedAt: string | null;
  reason: string;
  state: "requested" | "assigned" | "resolved" | "withdrawn";
  assignedReviewerUserId: string | null;
  resolutionSummary: string;
}>;

export type VerificationRevocation = Readonly<{
  revokedAt: string | null;
  reason: RevocationReason | null;
  publicProofRemoved: boolean;
}>;

export type VerificationRecord = Readonly<{
  id: string;
  workspaceId: string;
  submissionId: string;
  submissionVersionId: string;
  submissionVersionNumber: number;
  rubricVersionId: string;
  rubricVersionNumber: number;
  projectTitle: string;
  state: VerificationState;
  talentUserId: string;
  assignment: VerificationAssignment | null;
  reviews: readonly VerificationReview[];
  observations: readonly VerificationObservation[];
  decision: VerificationDecision | null;
  appeal: VerificationAppeal | null;
  revocation: VerificationRevocation | null;
  proofId: string | null;
  proofVisibility: ProofVisibilityChoice;
  updatedAt: string | null;
}>;

export type VerificationEligibilityFacts = Readonly<{
  submissionState: "submitted" | "resubmitted" | string;
  hasCompleteSubmissionVersion: boolean;
  hasLockedRubricVersion: boolean;
  reviewerIsActive: boolean;
  reviewerHasActiveContext: boolean;
  reviewerMatchesSkills: boolean;
  reviewerHasCapacity: boolean;
  reviewerHasConflict: boolean;
  reviewerIsTalent: boolean;
  reviewerBlockedByOrganization: boolean;
}>;

export type VerificationEligibility = Readonly<{
  eligible: boolean;
  blockers: readonly string[];
}>;

/**
 * Pure policy helper. It never assigns, verifies, revokes, or publishes; callers
 * must derive all facts from the authenticated database context.
 */
export function evaluateVerificationEligibility(
  facts: VerificationEligibilityFacts
): VerificationEligibility {
  const blockers: string[] = [];
  if (!["submitted", "resubmitted"].includes(facts.submissionState)) {
    blockers.push("submission_not_ready_for_verification");
  }
  if (!facts.hasCompleteSubmissionVersion) {
    blockers.push("submission_version_is_incomplete");
  }
  if (!facts.hasLockedRubricVersion) {
    blockers.push("locked_rubric_required");
  }
  if (!facts.reviewerIsActive) blockers.push("reviewer_access_is_not_active");
  if (!facts.reviewerHasActiveContext) {
    blockers.push("reviewer_context_not_active");
  }
  if (!facts.reviewerMatchesSkills) {
    blockers.push("matching_skill_expertise_missing");
  }
  if (!facts.reviewerHasCapacity) {
    blockers.push("reviewer_capacity_unavailable");
  }
  if (facts.reviewerHasConflict) {
    blockers.push("declared_conflict_blocks_review");
  }
  if (facts.reviewerIsTalent) blockers.push("self_review_prohibited");
  if (facts.reviewerBlockedByOrganization) {
    blockers.push("organization_relationship_blocks_review");
  }
  return { eligible: blockers.length === 0, blockers };
}

export type VerificationActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
}>;

export const initialVerificationActionState: VerificationActionState = {
  status: "idle",
  message: "",
};
