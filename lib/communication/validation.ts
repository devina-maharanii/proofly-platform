/** Evidence Ledger Editorial — Phase 31 validates compact private communication payloads before server-authorized commands. */
import { z } from "zod";

import { conversationTypes } from "./types";

const uuid = z.string().uuid();
const formValue = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export const createConversationSchema = z.object({
  contextType: z.enum(conversationTypes).refine(type => type !== "trial", {
    message:
      "Paid-trial communication is unavailable until that workflow exists.",
  }),
  contextEntityId: uuid,
});

const safeBody = z
  .string()
  .trim()
  .min(1, "Write a message before sending.")
  .max(4000, "Messages are limited to 4,000 characters.")
  .refine(
    body =>
      !/(<[\s]*script|javascript\s*:|(^|\s)http:\/\/|(?:api[_ -]?key|secret\s*key|password)\s*[:=])/i.test(
        body
      ),
    "Remove unsafe links, scripts, or sensitive credentials before sending."
  );

export const sendMessageSchema = z.object({
  conversationId: uuid,
  body: safeBody,
});
export const editMessageSchema = z.object({ messageId: uuid, body: safeBody });
export const messageIdSchema = z.object({ messageId: uuid });
export const conversationIdSchema = z.object({ conversationId: uuid });
export const conversationControlSchema = z.object({
  conversationId: uuid,
  control: z.enum(["mute", "archive"]),
  enabled: z.boolean(),
});
export const reportMessageSchema = z.object({
  messageId: uuid,
  category: z.enum([
    "spam",
    "harassment",
    "unsafe_link",
    "sensitive_information",
    "other",
  ]),
  detail: z.string().trim().max(1000),
});
export const moderationSchema = z.object({
  reportId: uuid,
  action: z.enum(["none", "restrict_message"]),
  reason: z
    .string()
    .trim()
    .min(
      20,
      "Record an accountable moderation reason of at least 20 characters."
    )
    .max(1000),
});
export const notificationPreferencesSchema = z.object({
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  messageAlertsEnabled: z.boolean(),
  mentionAlertsEnabled: z.boolean(),
  digestFrequency: z.enum(["immediate", "daily", "off"]),
  quietHoursStart: z
    .string()
    .regex(/^$|^\d{2}:\d{2}$/, "Use HH:MM.")
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^$|^\d{2}:\d{2}$/, "Use HH:MM.")
    .optional(),
  timezone: z.string().trim().min(1).max(80),
});

export const parseCreateConversationForm = (formData: FormData) =>
  createConversationSchema.safeParse({
    contextType: formValue(formData, "contextType"),
    contextEntityId: formValue(formData, "contextEntityId"),
  });
export const parseSendMessageForm = (formData: FormData) =>
  sendMessageSchema.safeParse({
    conversationId: formValue(formData, "conversationId"),
    body: formValue(formData, "body"),
  });
export const parseEditMessageForm = (formData: FormData) =>
  editMessageSchema.safeParse({
    messageId: formValue(formData, "messageId"),
    body: formValue(formData, "body"),
  });
export const parseMessageIdForm = (formData: FormData) =>
  messageIdSchema.safeParse({ messageId: formValue(formData, "messageId") });
export const parseConversationIdForm = (formData: FormData) =>
  conversationIdSchema.safeParse({
    conversationId: formValue(formData, "conversationId"),
  });
export const parseConversationControlForm = (formData: FormData) =>
  conversationControlSchema.safeParse({
    conversationId: formValue(formData, "conversationId"),
    control: formValue(formData, "control"),
    enabled: formData.get("enabled") === "true",
  });
export const parseReportMessageForm = (formData: FormData) =>
  reportMessageSchema.safeParse({
    messageId: formValue(formData, "messageId"),
    category: formValue(formData, "category"),
    detail: formValue(formData, "detail"),
  });
export const parseModerationForm = (formData: FormData) =>
  moderationSchema.safeParse({
    reportId: formValue(formData, "reportId"),
    action: formValue(formData, "action"),
    reason: formValue(formData, "reason"),
  });
export const parseNotificationPreferencesForm = (formData: FormData) =>
  notificationPreferencesSchema.safeParse({
    inAppEnabled: formData.get("inAppEnabled") === "on",
    emailEnabled: formData.get("emailEnabled") === "on",
    messageAlertsEnabled: formData.get("messageAlertsEnabled") === "on",
    mentionAlertsEnabled: formData.get("mentionAlertsEnabled") === "on",
    digestFrequency: formValue(formData, "digestFrequency"),
    quietHoursStart: formValue(formData, "quietHoursStart"),
    quietHoursEnd: formValue(formData, "quietHoursEnd"),
    timezone: formValue(formData, "timezone"),
  });

export const communicationFieldErrors = (error: z.ZodError) =>
  Object.fromEntries(
    error.issues.map(issue => [issue.path.join("."), issue.message])
  );
