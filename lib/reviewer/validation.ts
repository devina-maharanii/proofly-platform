/** Phase 27 reviewer input: bounded, canonical, private application fields only. */
import { z } from "zod";

import { canonicalSkills } from "@/lib/profile/types";

import {
  reviewerAvailabilityStatuses,
  reviewerConflictKinds,
  reviewerConflictScopes,
  reviewerEvidenceTypes,
} from "./types";

const skillKeys = canonicalSkills.map(skill => skill.key) as [
  string,
  ...string[],
];

const secureUrl = z
  .string()
  .trim()
  .max(500)
  .refine(value => !value || /^https:\/\//.test(value), {
    message: "Use a secure HTTPS URL or leave this field blank.",
  });

const reviewerSkillSchema = z
  .object({
    skillKey: z.enum(skillKeys),
    expertiseContext: z.string().trim().max(500),
  })
  .strict();

const reviewerEvidenceSchema = z
  .object({
    evidenceType: z.enum(reviewerEvidenceTypes),
    title: z.string().trim().max(160),
    description: z.string().trim().max(1400),
    sourceUrl: secureUrl,
  })
  .strict();

const reviewerConflictSchema = z
  .object({
    relationshipKind: z.enum(reviewerConflictKinds),
    scope: z.enum(reviewerConflictScopes),
    organizationId: z.string().uuid().nullable(),
    context: z.string().trim().max(700),
  })
  .strict()
  .superRefine((conflict, context) => {
    if (conflict.scope === "organization" && !conflict.organizationId) {
      context.addIssue({
        code: "custom",
        path: ["organizationId"],
        message: "Choose the organization this conflict relates to.",
      });
    }
    if (conflict.scope === "general" && conflict.organizationId) {
      context.addIssue({
        code: "custom",
        path: ["organizationId"],
        message:
          "A general conflict cannot include an organization identifier.",
      });
    }
  });

export const reviewerApplicationInputSchema = z
  .object({
    displayName: z.string().trim().max(120),
    professionalFocus: z.string().trim().max(500),
    experienceContext: z.string().trim().max(1400),
    reviewExperience: z.string().trim().max(1400),
    timezone: z.string().trim().max(80),
    languages: z.array(z.string().trim().min(2).max(40)).max(12),
    availabilityStatus: z.enum(reviewerAvailabilityStatuses),
    maxConcurrentReviews: z.coerce.number().int().min(1).max(25),
    feedbackStyle: z.string().trim().max(700),
    publicBio: z.string().trim().max(900),
    skills: z
      .array(reviewerSkillSchema)
      .max(12)
      .refine(
        skills =>
          new Set(skills.map(skill => skill.skillKey)).size === skills.length,
        { message: "Choose each canonical skill only once.", path: ["skills"] }
      ),
    evidence: z.array(reviewerEvidenceSchema).max(12),
    conflicts: z.array(reviewerConflictSchema).max(12),
  })
  .strict();

export type ReviewerApplicationInput = z.infer<
  typeof reviewerApplicationInputSchema
>;

const formString = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function jsonArray(formData: FormData, key: string): unknown[] {
  const raw = formString(formData, key);
  if (!raw || raw.length > 18000) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function parseReviewerApplicationForm(formData: FormData) {
  const languageValue = formString(formData, "languages");
  const languages = languageValue
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  return reviewerApplicationInputSchema.safeParse({
    displayName: formString(formData, "displayName"),
    professionalFocus: formString(formData, "professionalFocus"),
    experienceContext: formString(formData, "experienceContext"),
    reviewExperience: formString(formData, "reviewExperience"),
    timezone: formString(formData, "timezone"),
    languages,
    availabilityStatus: formString(formData, "availabilityStatus"),
    maxConcurrentReviews: formString(formData, "maxConcurrentReviews"),
    feedbackStyle: formString(formData, "feedbackStyle"),
    publicBio: formString(formData, "publicBio"),
    skills: jsonArray(formData, "skills"),
    evidence: jsonArray(formData, "evidence"),
    conflicts: jsonArray(formData, "conflicts"),
  });
}

export const reviewerAdminTransitionInputSchema = z
  .object({
    targetUserId: z.string().uuid(),
    requestedState: z.enum([
      "needs_more_evidence",
      "approved",
      "paused",
      "suspended",
      "rejected",
      "active",
    ]),
    note: z.string().trim().max(600),
  })
  .strict();

export function parseReviewerAdminTransitionForm(formData: FormData) {
  return reviewerAdminTransitionInputSchema.safeParse({
    targetUserId: formString(formData, "targetUserId"),
    requestedState: formString(formData, "requestedState"),
    note: formString(formData, "note"),
  });
}
