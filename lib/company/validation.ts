/** Phase 21 validation: preserve company draft input after recoverable errors and keep only explicit public-context fields. */
import { z } from "zod";

const secureUrl = z
  .string()
  .trim()
  .max(500)
  .refine(value => !value || /^https:\/\//.test(value), {
    message: "Use a secure HTTPS URL or leave this field blank.",
  });

const compactList = z.array(z.string().trim().min(1).max(80)).max(8);

export const companyProfileInputSchema = z
  .object({
    logoUrl: secureUrl,
    shortDescription: z.string().trim().max(280),
    websiteUrl: secureUrl,
    industry: z.string().trim().max(100),
    companySize: z.string().trim().max(80),
    foundedYear: z
      .string()
      .trim()
      .regex(/^$|^(18\d{2}|19\d{2}|20\d{2})$/, {
        message: "Use a four-digit year or leave this field blank.",
      }),
    whatWeBuild: z.string().trim().max(1200),
    engineeringPractices: compactList,
    technologyAreas: compactList,
    collaborationStyle: z.string().trim().max(240),
    timezoneOverlap: z.string().trim().max(160),
    workLocationPreference: z.string().trim().max(120),
    typicalProjectTypes: compactList,
    hiringFocus: z.string().trim().max(240),
    engagementTypes: compactList,
    reviewTrialPhilosophy: z.string().trim().max(600),
    activeOpportunities: z.boolean(),
    responseExpectations: z.string().trim().max(240),
    memberRoleLabel: z.string().trim().max(80),
    showMyAttribution: z.boolean(),
  })
  .strict();

export type CompanyProfileInput = z.infer<typeof companyProfileInputSchema>;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "true" || formData.get(key) === "on";
}

function arrayField(formData: FormData, key: string) {
  const raw = formString(formData, key);
  if (!raw || raw.length > 600) return [];
  return raw
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

export function parseCompanyProfileForm(formData: FormData) {
  return companyProfileInputSchema.safeParse({
    logoUrl: formString(formData, "logoUrl"),
    shortDescription: formString(formData, "shortDescription"),
    websiteUrl: formString(formData, "websiteUrl"),
    industry: formString(formData, "industry"),
    companySize: formString(formData, "companySize"),
    foundedYear: formString(formData, "foundedYear"),
    whatWeBuild: formString(formData, "whatWeBuild"),
    engineeringPractices: arrayField(formData, "engineeringPractices"),
    technologyAreas: arrayField(formData, "technologyAreas"),
    collaborationStyle: formString(formData, "collaborationStyle"),
    timezoneOverlap: formString(formData, "timezoneOverlap"),
    workLocationPreference: formString(formData, "workLocationPreference"),
    typicalProjectTypes: arrayField(formData, "typicalProjectTypes"),
    hiringFocus: formString(formData, "hiringFocus"),
    engagementTypes: arrayField(formData, "engagementTypes"),
    reviewTrialPhilosophy: formString(formData, "reviewTrialPhilosophy"),
    activeOpportunities: formBoolean(formData, "activeOpportunities"),
    responseExpectations: formString(formData, "responseExpectations"),
    memberRoleLabel: formString(formData, "memberRoleLabel"),
    showMyAttribution: formBoolean(formData, "showMyAttribution"),
  });
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map(issue => [String(issue.path[0] ?? "form"), issue.message])
  );
}
