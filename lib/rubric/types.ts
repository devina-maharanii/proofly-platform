/**
 * Design: Evidence Ledger Editorial — versioned, project-context rubric records with
 * human-readable criteria, explicit visibility, and immutable historical references.
 * Rubrics explain contextual evaluation; they never calculate a whole-person score.
 */
import type { CanonicalSkillKey } from "@/lib/profile/types";

export const rubricStates = [
  "draft",
  "ready_for_review",
  "published",
  "locked",
  "archived",
] as const;

export type RubricState = (typeof rubricStates)[number];

export const rubricStateLabel: Record<RubricState, string> = {
  draft: "Draft",
  ready_for_review: "Ready for review",
  published: "Published",
  locked: "Locked for historical use",
  archived: "Archived",
};

export const rubricVersionStates = [
  "draft",
  "published",
  "locked",
  "archived",
] as const;
export type RubricVersionState = (typeof rubricVersionStates)[number];

/**
 * A rubric explains which feedback is intentionally shareable after a later human
 * review. This phase creates controls only; it neither collects feedback nor exposes it.
 */
export const rubricFeedbackVisibilities = [
  "talent_and_company",
  "company_only",
  "reviewer_private",
] as const;
export type RubricFeedbackVisibility =
  (typeof rubricFeedbackVisibilities)[number];

export const rubricFeedbackVisibilityLabel: Record<
  RubricFeedbackVisibility,
  string
> = {
  talent_and_company: "Talent and company",
  company_only: "Company only",
  reviewer_private: "Reviewer-private working note",
};

export const rubricDescriptorLevels = [
  "not_demonstrated",
  "emerging",
  "working_in_context",
  "independent_in_context",
  "advanced_in_context",
] as const;
export type RubricDescriptorLevel = (typeof rubricDescriptorLevels)[number];

export const rubricDescriptorLevelLabel: Record<RubricDescriptorLevel, string> =
  {
    not_demonstrated: "Not demonstrated",
    emerging: "Emerging",
    working_in_context: "Working in context",
    independent_in_context: "Independent in context",
    advanced_in_context: "Advanced in context",
  };

export const rubricDimensionPriorities = [
  "essential",
  "important",
  "supporting",
] as const;
export type RubricDimensionPriority =
  (typeof rubricDimensionPriorities)[number];

export type RubricDescriptor = Readonly<{
  level: RubricDescriptorLevel;
  description: string;
}>;

export type RubricDimensionInput = Readonly<{
  id?: string;
  name: string;
  description: string;
  skillKeys: readonly CanonicalSkillKey[];
  weight: number;
  priority: RubricDimensionPriority;
  observableCriteria: readonly string[];
  evidenceExamples: readonly string[];
  commonFailureModes: readonly string[];
  reviewerGuidance: string;
  feedbackVisibility: RubricFeedbackVisibility;
  descriptors: readonly RubricDescriptor[];
}>;

export type RubricCalibrationExampleInput = Readonly<{
  id?: string;
  title: string;
  description: string;
  sourceUrl: string;
  reviewerGuidance: string;
}>;

export type RubricInput = Readonly<{
  title: string;
  projectContext: string;
  templateKey: string;
  dimensions: readonly RubricDimensionInput[];
  calibrationExamples: readonly RubricCalibrationExampleInput[];
}>;

export type RubricDimension = RubricDimensionInput &
  Readonly<{
    id: string;
    position: number;
  }>;

export type RubricCalibrationExample = RubricCalibrationExampleInput &
  Readonly<{
    id: string;
    position: number;
  }>;

export type RubricVersion = Readonly<{
  id: string;
  versionNumber: number;
  state: RubricVersionState;
  title: string;
  projectContext: string;
  templateKey: string;
  dimensions: readonly RubricDimension[];
  calibrationExamples: readonly RubricCalibrationExample[];
  createdAt: string | null;
  publishedAt: string | null;
  lockedAt: string | null;
}>;

export type ProjectRubric = Readonly<{
  id: string;
  projectId: string;
  organizationId: string;
  state: RubricState;
  currentVersion: RubricVersion | null;
  versionHistory: readonly RubricVersion[];
  archivedAt: string | null;
  updatedAt: string | null;
  canEdit: boolean;
  canPublish: boolean;
}>;

export type RubricCalibrationDisagreement = Readonly<{
  id: string;
  rubricVersionId: string;
  calibrationExampleId: string;
  viewpoint: string;
  createdAt: string | null;
}>;

export type RubricActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  rubricId?: string;
  fieldErrors?: Record<string, string>;
}>;

export const initialRubricActionState: RubricActionState = {
  status: "idle",
  message: "",
};

const allowedRubricTransitions: Readonly<
  Record<RubricState, readonly RubricState[]>
> = {
  draft: ["ready_for_review", "archived"],
  ready_for_review: ["draft", "published", "archived"],
  published: ["locked", "archived"],
  locked: ["archived"],
  archived: [],
};

/** A pure state rule; database commands independently enforce this transition map. */
export function canTransitionRubric(
  currentState: RubricState,
  requestedState: RubricState
) {
  return allowedRubricTransitions[currentState].includes(requestedState);
}

/** A historic version is never editable; corrections or updates need a new version. */
export function isImmutableRubricVersion(state: RubricVersionState) {
  return state === "published" || state === "locked" || state === "archived";
}
