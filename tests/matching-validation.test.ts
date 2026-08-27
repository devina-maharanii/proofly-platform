/** Phase 32 validation: matching input is voluntary, bounded, and cannot encode protected-characteristic requirements. */
import { describe, expect, it } from "vitest";

import {
  matchingPreferencesSchema,
  matchingRequirementsSchema,
  recommendationControlSchema,
} from "@/lib/matching/validation";

describe("Phase 32 matching validation", () => {
  it("accepts explicit, voluntary matching controls with a standard timezone", () => {
    expect(
      matchingPreferencesSchema.safeParse({
        projectRecommendationsState: "enabled",
        companyDiscoverabilityState: "paused",
        availabilityStatus: "limited",
        shareAvailabilityWithCompanies: true,
        workArrangement: "remote",
        timezone: "Asia/Dhaka",
        applicationCapacity: "available",
      }).success
    ).toBe(true);
  });

  it("rejects malformed participation and unbounded timezone values", () => {
    expect(
      matchingPreferencesSchema.safeParse({
        projectRecommendationsState: "automatic",
        companyDiscoverabilityState: "enabled",
        availabilityStatus: "available",
        shareAvailabilityWithCompanies: false,
        workArrangement: "remote",
        timezone: "x".repeat(81),
        applicationCapacity: "available",
      }).success
    ).toBe(false);
  });

  it("accepts governed proof expectations only", () => {
    expect(
      matchingRequirementsSchema.safeParse({
        projectId: "550e8400-e29b-41d4-a716-446655440000",
        matchingEnabled: true,
        requiredEvidenceExpectations: {
          typescript: "human_verified_public_proof",
          react: "context_only",
        },
        availabilityExpectation: "limited_ok",
        workArrangement: "flexible",
        timezoneExpectation: "UTC+6 overlap is optional context",
        collaborationNeeds: "Use the stated project collaboration rhythm.",
      }).success
    ).toBe(true);
  });

  it("rejects protected characteristics and opaque requirement text", () => {
    const result = matchingRequirementsSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      matchingEnabled: true,
      requiredEvidenceExpectations: {
        typescript: "human_verified_public_proof",
      },
      availabilityExpectation: "available_now",
      workArrangement: "remote",
      timezoneExpectation: "",
      collaborationNeeds: "Prefer candidates under 30 years old.",
    });
    expect(result.success).toBe(false);
  });

  it("bounds feedback and human-review controls to known values", () => {
    expect(
      recommendationControlSchema.safeParse({
        recommendationId: "550e8400-e29b-41d4-a716-446655440000",
        feedbackType: "missing_source",
        humanAction: "shortlist_for_review",
        detail: "Source should be checked.",
      }).success
    ).toBe(true);
    expect(
      recommendationControlSchema.safeParse({
        recommendationId: "not-a-uuid",
        feedbackType: "boost",
        humanAction: "hire",
        detail: "x".repeat(601),
      }).success
    ).toBe(false);
  });
});
