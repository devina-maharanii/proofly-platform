/** Proofly Phase 14: server-side validation for private personal settings and deliberate sensitive account requests. */
import { z } from "zod";

const optionalHttpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine(value => !value || /^https:\/\//.test(value), {
    message: "Use a secure HTTPS URL or leave this field blank.",
  });

const visibilitySchema = z.enum(["private", "public"]);
const proofVisibilitySchema = z.enum(["private", "restricted"]);

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().max(80),
  avatarUrl: optionalHttpsUrl,
  preferredLanguage: z.literal("en"),
  timezone: z.string().trim().min(1).max(80),
  shortBio: z.string().trim().max(280),
});

export const privacySettingsSchema = z.object({
  profileVisibility: visibilitySchema,
  proofVisibilityDefault: proofVisibilitySchema,
  portfolioVisibility: visibilitySchema,
  contactVisibility: visibilitySchema,
  membershipVisibility: visibilitySchema,
  searchDiscoverability: z.boolean(),
  dataSharing: z.boolean(),
});

export const notificationPreferencesSchema = z.object({
  email: z.boolean(),
  inApp: z.boolean(),
  projectUpdates: z.boolean(),
  reviewUpdates: z.boolean(),
  hiringMessages: z.boolean(),
  paymentUpdates: z.boolean(),
  marketing: z.boolean(),
});

export const currentPasswordSchema = z.object({
  currentPassword: z.string().min(8).max(256),
});

export const passwordChangeSchema = currentPasswordSchema
  .extend({
    newPassword: z.string().min(12).max(256),
    confirmPassword: z.string().min(12).max(256),
  })
  .refine(values => values.newPassword === values.confirmPassword, {
    message: "New password confirmation does not match.",
    path: ["confirmPassword"],
  });

export const dataRightSchema = currentPasswordSchema.extend({
  requestType: z.enum(["export", "deletion"]),
  confirmation: z.literal("REQUEST"),
});

export function formBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map(issue => [String(issue.path[0] ?? "form"), issue.message])
  );
}
