import { describe, expect, it } from "vitest";

import {
  reviewerApplicationInputSchema,
  type ReviewerApplicationInput,
} from "@/lib/reviewer/validation";

const validApplication = (): ReviewerApplicationInput => ({
  displayName: "Jordan Reviewer",
  professionalFocus:
    "Frontend systems and accessibility review for product engineering work.",
  experienceContext:
    "I have delivered and maintained frontend systems across several product teams with accessibility and performance constraints.",
  reviewExperience:
    "I have mentored engineers and completed structured pull-request and assessment reviews with documented feedback.",
  timezone: "Asia/Dhaka",
  languages: ["English", "Bangla"],
  availabilityStatus: "limited" as const,
  maxConcurrentReviews: 2,
  feedbackStyle:
    "Specific, kind, and evidence-linked feedback with clear next actions.",
  publicBio:
    "Product-minded software reviewer focused on accessible frontend systems.",
  skills: [
    {
      skillKey: "react",
      expertiseContext: "Component architecture and accessibility review.",
    },
  ],
  evidence: [
    {
      evidenceType: "professional_work" as const,
      title: "Accessible design system delivery",
      description:
        "Delivered an accessible component system with documented review practices and ownership context.",
      sourceUrl: "https://example.test/work",
    },
  ],
  conflicts: [],
});

describe("Phase 27 reviewer application validation", () => {
  it("accepts a bounded practical-evidence application using exact canonical skill keys", () => {
    expect(
      reviewerApplicationInputSchema.safeParse(validApplication()).success
    ).toBe(true);
  });

  it("rejects invented expertise keys, duplicate canonical skills, and unsafe evidence URLs", () => {
    const invented = validApplication();
    invented.skills = [
      { skillKey: "invented-framework", expertiseContext: "No." },
    ] as never;
    expect(reviewerApplicationInputSchema.safeParse(invented).success).toBe(
      false
    );

    const duplicate = validApplication();
    duplicate.skills = [
      { skillKey: "react", expertiseContext: "One" },
      { skillKey: "react", expertiseContext: "Two" },
    ];
    expect(reviewerApplicationInputSchema.safeParse(duplicate).success).toBe(
      false
    );

    const unsafeUrl = validApplication();
    unsafeUrl.evidence[0]!.sourceUrl = "http://example.test/not-secure";
    expect(reviewerApplicationInputSchema.safeParse(unsafeUrl).success).toBe(
      false
    );
  });

  it("requires an organization identifier only for organization-scoped conflict declarations", () => {
    const withoutOrganization = validApplication();
    withoutOrganization.conflicts = [
      {
        relationshipKind: "close_collaboration",
        scope: "organization",
        organizationId: null,
        context: "Current close collaborator relationship.",
      },
    ];
    expect(
      reviewerApplicationInputSchema.safeParse(withoutOrganization).success
    ).toBe(false);

    const generalWithOrganization = validApplication();
    generalWithOrganization.conflicts = [
      {
        relationshipKind: "financial_interest",
        scope: "general",
        organizationId: "11111111-1111-4111-8111-111111111111",
        context:
          "General conflict that must not carry an organization identifier.",
      },
    ];
    expect(
      reviewerApplicationInputSchema.safeParse(generalWithOrganization).success
    ).toBe(false);
  });
});
