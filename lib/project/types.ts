/** Phase 22 contract: Projects are organization-owned, evidence-oriented opportunity definitions; this module does not create applications, workspaces, reviews, contracts, payments, or invitations. */
import type { CanonicalSkillKey } from "@/lib/profile/types";

export const projectTypes = [
  "public_challenge",
  "private_invite_only",
  "portfolio_prompt",
  "hiring_evaluation",
  "future_paid_trial",
] as const;
export type ProjectType = (typeof projectTypes)[number];

export const projectStates = [
  "draft",
  "preview",
  "published",
  "accepting_applications",
  "paused",
  "in_progress",
  "closed",
  "archived",
] as const;
export type ProjectState = (typeof projectStates)[number];

export const projectVisibility = ["public", "restricted"] as const;
export type ProjectVisibility = (typeof projectVisibility)[number];

export const compensationStatuses = [
  "paid_defined",
  "paid_to_be_agreed",
  "unpaid_evaluation",
] as const;
export type CompensationStatus = (typeof compensationStatuses)[number];

export const workPurposes = ["production_need", "evaluation_exercise"] as const;
export type WorkPurpose = (typeof workPurposes)[number];

export const rubricSetupStates = ["defined", "later"] as const;
export type RubricSetupState = (typeof rubricSetupStates)[number];

export type ProjectMilestone = Readonly<{
  name: string;
  description: string;
}>;

export type EvaluationDimension = Readonly<{
  criterion: string;
  priority: number;
}>;

export type CompanyProject = Readonly<{
  id: string;
  organizationId: string;
  publicId: string;
  projectType: ProjectType;
  state: ProjectState;
  visibility: ProjectVisibility;
  title: string;
  oneSentenceGoal: string;
  contextAndProblem: string;
  whyItMatters: string;
  expectedRole: string;
  experienceContext: string;
  requiredSkills: CanonicalSkillKey[];
  helpfulSkills: CanonicalSkillKey[];
  requiredOutput: string;
  acceptanceCriteria: string;
  submissionFormat: string;
  timeboxHours: number | null;
  milestones: ProjectMilestone[];
  outOfScope: string;
  rubricSetup: RubricSetupState;
  evaluationDimensions: EvaluationDimension[];
  reviewMethod: string;
  reviewerExpectations: string;
  revisionPolicy: string;
  decisionTimeline: string;
  compensationStatus: CompensationStatus;
  workPurpose: WorkPurpose;
  ownershipTerms: string;
  dataAccessRestrictions: string;
  participantLimit: number | null;
  applicationDeadline: string;
  participantExpectations: string;
  expectedResponseTime: string;
  noProductionReuse: boolean;
  attachmentPolicy: "no_uploads_enabled";
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type ProjectPublication = Readonly<{
  state: ProjectState;
  publicId: string;
  publishedAt: string | null;
  updatedAt: string | null;
}>;

export type CompanyProjectContext = Readonly<{
  project: CompanyProject;
  publication: ProjectPublication | null;
  activeCompanyContext: boolean;
  canEdit: boolean;
  canPublish: boolean;
}>;

export type PublicProject = Readonly<{
  publicId: string;
  projectType: ProjectType;
  state: "published" | "accepting_applications" | "paused";
  title: string;
  oneSentenceGoal: string;
  contextAndProblem: string;
  whyItMatters: string;
  expectedRole: string;
  experienceContext: string;
  requiredSkills: CanonicalSkillKey[];
  helpfulSkills: CanonicalSkillKey[];
  requiredOutput: string;
  acceptanceCriteria: string;
  submissionFormat: string;
  timeboxHours: number;
  milestones: ProjectMilestone[];
  outOfScope: string;
  rubricSetup: RubricSetupState;
  evaluationDimensions: EvaluationDimension[];
  reviewMethod: string;
  reviewerExpectations: string;
  revisionPolicy: string;
  decisionTimeline: string;
  compensationStatus: CompensationStatus;
  workPurpose: WorkPurpose;
  ownershipTerms: string;
  dataAccessRestrictions: string;
  participantLimit: number;
  applicationDeadline: string;
  participantExpectations: string;
  expectedResponseTime: string;
  noProductionReuse: boolean;
  attachmentPolicy: "no_uploads_enabled";
  organizationName: string;
  organizationSlug: string;
  publishedAt: string | null;
  updatedAt: string | null;
}>;

export type ProjectActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  projectId?: string;
  fieldErrors?: Record<string, string>;
}>;

export const initialProjectActionState: ProjectActionState = {
  status: "idle",
  message: "",
};

export const emptyCompanyProject = (organizationId = ""): CompanyProject => ({
  id: "",
  organizationId,
  publicId: "",
  projectType: "public_challenge",
  state: "draft",
  visibility: "public",
  title: "",
  oneSentenceGoal: "",
  contextAndProblem: "",
  whyItMatters: "",
  expectedRole: "",
  experienceContext: "",
  requiredSkills: [],
  helpfulSkills: [],
  requiredOutput: "",
  acceptanceCriteria: "",
  submissionFormat: "",
  timeboxHours: null,
  milestones: [],
  outOfScope: "",
  rubricSetup: "defined",
  evaluationDimensions: [],
  reviewMethod: "",
  reviewerExpectations: "",
  revisionPolicy: "",
  decisionTimeline: "",
  compensationStatus: "paid_to_be_agreed",
  workPurpose: "evaluation_exercise",
  ownershipTerms: "",
  dataAccessRestrictions: "",
  participantLimit: null,
  applicationDeadline: "",
  participantExpectations: "",
  expectedResponseTime: "",
  noProductionReuse: false,
  attachmentPolicy: "no_uploads_enabled",
  version: 1,
  createdAt: null,
  updatedAt: null,
});

export const projectTypeLabel = (projectType: ProjectType) =>
  ({
    public_challenge: "Public challenge",
    private_invite_only: "Private invite-only project",
    portfolio_prompt: "Portfolio prompt",
    hiring_evaluation: "Hiring evaluation project",
    future_paid_trial: "Future paid-trial project",
  })[projectType];

export const projectStateLabel = (state: ProjectState) =>
  state.replaceAll("_", " ");

export function publicProjectPath(publicId: string) {
  return `/projects/${encodeURIComponent(publicId)}`;
}

export function privateCompanyProjectPath(projectId: string) {
  return `/company/projects/${encodeURIComponent(projectId)}`;
}
