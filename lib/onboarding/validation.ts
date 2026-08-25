/** Proofly Phase 13: validate private onboarding input at the client and server boundaries. */
import { z } from "zod";

import {
  companyMemberRoles,
  emptyOnboardingDraft,
  onboardingRoles,
  reviewerExpertiseAreas,
  talentGoals,
  type OnboardingDraft,
  type OnboardingRole,
} from "./types";

const shortText = z.string().trim().max(80);
const longerText = z.string().trim().max(500);

export const onboardingDraftSchema = z
  .object({
    fullName: shortText.default(""),
    displayName: shortText.default(""),
    primaryPurpose: shortText.default(""),
    timezone: z
      .string()
      .trim()
      .regex(/^(UTC|[A-Za-z_+-]+\/[A-Za-z_+/-]+)$/)
      .default(""),
    locale: z.literal("en").default("en"),
    notificationEmail: z.boolean().default(true),
    notificationProduct: z.boolean().default(true),
    developerFocus: shortText.default(""),
    experienceLevel: shortText.default(""),
    goals: z.array(z.enum(talentGoals)).max(talentGoals.length).default([]),
    portfolioUrl: z
      .string()
      .trim()
      .max(500)
      .refine(value => !value || z.url().safeParse(value).success, {
        message:
          "Enter a complete HTTPS link or leave this optional field empty.",
      })
      .default(""),
    availability: shortText.default(""),
    companySize: shortText.default(""),
    hiringStage: shortText.default(""),
    hiringFocus: shortText.default(""),
    companyMemberRole: z.enum(companyMemberRoles).or(z.literal("")).default(""),
    companyFirstAction: shortText.default(""),
    expertiseAreas: z
      .array(z.enum(reviewerExpertiseAreas))
      .max(reviewerExpertiseAreas.length)
      .default([]),
    experienceEvidence: longerText.default(""),
  })
  .strict();

export const companyStartSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  organizationSlug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase words separated by hyphens."
    ),
});

export function parseOnboardingDraft(value: unknown) {
  return onboardingDraftSchema.safeParse(value);
}

export function serializeOnboardingDraft(draft: OnboardingDraft) {
  return {
    full_name: draft.fullName,
    display_name: draft.displayName,
    primary_purpose: draft.primaryPurpose,
    timezone: draft.timezone,
    locale: draft.locale,
    notification_email: draft.notificationEmail,
    notification_product: draft.notificationProduct,
    developer_focus: draft.developerFocus,
    experience_level: draft.experienceLevel,
    goals: draft.goals,
    portfolio_url: draft.portfolioUrl,
    availability: draft.availability,
    company_size: draft.companySize,
    hiring_stage: draft.hiringStage,
    hiring_focus: draft.hiringFocus,
    company_member_role: draft.companyMemberRole,
    company_first_action: draft.companyFirstAction,
    expertise_areas: draft.expertiseAreas,
    experience_evidence: draft.experienceEvidence,
  };
}

function deserializeOnboardingDraft(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const stored = value as Record<string, unknown>;
  return {
    fullName: stored.full_name,
    displayName: stored.display_name,
    primaryPurpose: stored.primary_purpose,
    timezone: stored.timezone,
    locale: stored.locale,
    notificationEmail: stored.notification_email,
    notificationProduct: stored.notification_product,
    developerFocus: stored.developer_focus,
    experienceLevel: stored.experience_level,
    goals: stored.goals,
    portfolioUrl: stored.portfolio_url,
    availability: stored.availability,
    companySize: stored.company_size,
    hiringStage: stored.hiring_stage,
    hiringFocus: stored.hiring_focus,
    companyMemberRole: stored.company_member_role,
    companyFirstAction: stored.company_first_action,
    expertiseAreas: stored.expertise_areas,
    experienceEvidence: stored.experience_evidence,
  };
}

function required(
  value: string,
  field: string,
  errors: Record<string, string>
) {
  if (!value.trim()) {
    errors[field] = "This field is required for the next step.";
  }
}

export function validateOnboardingStep(
  draft: OnboardingDraft,
  role: OnboardingRole,
  step: string
) {
  const errors: Record<string, string> = {};

  if (step === "identity" || step === "review") {
    required(draft.fullName, "fullName", errors);
    required(draft.displayName, "displayName", errors);
  }

  if (step === "purpose" || step === "review") {
    required(draft.primaryPurpose, "primaryPurpose", errors);
    required(draft.timezone, "timezone", errors);
  }

  if ((step === "role" || step === "review") && role === "talent") {
    required(draft.developerFocus, "developerFocus", errors);
    required(draft.experienceLevel, "experienceLevel", errors);
    required(draft.availability, "availability", errors);
    if (draft.goals.length === 0) {
      errors.goals = "Choose at least one goal for your first proof path.";
    }
  }

  if ((step === "role" || step === "review") && role === "company_member") {
    required(draft.companySize, "companySize", errors);
    required(draft.hiringStage, "hiringStage", errors);
    required(draft.hiringFocus, "hiringFocus", errors);
    required(draft.companyMemberRole, "companyMemberRole", errors);
    required(draft.companyFirstAction, "companyFirstAction", errors);
  }

  if ((step === "role" || step === "review") && role === "reviewer") {
    if (draft.expertiseAreas.length === 0) {
      errors.expertiseAreas = "Choose at least one area you can review.";
    }
    required(draft.experienceEvidence, "experienceEvidence", errors);
  }

  return errors;
}

export function normalizeStoredDraft(value: unknown): OnboardingDraft {
  const parsed = onboardingDraftSchema.safeParse(
    deserializeOnboardingDraft(value)
  );
  return parsed.success ? parsed.data : emptyOnboardingDraft;
}

export function getResumeStepIndex(
  role: OnboardingRole,
  draft: OnboardingDraft,
  hasProgress: boolean
) {
  if (!hasProgress || !draft.fullName || !draft.displayName) return 0;
  if (!draft.primaryPurpose || !draft.timezone) return 1;

  if (role === "talent") {
    return draft.developerFocus &&
      draft.experienceLevel &&
      draft.goals.length > 0 &&
      draft.availability
      ? 4
      : 3;
  }
  if (role === "company_member") {
    return draft.companySize &&
      draft.hiringStage &&
      draft.hiringFocus &&
      draft.companyMemberRole &&
      draft.companyFirstAction
      ? 4
      : 3;
  }
  return draft.expertiseAreas.length > 0 && draft.experienceEvidence ? 4 : 3;
}

export function isOnboardingRole(value: unknown): value is OnboardingRole {
  return (
    typeof value === "string" &&
    onboardingRoles.includes(value as OnboardingRole)
  );
}
