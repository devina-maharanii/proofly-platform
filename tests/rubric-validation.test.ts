import { describe, expect, it } from "vitest";

import { rubricInputSchema } from "@/lib/rubric/validation";
import type { RubricInput } from "@/lib/rubric/types";

const descriptors = [
  [
    "not_demonstrated",
    "The submission does not show a project-relevant implementation path.",
  ],
  [
    "emerging",
    "The submission begins an implementation path but leaves important evidence incomplete.",
  ],
  [
    "working_in_context",
    "The submission meets the bounded project requirement with observable evidence.",
  ],
  [
    "independent_in_context",
    "The submission independently meets the bounded requirement and explains trade-offs.",
  ],
  [
    "advanced_in_context",
    "The submission adds proportionate, well-reasoned detail beyond the immediate requirement.",
  ],
] as const;

const validRubric: RubricInput = {
  title: "Accessible project implementation rubric",
  projectContext:
    "Assess the submitted implementation against the defined project requirements, acceptance criteria, and stated constraints.",
  templateKey: "frontend-delivery",
  dimensions: [
    {
      name: "Accessible behavior",
      description:
        "Assess observable semantic structure, keyboard behavior, and accessible feedback in the bounded implementation.",
      skillKeys: ["web-accessibility"],
      weight: 100,
      priority: "essential",
      observableCriteria: [
        "The submitted interaction can be operated with a keyboard and exposes an understandable state.",
      ],
      evidenceExamples: [
        "A focused implementation detail or test shows the expected accessible behavior.",
      ],
      commonFailureModes: [
        "The interaction has no usable keyboard or state-feedback evidence.",
      ],
      reviewerGuidance:
        "Assess project-relevant evidence and stated trade-offs. Do not infer identity, pedigree, or a universal ability level from this submission.",
      feedbackVisibility: "talent_and_company",
      descriptors: descriptors.map(([level, description]) => ({
        level,
        description,
      })),
    },
  ],
  calibrationExamples: [],
};

describe("Phase 28 rubric validation", () => {
  it("accepts a bounded contextual rubric with exact canonical skills, weights, explicit visibility, and all descriptor levels", () => {
    expect(rubricInputSchema.safeParse(validRubric).success).toBe(true);
  });

  it("rejects non-100 weights, missing descriptor levels, protected-characteristic language, and style-only guidance", () => {
    const weightMismatch = {
      ...validRubric,
      dimensions: [{ ...validRubric.dimensions[0], weight: 90 }],
    };
    expect(rubricInputSchema.safeParse(weightMismatch).success).toBe(false);

    const incompleteDescriptors = {
      ...validRubric,
      dimensions: [
        {
          ...validRubric.dimensions[0],
          descriptors: validRubric.dimensions[0].descriptors.slice(0, 4),
        },
      ],
    };
    expect(rubricInputSchema.safeParse(incompleteDescriptors).success).toBe(
      false
    );

    const protectedLanguage = {
      ...validRubric,
      dimensions: [
        {
          ...validRubric.dimensions[0],
          description:
            "Assess whether women demonstrate accessible implementation behavior in this project.",
        },
      ],
    };
    expect(rubricInputSchema.safeParse(protectedLanguage).success).toBe(false);

    const styleOnly = {
      ...validRubric,
      dimensions: [
        {
          ...validRubric.dimensions[0],
          reviewerGuidance:
            "Use personal preference only when selecting the single correct solution for this project.",
        },
      ],
    };
    expect(rubricInputSchema.safeParse(styleOnly).success).toBe(false);
  });
});
