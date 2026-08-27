/** Evidence Ledger Editorial — Phase 32 uses source-linked fit explanations, voluntary participation, and no opaque score. */
import type { CanonicalSkillKey } from "@/lib/profile/types";

export const matchingParticipationStates = [
  "enabled",
  "paused",
  "withdrawn",
] as const;
export type MatchingParticipationState =
  (typeof matchingParticipationStates)[number];

export const matchingAvailabilityStates = [
  "unknown",
  "available",
  "limited",
  "unavailable",
] as const;
export type MatchingAvailabilityState =
  (typeof matchingAvailabilityStates)[number];

export const matchingWorkArrangements = [
  "not_specified",
  "remote",
  "hybrid",
  "onsite",
  "flexible",
] as const;
export type MatchingWorkArrangement = (typeof matchingWorkArrangements)[number];

export const matchingRequirementAvailabilityStates = [
  "not_specified",
  "available_now",
  "limited_ok",
] as const;
export type MatchingRequirementAvailability =
  (typeof matchingRequirementAvailabilityStates)[number];

export const matchingFeedbackTypes = [
  "not_relevant",
  "wrong_availability",
  "incorrect_requirement",
  "missing_source",
  "other",
] as const;
export type MatchingFeedbackType = (typeof matchingFeedbackTypes)[number];

export const matchingHumanActions = [
  "shortlist_for_review",
  "invite_for_human_review",
  "hide_from_team",
] as const;
export type MatchingHumanAction = (typeof matchingHumanActions)[number];

export type MatchingPreferences = Readonly<{
  projectRecommendationsState: MatchingParticipationState;
  companyDiscoverabilityState: MatchingParticipationState;
  availabilityStatus: MatchingAvailabilityState;
  shareAvailabilityWithCompanies: boolean;
  workArrangement: MatchingWorkArrangement;
  timezone: string;
  applicationCapacity: MatchingAvailabilityState;
  updatedAt: string | null;
}>;

export const emptyMatchingPreferences = (): MatchingPreferences => ({
  projectRecommendationsState: "withdrawn",
  companyDiscoverabilityState: "withdrawn",
  availabilityStatus: "unknown",
  shareAvailabilityWithCompanies: false,
  workArrangement: "not_specified",
  timezone: "UTC",
  applicationCapacity: "unknown",
  updatedAt: null,
});

export type MatchingProjectRequirements = Readonly<{
  projectId: string;
  projectVersion: number;
  isCurrentForProject: boolean;
  version: number;
  matchingEnabled: boolean;
  requiredEvidenceExpectations: Partial<
    Record<CanonicalSkillKey, "human_verified_public_proof" | "context_only">
  >;
  availabilityExpectation: MatchingRequirementAvailability;
  workArrangement: MatchingWorkArrangement;
  timezoneExpectation: string;
  collaborationNeeds: string;
}>;

export const emptyMatchingProjectRequirements = (
  projectId: string,
  projectVersion = 0
): MatchingProjectRequirements => ({
  projectId,
  projectVersion,
  isCurrentForProject: false,
  version: 0,
  matchingEnabled: false,
  requiredEvidenceExpectations: {},
  availabilityExpectation: "not_specified",
  workArrangement: "not_specified",
  timezoneExpectation: "",
  collaborationNeeds: "",
});

export type MatchingSource = Readonly<{
  type: "project_requirement" | "active_public_human_verified_proof";
  href: string;
  label: string;
  detail: string;
}>;

export type MatchingFitSummary = Readonly<{
  reasons: string[];
  gaps: string[];
  limitations: string[];
  ruleOrder: string[];
}>;

export type TalentProjectRecommendation = Readonly<{
  recommendationId: string;
  project: Readonly<{
    publicId: string;
    title: string;
    organizationName: string;
    requiredSkills: CanonicalSkillKey[];
    helpfulSkills: CanonicalSkillKey[];
    href: string;
  }>;
  fitSummary: MatchingFitSummary;
  sources: MatchingSource[];
}>;

export type CompanyTalentRecommendation = Readonly<{
  recommendationId: string;
  talent: Readonly<{
    handle: string;
    displayName: string;
    availability: MatchingAvailabilityState | "not_shared";
    href: string;
  }>;
  fitSummary: MatchingFitSummary;
  sources: MatchingSource[];
}>;

export type TalentMatchingContext = Readonly<{
  preferences: MatchingPreferences;
  participationState: MatchingParticipationState;
  ruleVersion: string;
  items: TalentProjectRecommendation[];
  limitations: string[];
}>;

export type CompanyMatchingContext = Readonly<{
  projectId: string;
  ruleVersion: string;
  state: "ready" | "requirements_not_current_or_project_not_recommendable";
  requirements: MatchingProjectRequirements;
  items: CompanyTalentRecommendation[];
  limitations: string[];
}>;

export type MatchingAdministrationSummary = Readonly<{
  rules: Array<{
    version: string;
    state: string;
    strategy: string;
    excludedSignals: string[];
    createdAt: string | null;
  }>;
  metrics: Array<{
    metricKey: string;
    description: string;
    measurementBoundary: string;
  }>;
  counts: Readonly<{
    activeRecommendations: number;
    feedbackRecords: number;
    reports: number;
    humanReviewActions: number;
  }>;
  audit: Array<{
    eventType: string;
    ruleVersion: string;
    occurredAt: string | null;
    metadata: Record<string, unknown>;
  }>;
}>;

export type MatchingActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
}>;

export const initialMatchingActionState: MatchingActionState = {
  status: "idle",
  message: "",
};
