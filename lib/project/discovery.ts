/** Phase 23 deterministic discovery: browser URL state is bounded, governed, and free of inferred talent attributes or opaque ranking inputs. */
import { z } from "zod";

import {
  canonicalSkillFamilies,
  canonicalSkills,
  talentClaimLevels,
  type CanonicalSkillKey,
} from "@/lib/profile/types";

import {
  compensationStatuses,
  projectDiscoveryDeadlines,
  projectDiscoverySorts,
  projectDiscoveryTimeboxes,
  projectDiscoveryWorkModes,
  projectTypes,
  type ProjectDiscoveryFilters,
} from "./types";

const canonicalSkillKeys = canonicalSkills.map(skill => skill.key) as [
  CanonicalSkillKey,
  ...CanonicalSkillKey[],
];
const familyKeys = canonicalSkillFamilies.map(family => family.key) as [
  string,
  ...string[],
];
const publicProjectTypes = projectTypes.filter(
  type => type !== "private_invite_only"
) as [
  Exclude<(typeof projectTypes)[number], "private_invite_only">,
  ...Exclude<(typeof projectTypes)[number], "private_invite_only">[],
];

const optionalEnum = <const T extends readonly [string, ...string[]]>(
  values: T
) =>
  z
    .union([z.enum(values), z.literal("")])
    .catch("")
    .default("");

const searchParamSchema = z.object({
  q: z.string().trim().max(160).catch("").default(""),
  skill: optionalEnum(canonicalSkillKeys),
  family: optionalEnum(familyKeys),
  level: optionalEnum(talentClaimLevels),
  type: optionalEnum(publicProjectTypes),
  timebox: optionalEnum(projectDiscoveryTimeboxes),
  compensation: optionalEnum(compensationStatuses),
  mode: z.enum(projectDiscoveryWorkModes).catch("any").default("any"),
  timezone: z.string().trim().max(80).catch("").default(""),
  deadline: z.enum(projectDiscoveryDeadlines).catch("any").default("any"),
  company: z.string().trim().max(80).catch("").default(""),
  sort: z.enum(projectDiscoverySorts).catch("relevance").default("relevance"),
  saved: z.enum(["1", ""]).catch("").default(""),
  cursor: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,420}$/)
    .catch("")
    .default(""),
});

export type ProjectDiscoveryUrlState = ProjectDiscoveryFilters & {
  cursor: string;
};

export const emptyProjectDiscoveryFilters: ProjectDiscoveryFilters = {
  query: "",
  skill: "",
  skillFamily: "",
  skillLevelContext: "",
  projectType: "",
  timebox: "",
  compensation: "",
  workMode: "any",
  timezone: "",
  deadline: "any",
  companySize: "",
  sort: "relevance",
  savedOnly: false,
};

export function parseProjectDiscoverySearchParams(
  input: Record<string, string | string[] | undefined>
): ProjectDiscoveryUrlState {
  const value = (key: string) => {
    const current = input[key];
    return Array.isArray(current) ? current[0] : current;
  };
  const parsed = searchParamSchema.parse({
    q: value("q"),
    skill: value("skill"),
    family: value("family"),
    level: value("level"),
    type: value("type"),
    timebox: value("timebox"),
    compensation: value("compensation"),
    mode: value("mode"),
    timezone: value("timezone"),
    deadline: value("deadline"),
    company: value("company"),
    sort: value("sort"),
    saved: value("saved"),
    cursor: value("cursor"),
  });
  return {
    query: parsed.q,
    skill: parsed.skill,
    skillFamily: parsed.family,
    skillLevelContext: parsed.level,
    projectType: parsed.type,
    timebox: parsed.timebox,
    compensation: parsed.compensation,
    workMode: parsed.mode,
    timezone: parsed.timezone,
    deadline: parsed.deadline,
    companySize: parsed.company,
    sort: parsed.sort,
    savedOnly: parsed.saved === "1",
    cursor: parsed.cursor,
  };
}

export function projectDiscoveryQueryString(
  filters: ProjectDiscoveryUrlState | ProjectDiscoveryFilters,
  cursor = ""
) {
  const params = new URLSearchParams();
  const add = (key: string, value: string) => {
    if (value) params.set(key, value);
  };
  add("q", filters.query);
  add("skill", filters.skill);
  add("family", filters.skillFamily);
  add("level", filters.skillLevelContext);
  add("type", filters.projectType);
  add("timebox", filters.timebox);
  add("compensation", filters.compensation);
  if (filters.workMode !== "any") params.set("mode", filters.workMode);
  add("timezone", filters.timezone);
  if (filters.deadline !== "any") params.set("deadline", filters.deadline);
  add("company", filters.companySize);
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.savedOnly) params.set("saved", "1");
  add("cursor", cursor);
  const query = params.toString();
  return query ? `/projects?${query}` : "/projects";
}

export function discoveryFilterPayload(filters: ProjectDiscoveryFilters) {
  return {
    skill: filters.skill,
    family: filters.skillFamily,
    level: filters.skillLevelContext,
    type: filters.projectType,
    timebox: filters.timebox,
    compensation: filters.compensation,
    mode: filters.workMode,
    timezone: filters.timezone,
    deadline: filters.deadline,
    company_size: filters.companySize,
    sort: filters.sort,
  };
}

export function activeDiscoveryFilterCount(filters: ProjectDiscoveryFilters) {
  return [
    filters.query,
    filters.skill,
    filters.skillFamily,
    filters.skillLevelContext,
    filters.projectType,
    filters.timebox,
    filters.compensation,
    filters.workMode === "any" ? "" : filters.workMode,
    filters.timezone,
    filters.deadline === "any" ? "" : filters.deadline,
    filters.companySize,
    filters.sort === "relevance" ? "" : filters.sort,
  ].filter(Boolean).length;
}
