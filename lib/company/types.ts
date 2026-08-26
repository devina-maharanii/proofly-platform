/** Phase 21 contract: organization-owned company context, never a project, search, hiring, billing, or private-workspace model. */
export const companyProfileStates = ["draft", "ready_to_preview"] as const;
export type CompanyProfileState = (typeof companyProfileStates)[number];

export const companyProfilePublicationStates = ["published", "hidden"] as const;
export type CompanyProfilePublicationState =
  (typeof companyProfilePublicationStates)[number];

export type CompanyProfile = Readonly<{
  organizationId: string;
  name: string;
  slug: string;
  logoUrl: string;
  shortDescription: string;
  websiteUrl: string;
  industry: string;
  companySize: string;
  foundedYear: string;
  whatWeBuild: string;
  engineeringPractices: string[];
  technologyAreas: string[];
  collaborationStyle: string;
  timezoneOverlap: string;
  workLocationPreference: string;
  typicalProjectTypes: string[];
  hiringFocus: string;
  engagementTypes: string[];
  reviewTrialPhilosophy: string;
  activeOpportunities: boolean;
  responseExpectations: string;
  draftState: CompanyProfileState;
  version: number;
}>;

export type CompanyProfilePublication = Readonly<{
  state: CompanyProfilePublicationState;
  slug: string;
  publishedAt: string | null;
  hiddenAt: string | null;
  sourceProfileVersion: number;
}>;

export type CompanyProfileAttribution = Readonly<{
  roleLabel: string;
  isPublic: boolean;
  canEdit: boolean;
  canPublish: boolean;
}>;

export type CompanyProfileContext = Readonly<{
  profile: CompanyProfile;
  publication: CompanyProfilePublication | null;
  attribution: CompanyProfileAttribution;
  activeCompanyContext: boolean;
}>;

export type CompanyProfileActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
}>;

export const initialCompanyProfileActionState: CompanyProfileActionState = {
  status: "idle",
  message: "",
};

export const emptyCompanyProfile = (
  organizationId: string,
  name: string,
  slug: string
): CompanyProfile => ({
  organizationId,
  name,
  slug,
  logoUrl: "",
  shortDescription: "",
  websiteUrl: "",
  industry: "",
  companySize: "",
  foundedYear: "",
  whatWeBuild: "",
  engineeringPractices: [],
  technologyAreas: [],
  collaborationStyle: "",
  timezoneOverlap: "",
  workLocationPreference: "",
  typicalProjectTypes: [],
  hiringFocus: "",
  engagementTypes: [],
  reviewTrialPhilosophy: "",
  activeOpportunities: false,
  responseExpectations: "",
  draftState: "draft",
  version: 1,
});
