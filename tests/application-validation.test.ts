import { describe, expect, it } from "vitest";

import { projectApplicationInputSchema } from "@/lib/application/validation";

const applicationDraft = {
  evidenceIds: [
    "123e4567-e89b-42d3-a456-426614174000",
    "123e4567-e89b-42d3-a456-426614174001",
  ],
  availability:
    "Available for the stated eight-hour evaluation timebox next week.",
  timezoneOverlap: "UTC+6 with four hours overlap on weekday afternoons.",
  motivation:
    "The project goal aligns with the kind of evidence-led product engineering work I want to contribute.",
  relevantExperience:
    "My selected work shows concise product-context writing, scoped frontend implementation, and accessible handoff documentation.",
  projectResponse:
    "I would connect the stated goal, required output, and acceptance criteria to a small, testable implementation plan without requesting production access.",
  approach:
    "I would first clarify assumptions, then make the smallest accessible change and explain tradeoffs.",
};

describe("Phase 24 application validation", () => {
  it("accepts concise, bounded draft input without asking for a repeated resume or application artifact", () => {
    expect(
      projectApplicationInputSchema.safeParse(applicationDraft).success
    ).toBe(true);
  });

  it("rejects hidden fields, duplicate evidence IDs, excessive evidence selection, and oversized project answers", () => {
    expect(
      projectApplicationInputSchema.safeParse({
        ...applicationDraft,
        organizationId: "client-selected-tenant",
      }).success
    ).toBe(false);
    expect(
      projectApplicationInputSchema.safeParse({
        ...applicationDraft,
        evidenceIds: [
          applicationDraft.evidenceIds[0],
          applicationDraft.evidenceIds[0],
        ],
      }).success
    ).toBe(false);
    expect(
      projectApplicationInputSchema.safeParse({
        ...applicationDraft,
        evidenceIds: Array.from(
          { length: 7 },
          (_, index) => `123e4567-e89b-42d3-a456-42661417400${index}`
        ),
      }).success
    ).toBe(false);
    expect(
      projectApplicationInputSchema.safeParse({
        ...applicationDraft,
        projectResponse: "x".repeat(801),
      }).success
    ).toBe(false);
  });

  it("keeps a draft flexible while database submission gates enforce required concise content and terms", () => {
    expect(
      projectApplicationInputSchema.safeParse({
        ...applicationDraft,
        projectResponse: "",
        motivation: "",
      }).success
    ).toBe(true);
  });
});
