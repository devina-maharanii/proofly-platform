import type { CanonicalSkillKey } from "@/lib/profile/types";

export const workEvidenceStates = [
  "draft",
  "private",
  "unlisted",
  "published",
  "archived",
  "under_review",
  "verified",
] as const;
export type WorkEvidenceState = (typeof workEvidenceStates)[number];

export const workEvidenceTypes = [
  "personal_project",
  "open_source_contribution",
  "coursework_project",
  "company_project",
  "freelance_project",
  "challenge_submission",
  "technical_article_or_case_study",
] as const;
export type WorkEvidenceType = (typeof workEvidenceTypes)[number];

export const workEvidenceOwnershipStatuses = [
  "owns",
  "permission_to_share",
  "public_reference",
  "restricted",
] as const;
export type WorkEvidenceOwnershipStatus =
  (typeof workEvidenceOwnershipStatuses)[number];

export const workEvidenceLinkTypes = [
  "repository",
  "demo",
  "media",
  "case_study",
  "other",
] as const;
export type WorkEvidenceLinkType = (typeof workEvidenceLinkTypes)[number];

export const workEvidenceLinkAvailabilities = [
  "available",
  "unavailable",
  "private",
] as const;
export type WorkEvidenceLinkAvailability =
  (typeof workEvidenceLinkAvailabilities)[number];

export const workEvidenceTypeLabel = (type: string) =>
  ({
    personal_project: "Personal project",
    open_source_contribution: "Open-source contribution",
    coursework_project: "Coursework project",
    company_project: "Company project",
    freelance_project: "Freelance project",
    challenge_submission: "Challenge submission",
    technical_article_or_case_study: "Technical article or case study",
  })[type] ?? "Work evidence";

export const workEvidenceStateLabel = (state: string) =>
  ({
    draft: "Draft",
    private: "Ready for private preview",
    unlisted: "Unlisted",
    published: "Published",
    archived: "Archived",
    under_review: "Under review",
    verified: "Verified",
  })[state] ?? "Unknown state";

export type WorkEvidenceSkill = Readonly<{
  skillKey: CanonicalSkillKey;
  taxonomyVersion: "1.0.0";
  context: string;
}>;

export type WorkEvidenceLink = Readonly<{
  linkType: WorkEvidenceLinkType;
  label: string;
  url: string;
  availability: WorkEvidenceLinkAvailability;
  isPublic: boolean;
}>;

export type WorkEvidenceAttribution = Readonly<{
  contributorName: string;
  contributorRole: string;
  sourceReferenceUrl: string;
  isPublic: boolean;
}>;

export type WorkEvidence = Readonly<{
  id: string;
  title: string;
  shortSummary: string;
  evidenceType: WorkEvidenceType;
  problemGoal: string;
  userRole: string;
  personalContribution: string;
  contributionScope: string;
  contextConstraints: string;
  decisionsTradeoffs: string;
  outcomeStatus: string;
  teamWork: boolean;
  ownershipStatus: WorkEvidenceOwnershipStatus;
  permissionNote: string;
  startedOn: string;
  durationText: string;
  state: WorkEvidenceState;
  version: number;
  skills: WorkEvidenceSkill[];
  links: WorkEvidenceLink[];
  attributions: WorkEvidenceAttribution[];
}>;

export type WorkEvidencePublication = Readonly<{
  publicId: string;
  state: Extract<
    WorkEvidenceState,
    "private" | "unlisted" | "published" | "archived"
  >;
  sourceVersion: number;
  publishedAt: string | null;
  hiddenAt: string | null;
  archivedAt: string | null;
}>;

export type WorkEvidenceEditorContext = Readonly<{
  evidence: WorkEvidence;
  publication: WorkEvidencePublication | null;
  activeTalentContext: boolean;
}>;

export type PublicWorkEvidence = Readonly<{
  publicId: string;
  title: string;
  shortSummary: string;
  evidenceType: WorkEvidenceType;
  problemGoal: string;
  userRole: string;
  personalContribution: string;
  contributionScope: string;
  contextConstraints: string;
  decisionsTradeoffs: string;
  outcomeStatus: string;
  teamWork: boolean;
  ownershipStatus: WorkEvidenceOwnershipStatus;
  startedOn: string;
  durationText: string;
  skills: WorkEvidenceSkill[];
  links: Array<
    Omit<WorkEvidenceLink, "isPublic"> & {
      url: string;
      availability: WorkEvidenceLinkAvailability;
    }
  >;
  attributions: Array<Omit<WorkEvidenceAttribution, "isPublic">>;
  verificationStatus: "not_verified";
  state: "unlisted" | "published";
  sourceVersion: number;
  publishedAt: string | null;
}>;

export type PublicWorkEvidenceListItem = Readonly<{
  publicId: string;
  title: string;
  shortSummary: string;
  evidenceType: WorkEvidenceType;
  userRole: string;
  skills: WorkEvidenceSkill[];
  verificationStatus: "not_verified";
  sourceVersion: number;
  publishedAt: string | null;
}>;

export type WorkEvidenceActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  evidenceId?: string;
  fieldErrors?: Record<string, string>;
}>;

export const initialWorkEvidenceActionState: WorkEvidenceActionState = {
  status: "idle",
  message: "",
};

export const emptyWorkEvidence = (): WorkEvidence => ({
  id: "",
  title: "",
  shortSummary: "",
  evidenceType: "personal_project",
  problemGoal: "",
  userRole: "",
  personalContribution: "",
  contributionScope: "",
  contextConstraints: "",
  decisionsTradeoffs: "",
  outcomeStatus: "",
  teamWork: false,
  ownershipStatus: "owns",
  permissionNote: "",
  startedOn: "",
  durationText: "",
  state: "draft",
  version: 1,
  skills: [],
  links: [],
  attributions: [],
});
