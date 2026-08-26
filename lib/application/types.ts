/** Phase 24 application contract: applications are private, talent-owned requests to a specific public Project; they are not a hiring decision, invitation, work submission, contract, payment, or trial. */
import type { CanonicalSkillKey } from "@/lib/profile/types";
import type { PublicProject } from "@/lib/project/types";

export const applicationStates = [
  "draft",
  "submitted",
  "withdrawn",
  "shortlisted",
  "invited_to_trial",
  "accepted",
  "rejected",
  "closed",
] as const;
export type ApplicationState = (typeof applicationStates)[number];

export type ApplicationProfileSnapshot = Readonly<{
  displayName: string;
  headline: string;
  developerFocus: string;
  skills: Array<{
    skillKey: CanonicalSkillKey;
    claimedLevel: string;
    context: string;
  }>;
}>;

export type ApplicationEvidenceSnapshot = Readonly<{
  evidenceId: string;
  sourceVersion: number;
  sharingChoice: "application_private_receipt";
  title: string;
  shortSummary: string;
  evidenceType: string;
  userRole: string;
  skills: Array<{ skillKey: CanonicalSkillKey; context: string }>;
}>;

export type ApplicationTermsSnapshot = Readonly<{
  projectPublicId: string;
  projectTitle: string;
  applicationDeadline: string;
  compensationStatus: string;
  workPurpose: string;
  timeboxHours: number | null;
  ownershipTerms: string;
  dataAccessRestrictions: string;
  participantExpectations: string;
  expectedResponseTime: string;
  noProductionReuse: boolean;
}>;

export type ApplicationEvent = Readonly<{
  eventType: string;
  previousState: ApplicationState | null;
  nextState: ApplicationState | null;
  occurredAt: string | null;
}>;

export type ProjectApplication = Readonly<{
  id: string;
  state: ApplicationState;
  project: Readonly<{
    publicId: string;
    title: string;
    organizationName: string;
    applicationDeadline: string;
    expectedResponseTime: string;
  }>;
  profileSnapshot: ApplicationProfileSnapshot;
  evidenceSnapshot: ApplicationEvidenceSnapshot[];
  availability: string;
  timezoneOverlap: string;
  motivation: string;
  relevantExperience: string;
  projectResponse: string;
  approach: string;
  termsConfirmed: boolean;
  termsSnapshot: ApplicationTermsSnapshot | null;
  submittedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  events: ApplicationEvent[];
}>;

export type ApplicationListItem = Readonly<{
  id: string;
  state: ApplicationState;
  projectPublicId: string;
  projectTitle: string;
  organizationName: string;
  expectedResponseTime: string;
  applicationDeadline: string;
  submittedAt: string | null;
  withdrawnAt: string | null;
  updatedAt: string | null;
}>;

export type ApplicationEditorContext = Readonly<{
  project: PublicProject;
  existingApplication: ProjectApplication | null;
  availableEvidence: Array<{
    id: string;
    title: string;
    shortSummary: string;
    evidenceType: string;
    userRole: string;
    state: string;
    version: number;
  }>;
  activeTalentContext: boolean;
  canApply: boolean;
}>;

export type CompanyApplicationReceipt = ProjectApplication &
  Readonly<{ retentionNotice: string | null }>;

export type ApplicationActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  applicationId?: string;
  fieldErrors?: Record<string, string>;
}>;

export const initialApplicationActionState: ApplicationActionState = {
  status: "idle",
  message: "",
};

export const applicationStateLabel = (state: ApplicationState) =>
  ({
    draft: "Draft",
    submitted: "Submitted",
    withdrawn: "Withdrawn",
    shortlisted: "Shortlisted",
    invited_to_trial: "Invited to trial",
    accepted: "Accepted",
    rejected: "Rejected",
    closed: "Closed",
  })[state];

export const canWithdrawApplication = (state: ApplicationState) =>
  ["draft", "submitted", "shortlisted", "invited_to_trial"].includes(state);

export const projectApplicationPath = (publicId: string) =>
  `/projects/${encodeURIComponent(publicId)}/apply`;

export const applicationPath = (applicationId: string) =>
  `/applications/${encodeURIComponent(applicationId)}`;

export const companyApplicationReceiptPath = (applicationId: string) =>
  `/company/applications/${encodeURIComponent(applicationId)}`;
