/** Design: Evidence Ledger Editorial — validate concrete, contextual rubric language before any private version is saved. */
import { z } from "zod";

import { canonicalSkills } from "@/lib/profile/types";

import {
  rubricDescriptorLevels,
  rubricDimensionPriorities,
  rubricFeedbackVisibilities,
} from "./types";

const canonicalSkillKeys = canonicalSkills.map(skill => skill.key) as [
  string,
  ...string[],
];

const protectedCharacteristicPattern =
  /\b(male|female|men|women|white|black|asian|muslim|christian|hindu|religion|disabled|disability|pregnant|married|single|nationality|citizenship|under\s+\d{2}|over\s+\d{2}|\d{2}\s*(years|yrs)\s*old)\b/i;

const contextualText = (minimum: number, maximum: number) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .refine(value => !protectedCharacteristicPattern.test(value), {
      message:
        "Rubric language must describe project-relevant work, not protected characteristics.",
    });

const descriptorSchema = z.object({
  level: z.enum(rubricDescriptorLevels),
  description: contextualText(12, 500),
});

const descriptorSetSchema = z
  .array(descriptorSchema)
  .length(rubricDescriptorLevels.length)
  .superRefine((descriptors, context) => {
    const received = descriptors.map(descriptor => descriptor.level);
    for (const required of rubricDescriptorLevels) {
      if (!received.includes(required)) {
        context.addIssue({
          code: "custom",
          message: `Add the ${required.replaceAll("_", " ")} descriptor.`,
        });
      }
    }
    if (new Set(received).size !== received.length) {
      context.addIssue({
        code: "custom",
        message: "Each descriptor level can appear only once.",
      });
    }
  });

const dimensionSchema = z.object({
  id: z.string().uuid().optional(),
  name: contextualText(3, 120),
  description: contextualText(12, 700),
  skillKeys: z
    .array(z.enum(canonicalSkillKeys))
    .min(1)
    .max(5)
    .superRefine((keys, context) => {
      if (new Set(keys).size !== keys.length) {
        context.addIssue({
          code: "custom",
          message: "Choose each canonical skill only once per dimension.",
        });
      }
    }),
  weight: z.number().int().min(1).max(100),
  priority: z.enum(rubricDimensionPriorities),
  observableCriteria: z.array(contextualText(8, 280)).min(1).max(6),
  evidenceExamples: z.array(contextualText(8, 400)).max(5),
  commonFailureModes: z.array(contextualText(8, 400)).max(5),
  reviewerGuidance: contextualText(20, 900).refine(
    value =>
      !/(style[-\s]?only|personal preference only|single correct solution)/i.test(
        value
      ),
    {
      message:
        "Reviewer guidance must allow multiple valid solutions and avoid style-only judgment.",
    }
  ),
  feedbackVisibility: z.enum(rubricFeedbackVisibilities),
  descriptors: descriptorSetSchema,
});

const calibrationExampleSchema = z.object({
  id: z.string().uuid().optional(),
  title: contextualText(3, 140),
  description: contextualText(12, 700),
  sourceUrl: z.union([z.literal(""), z.url().max(500)]),
  reviewerGuidance: contextualText(12, 700),
});

export const rubricInputSchema = z
  .object({
    title: contextualText(6, 120),
    projectContext: contextualText(12, 900),
    templateKey: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9-]+$/),
    dimensions: z.array(dimensionSchema).min(1).max(8),
    calibrationExamples: z.array(calibrationExampleSchema).max(5),
  })
  .superRefine((rubric, context) => {
    const weight = rubric.dimensions.reduce(
      (total, dimension) => total + dimension.weight,
      0
    );
    if (weight !== 100) {
      context.addIssue({
        code: "custom",
        path: ["dimensions"],
        message:
          "Dimension weights must total exactly 100 for this project context.",
      });
    }
    const names = rubric.dimensions.map(dimension =>
      dimension.name.toLocaleLowerCase()
    );
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: "custom",
        path: ["dimensions"],
        message: "Dimension names must be distinct.",
      });
    }
  });

export type RubricInput = z.infer<typeof rubricInputSchema>;

export function parseRubricForm(formData: FormData) {
  const parseJson = (field: string) => {
    const value = formData.get(field);
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  };
  return rubricInputSchema.safeParse({
    title: formData.get("title"),
    projectContext: formData.get("projectContext"),
    templateKey: formData.get("templateKey"),
    dimensions: parseJson("dimensions"),
    calibrationExamples: parseJson("calibrationExamples"),
  });
}

export function rubricFieldErrors(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.length ? issue.path.join(".") : "rubric";
    fields[path] ??= issue.message;
  }
  return fields;
}

export function rubricPayload(input: RubricInput) {
  return {
    title: input.title,
    project_context: input.projectContext,
    template_key: input.templateKey,
    dimensions: input.dimensions.map(dimension => ({
      name: dimension.name,
      description: dimension.description,
      skill_keys: dimension.skillKeys,
      weight: dimension.weight,
      priority: dimension.priority,
      observable_criteria: dimension.observableCriteria,
      evidence_examples: dimension.evidenceExamples,
      common_failure_modes: dimension.commonFailureModes,
      reviewer_guidance: dimension.reviewerGuidance,
      feedback_visibility: dimension.feedbackVisibility,
      descriptors: dimension.descriptors,
    })),
    calibration_examples: input.calibrationExamples.map(example => ({
      title: example.title,
      description: example.description,
      source_url: example.sourceUrl,
      reviewer_guidance: example.reviewerGuidance,
    })),
  };
}
