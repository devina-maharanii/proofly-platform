import { z } from "zod";

import {
  canonicalSkills,
  profileFieldVisibilities,
  talentClaimLevels,
} from "./types";

const secureUrl = z
  .string()
  .trim()
  .max(500)
  .refine(value => !value || /^https:\/\//.test(value), {
    message: "Use a secure HTTPS URL or leave this field blank.",
  });

const compactList = z.array(z.string().trim().min(1).max(80)).max(8);
const skillKeys = canonicalSkills.map(skill => skill.key) as [
  string,
  ...string[],
];

export const talentProfileInputSchema = z
  .object({
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .max(40)
      .refine(
        value => !value || /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(value),
        {
          message: "Use 3–40 lowercase letters, numbers, and hyphens.",
        }
      ),
    displayName: z.string().trim().max(80),
    profileImageUrl: secureUrl,
    profileImageVisibility: z.enum(profileFieldVisibilities),
    headline: z.string().trim().max(140),
    introduction: z.string().trim().max(1200),
    locationName: z.string().trim().max(120),
    locationVisibility: z.enum(profileFieldVisibilities),
    timezone: z.string().trim().min(1).max(80),
    timezoneVisibility: z.enum(profileFieldVisibilities),
    languages: compactList,
    developerFocus: z.string().trim().max(160),
    currentExperienceLevel: z.string().trim().max(80),
    preferredProjectTypes: compactList,
    availabilityWindow: z.string().trim().max(120),
    engagementPreference: z.string().trim().max(120),
    rateRange: z.string().trim().max(80),
    timezoneOverlapPreference: z.string().trim().max(120),
    remoteCollaborationPreference: z.string().trim().max(120),
    targetOpportunityType: z.string().trim().max(120),
    skills: z
      .array(
        z.object({
          skillKey: z.enum(skillKeys),
          claimedLevel: z.enum(talentClaimLevels),
          context: z.string().trim().max(360),
        })
      )
      .max(12)
      .refine(
        skills =>
          new Set(skills.map(skill => skill.skillKey)).size === skills.length,
        { message: "Choose each canonical skill only once.", path: ["skills"] }
      ),
    links: z
      .array(
        z.object({
          linkType: z.enum(["website", "portfolio"]),
          label: z.string().trim().max(80),
          url: secureUrl.refine(value => Boolean(value), {
            message: "Provide a secure HTTPS URL.",
          }),
          isPublic: z.boolean(),
        })
      )
      .max(5)
      .refine(
        links => new Set(links.map(link => link.url)).size === links.length,
        { message: "Add each link only once.", path: ["links"] }
      ),
  })
  .strict();

export type TalentProfileInput = z.infer<typeof talentProfileInputSchema>;

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function arrayField(formData: FormData, key: string) {
  const raw = formString(formData, key);
  if (!raw || raw.length > 12000) return [];
  if (!raw.trim().startsWith("[")) {
    return raw
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseTalentProfileForm(formData: FormData) {
  return talentProfileInputSchema.safeParse({
    handle: formString(formData, "handle"),
    displayName: formString(formData, "displayName"),
    profileImageUrl: formString(formData, "profileImageUrl"),
    profileImageVisibility: formString(formData, "profileImageVisibility"),
    headline: formString(formData, "headline"),
    introduction: formString(formData, "introduction"),
    locationName: formString(formData, "locationName"),
    locationVisibility: formString(formData, "locationVisibility"),
    timezone: formString(formData, "timezone"),
    timezoneVisibility: formString(formData, "timezoneVisibility"),
    languages: arrayField(formData, "languages"),
    developerFocus: formString(formData, "developerFocus"),
    currentExperienceLevel: formString(formData, "currentExperienceLevel"),
    preferredProjectTypes: arrayField(formData, "preferredProjectTypes"),
    availabilityWindow: formString(formData, "availabilityWindow"),
    engagementPreference: formString(formData, "engagementPreference"),
    rateRange: formString(formData, "rateRange"),
    timezoneOverlapPreference: formString(
      formData,
      "timezoneOverlapPreference"
    ),
    remoteCollaborationPreference: formString(
      formData,
      "remoteCollaborationPreference"
    ),
    targetOpportunityType: formString(formData, "targetOpportunityType"),
    skills: arrayField(formData, "skills"),
    links: arrayField(formData, "links"),
  });
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map(issue => [String(issue.path[0] ?? "form"), issue.message])
  );
}
