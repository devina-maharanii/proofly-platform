import { describe, expect, it } from "vitest";

import {
  evaluateReviewerOpportunityEligibility,
  type ReviewerOpportunityFacts,
} from "@/lib/reviewer/types";

const eligibleFacts = (): ReviewerOpportunityFacts => ({
  lifecycleState: "active",
  hasReviewerCapability: true,
  hasActiveReviewerContext: true,
  hasCurrentPolicyAgreement: true,
  availabilityStatus: "limited",
  hasCapacity: true,
  requiredSkillKeys: ["react", "web-accessibility"],
  reviewerSkillKeys: ["react", "web-accessibility", "testing"],
  isOwnWork: false,
  hasDeclaredConflict: false,
  isBlockedByOrganization: false,
});

describe("Phase 27 reviewer opportunity eligibility", () => {
  it("allows only an active, policy-agreed reviewer whose canonical expertise covers every required skill", () => {
    expect(evaluateReviewerOpportunityEligibility(eligibleFacts())).toEqual({
      eligible: true,
      blockers: [],
    });
  });

  it("blocks inactive, suspended, unapproved, and policy-stale reviewer states", () => {
    for (const lifecycleState of [
      "requested",
      "in_screening",
      "needs_more_evidence",
      "approved",
      "paused",
      "suspended",
      "rejected",
    ] as const) {
      const result = evaluateReviewerOpportunityEligibility({
        ...eligibleFacts(),
        lifecycleState,
      });
      expect(result.eligible).toBe(false);
      expect(result.blockers).toContain("reviewer_access_is_not_active");
    }
    expect(
      evaluateReviewerOpportunityEligibility({
        ...eligibleFacts(),
        hasCurrentPolicyAgreement: false,
      }).blockers
    ).toContain("current_policy_agreement_missing");
  });

  it("blocks self-work, declared conflicts, organization blocks, missing capacity, and incomplete expertise coverage", () => {
    const cases: Array<[Partial<ReviewerOpportunityFacts>, string]> = [
      [{ isOwnWork: true }, "self_review_prohibited"],
      [{ hasDeclaredConflict: true }, "declared_conflict_blocks_review"],
      [
        { isBlockedByOrganization: true },
        "organization_relationship_blocks_review",
      ],
      [{ hasCapacity: false }, "reviewer_capacity_unavailable"],
      [{ reviewerSkillKeys: ["react"] }, "matching_skill_expertise_missing"],
      [{ availabilityStatus: "unavailable" }, "reviewer_not_available"],
    ];
    for (const [override, blocker] of cases) {
      const result = evaluateReviewerOpportunityEligibility({
        ...eligibleFacts(),
        ...override,
      });
      expect(result.eligible).toBe(false);
      expect(result.blockers).toContain(blocker);
    }
  });
});
