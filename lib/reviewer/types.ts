/**
 * Proofly Phase 27 reviewer domain: a private, evidence-led approval lifecycle.
 * Reviewer capability, lifecycle state, active context, policy agreement, capacity,
 * conflicts, organization blocks, and exact canonical skills are distinct checks.
 */
import type { CanonicalSkillKey } from "@/lib/profile/types";

export const reviewerApplicationStates = [
  "requested",
  "in_screening",
  "needs_more_evidence",
  "approved",
  "active",
  "paused",
  "suspended",
  "rejected",
] as const;

export type ReviewerApplicationState =
  (typeof reviewerApplicationStates)[number];

export const reviewerApplicationStateLabel: Record<
  ReviewerApplicationState,
  string
> = {
  requested: "Draft request",
  in_screening: "In screening",
  needs_more_evidence: "More evidence needed",
  approved: "Approved — activate access",
  active: "Active reviewer",
  paused: "Paused",
  suspended: "Suspended",
  rejected: "Not approved",
};

export const reviewerAvailabilityStatuses = [
  "available",
  "limited",
  "unavailable",
] as const;

export type ReviewerAvailabilityStatus =
  (typeof reviewerAvailabilityStatuses)[number];

export const reviewerEvidenceTypes = [
  "professional_work",
  "open_source",
  "leadership_or_mentorship",
  "prior_review_or_assessment",
  "technical_writing",
  "reference",
] as const;

export type ReviewerEvidenceType = (typeof reviewerEvidenceTypes)[number];

export const reviewerEvidenceTypeLabel: Record<ReviewerEvidenceType, string> = {
  professional_work: "Professional work",
  open_source: "Open-source contribution",
  leadership_or_mentorship: "Leadership or mentorship",
  prior_review_or_assessment: "Previous review or assessment work",
  technical_writing: "Published technical work",
  reference: "Reference",
};

export const reviewerConflictKinds = [
  "close_collaboration",
  "current_or_recent_employment",
  "financial_interest",
  "personal_relationship",
  "other",
] as const;

export type ReviewerConflictKind = (typeof reviewerConflictKinds)[number];

export const reviewerConflictScopes = ["organization", "general"] as const;

export type ReviewerConflictScope = (typeof reviewerConflictScopes)[number];

/** Bump only through approved policy governance; agreement history remains append-only. */
export const currentReviewerPolicyVersion = "reviewer-conduct-v1";

export type ReviewerSkill = Readonly<{
  skillKey: CanonicalSkillKey;
  expertiseContext: string;
}>;

export type ReviewerEvidence = Readonly<{
  id: string;
  evidenceType: ReviewerEvidenceType;
  title: string;
  description: string;
  sourceUrl: string;
}>;

export type ReviewerConflictDeclaration = Readonly<{
  id: string;
  relationshipKind: ReviewerConflictKind;
  scope: ReviewerConflictScope;
  organizationId: string | null;
  context: string;
}>;

export type ReviewerProfile = Readonly<{
  displayName: string;
  professionalFocus: string;
  experienceContext: string;
  reviewExperience: string;
  timezone: string;
  languages: readonly string[];
  availabilityStatus: ReviewerAvailabilityStatus;
  maxConcurrentReviews: number;
  feedbackStyle: string;
  publicBio: string;
  conflictAcknowledgedAt: string | null;
  skills: readonly ReviewerSkill[];
}>;

export type ReviewerApplication = Readonly<{
  id: string;
  state: ReviewerApplicationState;
  profile: ReviewerProfile;
  evidence: readonly ReviewerEvidence[];
  conflicts: readonly ReviewerConflictDeclaration[];
  policyAgreedAt: string | null;
  policyVersion: string | null;
  resolutionNote: string;
  submittedAt: string | null;
  updatedAt: string | null;
}>;

export type ReviewerAdminQueueItem = Readonly<{
  id: string;
  userId: string;
  state: ReviewerApplicationState;
  displayName: string;
  professionalFocus: string;
  availabilityStatus: ReviewerAvailabilityStatus | null;
  skillKeys: readonly CanonicalSkillKey[];
  policyAgreedAt: string | null;
  updatedAt: string | null;
}>;

export type ReviewerOpportunityGuard = Readonly<{
  allowed: boolean;
  reason:
    | "active_reviewer"
    | "application_required"
    | "approval_pending"
    | "activation_required"
    | "paused"
    | "suspended"
    | "not_approved";
}>;

export type ReviewerOpportunityFacts = Readonly<{
  lifecycleState: ReviewerApplicationState | null;
  hasReviewerCapability: boolean;
  hasActiveReviewerContext: boolean;
  hasCurrentPolicyAgreement: boolean;
  availabilityStatus: ReviewerAvailabilityStatus | null;
  hasCapacity: boolean;
  requiredSkillKeys: readonly CanonicalSkillKey[];
  reviewerSkillKeys: readonly CanonicalSkillKey[];
  isOwnWork: boolean;
  hasDeclaredConflict: boolean;
  isBlockedByOrganization: boolean;
}>;

export type ReviewerOpportunityEligibility = Readonly<{
  eligible: boolean;
  blockers: readonly string[];
}>;

/**
 * Pure Phase 27 guard. It does not assign work or make a review decision; callers
 * must derive every fact from authenticated server/database state.
 */
export function evaluateReviewerOpportunityEligibility(
  facts: ReviewerOpportunityFacts
): ReviewerOpportunityEligibility {
  const blockers: string[] = [];
  if (facts.lifecycleState !== "active") {
    blockers.push("reviewer_access_is_not_active");
  }
  if (!facts.hasReviewerCapability)
    blockers.push("reviewer_capability_missing");
  if (!facts.hasActiveReviewerContext) {
    blockers.push("reviewer_context_not_active");
  }
  if (!facts.hasCurrentPolicyAgreement) {
    blockers.push("current_policy_agreement_missing");
  }
  if (
    facts.availabilityStatus !== "available" &&
    facts.availabilityStatus !== "limited"
  ) {
    blockers.push("reviewer_not_available");
  }
  if (!facts.hasCapacity) blockers.push("reviewer_capacity_unavailable");
  if (facts.requiredSkillKeys.length === 0) {
    blockers.push("opportunity_skills_not_defined");
  } else if (
    !facts.requiredSkillKeys.every(skill =>
      facts.reviewerSkillKeys.includes(skill)
    )
  ) {
    blockers.push("matching_skill_expertise_missing");
  }
  if (facts.isOwnWork) blockers.push("self_review_prohibited");
  if (facts.hasDeclaredConflict)
    blockers.push("declared_conflict_blocks_review");
  if (facts.isBlockedByOrganization) {
    blockers.push("organization_relationship_blocks_review");
  }
  return { eligible: blockers.length === 0, blockers };
}

export type ReviewerActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
}>;

export const initialReviewerActionState: ReviewerActionState = {
  status: "idle",
  message: "",
};
