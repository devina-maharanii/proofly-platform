export const talentProfileStates = ["draft", "ready_to_preview"] as const;
export type TalentProfileState = (typeof talentProfileStates)[number];

export const talentProfilePublicationStates = ["published", "hidden"] as const;
export type TalentProfilePublicationState =
  (typeof talentProfilePublicationStates)[number];

export const profileFieldVisibilities = ["private", "public"] as const;
export type ProfileFieldVisibility = (typeof profileFieldVisibilities)[number];

export const talentClaimLevels = [
  "familiar",
  "working",
  "independent",
  "advanced",
  "reviewer",
] as const;
export type TalentClaimLevel = (typeof talentClaimLevels)[number];

export const canonicalSkillFamilies = [
  {
    key: "foundations",
    label: "Foundations",
    skills: [
      ["javascript", "JavaScript"],
      ["typescript", "TypeScript"],
      ["html", "HTML"],
      ["css", "CSS"],
      ["web-accessibility", "Web accessibility"],
      ["http-web-fundamentals", "HTTP and web fundamentals"],
      ["git", "Git"],
    ],
  },
  {
    key: "frontend",
    label: "Frontend",
    skills: [
      ["react", "React"],
      ["nextjs", "Next.js"],
      ["state-management", "State management"],
      ["component-design", "Component design"],
      ["responsive-layout", "Responsive layout"],
      ["performance-optimization", "Performance optimization"],
      ["testing", "Testing"],
    ],
  },
  {
    key: "backend",
    label: "Backend",
    skills: [
      ["nodejs", "Node.js"],
      ["api-design", "API design"],
      ["authentication", "Authentication"],
      ["authorization", "Authorization"],
      ["data-validation", "Data validation"],
      ["background-jobs", "Background jobs"],
      ["observability", "Observability"],
    ],
  },
  {
    key: "data-infrastructure",
    label: "Data and infrastructure",
    skills: [
      ["postgresql", "PostgreSQL"],
      ["data-modeling", "Data modeling"],
      ["sql", "SQL"],
      ["cloud-deployment", "Cloud deployment"],
      ["ci-cd", "CI/CD"],
      ["caching", "Caching"],
      ["security-fundamentals", "Security fundamentals"],
    ],
  },
  {
    key: "product-engineering",
    label: "Product engineering",
    skills: [
      ["requirements-interpretation", "Requirements interpretation"],
      ["debugging", "Debugging"],
      ["technical-communication", "Technical communication"],
      ["code-review", "Code review"],
      ["documentation", "Documentation"],
      ["collaboration", "Collaboration"],
    ],
  },
] as const;

export const canonicalSkills = canonicalSkillFamilies.flatMap(family =>
  family.skills.map(([key, label]) => ({ key, label, family: family.label }))
);

export type CanonicalSkillKey = (typeof canonicalSkills)[number]["key"];

export const canonicalSkillLabel = (key: string) =>
  canonicalSkills.find(skill => skill.key === key)?.label ?? key;

export type TalentProfileSkill = Readonly<{
  skillKey: CanonicalSkillKey;
  claimedLevel: TalentClaimLevel;
  context: string;
}>;

export type TalentProfileLink = Readonly<{
  linkType: "website" | "portfolio";
  label: string;
  url: string;
  isPublic: boolean;
}>;

export type TalentProfile = Readonly<{
  handle: string;
  displayName: string;
  profileImageUrl: string;
  profileImageVisibility: ProfileFieldVisibility;
  headline: string;
  introduction: string;
  locationName: string;
  locationVisibility: ProfileFieldVisibility;
  timezone: string;
  timezoneVisibility: ProfileFieldVisibility;
  languages: string[];
  developerFocus: string;
  currentExperienceLevel: string;
  preferredProjectTypes: string[];
  availabilityWindow: string;
  engagementPreference: string;
  rateRange: string;
  timezoneOverlapPreference: string;
  remoteCollaborationPreference: string;
  targetOpportunityType: string;
  draftState: TalentProfileState;
  version: number;
  skills: TalentProfileSkill[];
  links: TalentProfileLink[];
}>;

export type TalentProfilePublication = Readonly<{
  state: TalentProfilePublicationState;
  handle: string;
  publishedAt: string | null;
  hiddenAt: string | null;
  sourceProfileVersion: number;
}>;

export type TalentProfileContext = Readonly<{
  profile: TalentProfile;
  publication: TalentProfilePublication | null;
  activeTalentContext: boolean;
}>;

export type ProfileActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
}>;

export const initialProfileActionState: ProfileActionState = {
  status: "idle",
  message: "",
};

export const emptyTalentProfile = (): TalentProfile => ({
  handle: "",
  displayName: "",
  profileImageUrl: "",
  profileImageVisibility: "private",
  headline: "",
  introduction: "",
  locationName: "",
  locationVisibility: "private",
  timezone: "UTC",
  timezoneVisibility: "private",
  languages: [],
  developerFocus: "",
  currentExperienceLevel: "",
  preferredProjectTypes: [],
  availabilityWindow: "",
  engagementPreference: "",
  rateRange: "",
  timezoneOverlapPreference: "",
  remoteCollaborationPreference: "",
  targetOpportunityType: "",
  draftState: "draft",
  version: 1,
  skills: [],
  links: [],
});
