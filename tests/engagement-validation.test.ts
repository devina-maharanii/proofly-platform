import { describe, expect, it } from "vitest";

import {
  buildEngagementTermsSnapshot,
  parseAccessRequestForm,
  parseEngagementProposalForm,
} from "@/lib/engagement/validation";

function proposalForm(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    applicationId: "550e8400-e29b-41d4-a716-446655440000",
    engagementType: "paid_trial",
    parentEngagementId: "",
    marketCode: "US",
    currency: "USD",
    summary: "A bounded paid validation of the agreed integration outcome.",
    scope:
      "Implement the agreed non-production integration boundary and document the result for private review.",
    deliverables:
      "A private workspace submission with implementation notes and stated limitations.",
    exclusions:
      "No production deployment, credential sharing, or work outside the agreed milestone.",
    dependencies:
      "Company provides an organization-owned non-production workspace.",
    assumptions: "The stated acceptance criteria remain available for review.",
    startDate: "2026-09-01",
    deadline: "2026-09-10",
    expectedEffortHours: "40",
    timezone: "UTC",
    communicationCadence: "Written check-in every two working days.",
    compensationAmountMinor: "125000",
    platformFeeMinor: "0",
    taxesAndFeesNote:
      "Any applicable taxes and fees are reviewed by the parties in the supported market.",
    paymentTrigger: "milestone_accepted",
    paymentCadence: "per_milestone",
    acceptanceCriteria:
      "The private submission documents the agreed outcome and satisfies the stated objective checks.",
    revisionAllowance: "1",
    approvedTools:
      "Private documentation and organization-owned sandbox data only.",
    confidentialityTerms:
      "Private engagement information remains limited to authorized participants.",
    ownershipTerms:
      "Ownership is limited to the explicit written scope and is not a legal determination.",
    licenseTerms:
      "Any permitted license is described only in this private written record.",
    portfolioVisibility: "private_until_explicit_consent",
    cancellationTerms:
      "Either participant may cancel before start through this record with a written reason.",
    terminationTerms:
      "A participant may terminate in progress through this record and evidence remains retained.",
    disputeTerms:
      "Either participant may open a private dispute with a reason, remedy, and preserved evidence.",
    supportRoute: "Private support route",
    marketLimitationNotice:
      "Activation depends on a currently approved market and verified provider capability; payment execution is not available here.",
    milestoneTitle: "Private integration validation",
    milestoneDescription:
      "Deliver the bounded non-production integration work described in the agreed private scope.",
    milestoneDeliverableType: "private workspace submission",
    milestoneDefinitionOfDone:
      "The submission demonstrates the agreed non-production result and documents any material limitation.",
    milestoneDueDate: "2026-09-10",
    milestoneAmountMinor: "125000",
    milestoneRevisionAllowance: "1",
    milestoneTimeoutPolicy:
      "No silence is acceptance; the company records an explicit decision or request for changes.",
    milestoneEvidencePolicy:
      "Use only private workspace files and versioned submission context authorized for this engagement.",
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe("Phase 33 engagement validation", () => {
  it("allows a bounded paid trial only when the single paid milestone equals total compensation", () => {
    const parsed = parseEngagementProposalForm(proposalForm());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const snapshot = buildEngagementTermsSnapshot(parsed.data);
    expect(snapshot.funding_requirement).toBe("provider_verified_before_work");
    expect(snapshot.access_terms).toEqual({
      production_access: "blocked",
      personal_credentials: "prohibited",
      approved_tools: expect.any(String),
    });
    expect(snapshot.milestones).toHaveLength(1);
  });

  it("rejects unpaid work, out-of-range trial effort, schedule conflicts, and mismatched milestone compensation", () => {
    expect(
      parseEngagementProposalForm(
        proposalForm({ compensationAmountMinor: "0" })
      ).success
    ).toBe(false);
    expect(
      parseEngagementProposalForm(proposalForm({ expectedEffortHours: "161" }))
        .success
    ).toBe(false);
    expect(
      parseEngagementProposalForm(proposalForm({ deadline: "2026-08-30" }))
        .success
    ).toBe(false);
    expect(
      parseEngagementProposalForm(
        proposalForm({ milestoneAmountMinor: "124999" })
      ).success
    ).toBe(false);
  });

  it("requires recurring cadence for an ongoing contract and limits it to an explicit parent engagement field", () => {
    expect(
      parseEngagementProposalForm(
        proposalForm({
          engagementType: "ongoing_contract",
          paymentCadence: "per_milestone",
        })
      ).success
    ).toBe(false);
    expect(
      parseEngagementProposalForm(
        proposalForm({
          engagementType: "ongoing_contract",
          paymentCadence: "monthly",
          parentEngagementId: "550e8400-e29b-41d4-a716-446655440001",
        })
      ).success
    ).toBe(true);
  });

  it("accepts only valid time-bounded access request shape before the database blocks secrets and production access", () => {
    const form = new FormData();
    form.set("engagementId", "550e8400-e29b-41d4-a716-446655440000");
    form.set("accessKind", "documentation");
    form.set("resourceLabel", "Private API documentation");
    form.set("purpose", "Review the documented private integration contract.");
    form.set("expiresAt", "2026-09-10T12:00");
    expect(parseAccessRequestForm(form).success).toBe(true);
  });
});
