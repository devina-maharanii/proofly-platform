/** Evidence Ledger Editorial — Phase 32 validates voluntary matching controls and rejects protected or opaque input. */
import { z } from "zod";

import {
  matchingAvailabilityStates,
  matchingFeedbackTypes,
  matchingHumanActions,
  matchingParticipationStates,
  matchingRequirementAvailabilityStates,
  matchingWorkArrangements,
} from "./types";

const protectedInputPattern =
  /\b(male|female|men|women|white|black|asian|religion|muslim|christian|hindu|disabled|disability|pregnant|married|single|nationality|citizenship|age|years\s+old|young|old)\b/i;

const cleanText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .refine(value => !protectedInputPattern.test(value), {
      message:
        "Matching requirements cannot depend on protected characteristics.",
    });

const formText = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export const matchingPreferencesSchema = z
  .object({
    projectRecommendationsState: z.enum(matchingParticipationStates),
    companyDiscoverabilityState: z.enum(matchingParticipationStates),
    availabilityStatus: z.enum(matchingAvailabilityStates),
    shareAvailabilityWithCompanies: z.boolean(),
    workArrangement: z.enum(matchingWorkArrangements),
    timezone: z.string().trim().min(1).max(80),
    applicationCapacity: z.enum(matchingAvailabilityStates),
  })
  .strict();

export const matchingRequirementsSchema = z
  .object({
    projectId: z.string().uuid(),
    matchingEnabled: z.boolean(),
    requiredEvidenceExpectations: z.record(
      z.string().regex(/^[a-z0-9-]{1,80}$/),
      z.enum(["human_verified_public_proof", "context_only"])
    ),
    availabilityExpectation: z.enum(matchingRequirementAvailabilityStates),
    workArrangement: z.enum(matchingWorkArrangements),
    timezoneExpectation: cleanText(120),
    collaborationNeeds: cleanText(360),
  })
  .strict();

export const recommendationControlSchema = z
  .object({
    recommendationId: z.string().uuid(),
    feedbackType: z.enum(matchingFeedbackTypes).optional(),
    humanAction: z.enum(matchingHumanActions).optional(),
    detail: cleanText(600),
  })
  .strict();

export function parseMatchingPreferencesForm(formData: FormData) {
  return matchingPreferencesSchema.safeParse({
    projectRecommendationsState: formText(
      formData,
      "projectRecommendationsState"
    ),
    companyDiscoverabilityState: formText(
      formData,
      "companyDiscoverabilityState"
    ),
    availabilityStatus: formText(formData, "availabilityStatus"),
    shareAvailabilityWithCompanies:
      formText(formData, "shareAvailabilityWithCompanies") === "true",
    workArrangement: formText(formData, "workArrangement"),
    timezone: formText(formData, "timezone"),
    applicationCapacity: formText(formData, "applicationCapacity"),
  });
}

export function parseMatchingRequirementsForm(formData: FormData) {
  let requiredEvidenceExpectations: unknown = {};
  const raw = formText(formData, "requiredEvidenceExpectations");
  if (raw.length <= 3000) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        requiredEvidenceExpectations = parsed;
      }
    } catch {
      requiredEvidenceExpectations = {};
    }
  }
  return matchingRequirementsSchema.safeParse({
    projectId: formText(formData, "projectId"),
    matchingEnabled: formText(formData, "matchingEnabled") === "true",
    requiredEvidenceExpectations,
    availabilityExpectation: formText(formData, "availabilityExpectation"),
    workArrangement: formText(formData, "workArrangement"),
    timezoneExpectation: formText(formData, "timezoneExpectation"),
    collaborationNeeds: formText(formData, "collaborationNeeds"),
  });
}

export function parseRecommendationControlForm(formData: FormData) {
  return recommendationControlSchema.safeParse({
    recommendationId: formText(formData, "recommendationId"),
    feedbackType: formText(formData, "feedbackType") || undefined,
    humanAction: formText(formData, "humanAction") || undefined,
    detail: formText(formData, "detail"),
  });
}

export function matchingFieldErrors(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const name = String(issue.path[0] ?? "form");
    if (!fields[name]) fields[name] = issue.message;
  }
  return fields;
}
