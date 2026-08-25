import { describe, expect, it } from "vitest";

import { workEvidenceInputSchema } from "@/lib/evidence/validation";

function validEvidence(overrides: Record<string, unknown> = {}) {
  return {
    title: "Accessible filtering patterns",
    shortSummary:
      "A structured account of an accessibility-focused interface improvement.",
    evidenceType: "personal_project",
    problemGoal:
      "Make filtering understandable for keyboard and screen-reader users.",
    userRole: "Frontend developer",
    personalContribution:
      "I designed and implemented the semantic controls and focus behavior.",
    contributionScope: "Interaction design and implementation",
    contextConstraints: "The work had to fit an existing component library.",
    decisionsTradeoffs:
      "I chose native controls over a custom composite widget.",
    outcomeStatus:
      "The work is documented; no performance claim is presented as proof.",
    teamWork: false,
    ownershipStatus: "owns",
    permissionNote: "",
    startedOn: "2026-08-01",
    durationText: "Two weeks",
    skills: [{ skillKey: "typescript", context: "Typed interaction state." }],
    links: [
      {
        linkType: "repository",
        label: "Source repository",
        url: "https://example.com/source",
        availability: "available",
        isPublic: true,
      },
    ],
    attributions: [],
    ...overrides,
  };
}

describe("Phase 18 work-evidence validation", () => {
  it("accepts bounded, manual, contextual evidence using canonical skills", () => {
    const parsed = workEvidenceInputSchema.safeParse(validEvidence());

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.skills).toEqual([
        { skillKey: "typescript", context: "Typed interaction state." },
      ]);
    }
  });

  it("rejects invented skills, duplicate skills, opaque scores, and unsafe URLs", () => {
    expect(
      workEvidenceInputSchema.safeParse(
        validEvidence({
          skills: [{ skillKey: "made-up-skill", context: "" }],
        })
      ).success
    ).toBe(false);
    expect(
      workEvidenceInputSchema.safeParse(
        validEvidence({
          skills: [
            { skillKey: "typescript", context: "" },
            { skillKey: "typescript", context: "" },
          ],
        })
      ).success
    ).toBe(false);
    expect(
      workEvidenceInputSchema.safeParse({ ...validEvidence(), proofScore: 99 })
        .success
    ).toBe(false);
    expect(
      workEvidenceInputSchema.safeParse(
        validEvidence({
          links: [
            {
              linkType: "repository",
              label: "Unsafe source",
              url: "http://example.com/source",
              availability: "available",
              isPublic: true,
            },
          ],
        })
      ).success
    ).toBe(false);
  });

  it("requires attribution for team work and a permission explanation for non-owner work", () => {
    expect(
      workEvidenceInputSchema.safeParse(validEvidence({ teamWork: true }))
        .success
    ).toBe(false);
    expect(
      workEvidenceInputSchema.safeParse(
        validEvidence({
          ownershipStatus: "permission_to_share",
          permissionNote: "Short",
        })
      ).success
    ).toBe(false);
    expect(
      workEvidenceInputSchema.safeParse(
        validEvidence({
          teamWork: true,
          ownershipStatus: "permission_to_share",
          permissionNote: "The collaborating team approved this summary.",
          attributions: [
            {
              contributorName: "Design partner",
              contributorRole: "Product designer",
              sourceReferenceUrl: "",
              isPublic: true,
            },
          ],
        })
      ).success
    ).toBe(true);
  });

  it("allows private and unavailable links without pretending they are live", () => {
    const parsed = workEvidenceInputSchema.safeParse(
      validEvidence({
        links: [
          {
            linkType: "demo",
            label: "Private demonstration",
            url: "",
            availability: "private",
            isPublic: true,
          },
          {
            linkType: "media",
            label: "Unavailable recording",
            url: "",
            availability: "unavailable",
            isPublic: true,
          },
        ],
      })
    );

    expect(parsed.success).toBe(true);
  });
});
