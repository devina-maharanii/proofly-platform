/** Proofly Phase 13: private, progressive onboarding state; never a public profile or authorization source. */
import type { ActiveContextRole } from "@/lib/roles/types";

export const onboardingRoles = [
  "talent",
  "company_member",
  "reviewer",
] as const;

export const onboardingStates = [
  "not_started",
  "in_progress",
  "ready_for_workspace",
  "needs_review",
  "completed",
] as const;

export const talentGoals = [
  "prove_skills",
  "find_projects",
  "get_feedback",
  "find_work",
] as const;

export const reviewerExpertiseAreas = [
  "frontend",
  "backend",
  "full_stack",
  "product_engineering",
] as const;

export const companyMemberRoles = [
  "owner",
  "hiring_member",
  "reviewer_member",
  "billing_member",
  "viewer",
] as const;

export type OnboardingRole = (typeof onboardingRoles)[number];
export type OnboardingState = (typeof onboardingStates)[number];
export type TalentGoal = (typeof talentGoals)[number];
export type ReviewerExpertiseArea = (typeof reviewerExpertiseAreas)[number];
export type CompanyMemberRole = (typeof companyMemberRoles)[number];

export type OnboardingDraft = Readonly<{
  fullName: string;
  displayName: string;
  primaryPurpose: string;
  timezone: string;
  locale: "en";
  notificationEmail: boolean;
  notificationProduct: boolean;
  developerFocus: string;
  experienceLevel: string;
  goals: TalentGoal[];
  portfolioUrl: string;
  availability: string;
  companySize: string;
  hiringStage: string;
  hiringFocus: string;
  companyMemberRole: CompanyMemberRole | "";
  companyFirstAction: string;
  expertiseAreas: ReviewerExpertiseArea[];
  experienceEvidence: string;
}>;

export type OnboardingProgress = Readonly<{
  id: string;
  role: OnboardingRole;
  organizationId: string | null;
  state: OnboardingState;
  draft: OnboardingDraft;
  skippedFields: string[];
  completedAt: string | null;
  updatedAt: string;
}>;

export type OnboardingTarget = Readonly<{
  role: OnboardingRole;
  organizationId: string | null;
  activeRole: ActiveContextRole | null;
}>;

export type OnboardingActionState = Readonly<{
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}>;

export const initialOnboardingActionState: OnboardingActionState = {
  status: "idle",
};

export const emptyOnboardingDraft: OnboardingDraft = {
  fullName: "",
  displayName: "",
  primaryPurpose: "",
  timezone: "",
  locale: "en",
  notificationEmail: true,
  notificationProduct: true,
  developerFocus: "",
  experienceLevel: "",
  goals: [],
  portfolioUrl: "",
  availability: "",
  companySize: "",
  hiringStage: "",
  hiringFocus: "",
  companyMemberRole: "",
  companyFirstAction: "",
  expertiseAreas: [],
  experienceEvidence: "",
};
