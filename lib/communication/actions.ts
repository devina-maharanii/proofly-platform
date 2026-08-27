"use server";

/** Evidence Ledger Editorial — Phase 31 actions verify the session, limit abusive traffic, and delegate all context authority to guarded communication RPCs. */
import { createHash, randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  conversationPath,
  initialCommunicationActionState,
  type CommunicationActionState,
} from "./types";
import {
  communicationFieldErrors,
  parseConversationControlForm,
  parseConversationIdForm,
  parseCreateConversationForm,
  parseEditMessageForm,
  parseMessageIdForm,
  parseModerationForm,
  parseNotificationPreferencesForm,
  parseReportMessageForm,
  parseSendMessageForm,
} from "./validation";

const fail = (message: string, fieldErrors?: Record<string, string>) => ({
  status: "error" as const,
  message,
  fieldErrors,
});

async function address() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

async function command(action: "message" | "upload" | "mutation" = "message") {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext(),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase)
    return {
      ok: false as const,
      state: fail("Your session has expired. Sign in again to continue."),
    };
  if (!authorization.ok)
    return {
      ok: false as const,
      state: fail("Switch to an authorized private context before continuing."),
    };
  const limit = securityRateLimiter.check(
    action,
    session.userId,
    await address()
  );
  if (!limit.ok)
    return {
      ok: false as const,
      state: fail(
        `Too many communication requests. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  return { ok: true as const, session, supabase };
}

function refresh(conversationId?: string) {
  revalidatePath("/messages");
  revalidatePath("/admin/communication/reports");
  if (conversationId) revalidatePath(conversationPath(conversationId));
}

export async function createObjectLinkedConversationAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const parsed = parseCreateConversationForm(formData);
  if (!parsed.success)
    return fail(
      "Choose one available private work context.",
      communicationFieldErrors(parsed.error)
    );
  const request = await command("mutation");
  if (!request.ok) return request.state;
  const { data, error } = await request.supabase.rpc(
    "create_object_linked_conversation",
    {
      requested_context_type: parsed.data.contextType,
      requested_context_entity_id: parsed.data.contextEntityId,
      requested_idempotency_key: randomUUID(),
    }
  );
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const conversationId =
    typeof record?.conversation_id === "string" ? record.conversation_id : null;
  if (error || !conversationId)
    return fail(
      "This context cannot open a conversation for your current authorized role."
    );
  refresh(conversationId);
  return {
    status: "success",
    conversationId,
    message: "Private conversation ready.",
  };
}

export async function sendCommunicationMessageAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const parsed = parseSendMessageForm(formData);
  if (!parsed.success)
    return fail(
      "Check the message before sending.",
      communicationFieldErrors(parsed.error)
    );
  const request = await command("message");
  if (!request.ok) return request.state;
  const attachmentIds = (() => {
    const raw = formData.get("attachmentIds");
    if (typeof raw !== "string") return [] as string[];
    try {
      const values: unknown = JSON.parse(raw);
      return Array.isArray(values) &&
        values.length <= 4 &&
        values.every(
          value => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
        )
        ? values
        : [];
    } catch {
      return [];
    }
  })();
  const { error } = await request.supabase.rpc("send_communication_message", {
    requested_conversation_id: parsed.data.conversationId,
    requested_body: parsed.data.body,
    requested_mentioned_user_ids: [],
    requested_attachment_ids: attachmentIds,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return fail(
      "Message not sent. Your current context, participant access, safety checks, and delivery deduplication are checked again by the server."
    );
  refresh(parsed.data.conversationId);
  return { status: "success", message: "Message sent." };
}

export async function editCommunicationMessageAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const parsed = parseEditMessageForm(formData);
  if (!parsed.success)
    return fail(
      "Check the updated message.",
      communicationFieldErrors(parsed.error)
    );
  const request = await command("message");
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc("edit_communication_message", {
    requested_message_id: parsed.data.messageId,
    requested_body: parsed.data.body,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return fail("Only the original sender can edit a visible message.");
  refresh();
  return {
    status: "success",
    message:
      "Message edited. The earlier text remains in the restricted revision ledger.",
  };
}

export async function redactCommunicationMessageAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const parsed = parseMessageIdForm(formData);
  if (!parsed.success) return fail("Choose a valid message.");
  const request = await command("message");
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc("redact_communication_message", {
    requested_message_id: parsed.data.messageId,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return fail("Only the original sender can delete an available message.");
  refresh();
  return {
    status: "success",
    message: "Message deleted. Required audit history is retained.",
  };
}

export async function reportCommunicationMessageAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const parsed = parseReportMessageForm(formData);
  if (!parsed.success)
    return fail(
      "Choose a report category and keep the detail under 1,000 characters."
    );
  const request = await command("mutation");
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc("report_communication_message", {
    requested_message_id: parsed.data.messageId,
    requested_category: parsed.data.category,
    requested_detail: parsed.data.detail,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return fail("The report could not be recorded from this private context.");
  refresh();
  return {
    status: "success",
    message: "Report recorded for authorized human review.",
  };
}

export async function markCommunicationConversationReadAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const parsed = parseConversationIdForm(formData);
  if (!parsed.success) return fail("Choose a valid conversation.");
  const request = await command("mutation");
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(
    "mark_communication_conversation_read",
    {
      requested_conversation_id: parsed.data.conversationId,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail("Read state could not be updated for this conversation.");
  refresh(parsed.data.conversationId);
  return { status: "success", message: "Conversation marked read." };
}

export async function setCommunicationConversationControlAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const parsed = parseConversationControlForm(formData);
  if (!parsed.success) return fail("Choose a valid conversation control.");
  const request = await command("mutation");
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(
    "set_communication_conversation_control",
    {
      requested_conversation_id: parsed.data.conversationId,
      requested_control: parsed.data.control,
      requested_enabled: parsed.data.enabled,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail("This personal conversation setting could not be saved.");
  refresh(parsed.data.conversationId);
  return {
    status: "success",
    message: `${parsed.data.control === "mute" ? "Muted" : "Archived"} for your current private context.`,
  };
}

export async function leaveCommunicationConversationAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const parsed = parseConversationIdForm(formData);
  if (!parsed.success) return fail("Choose a valid conversation.");
  const request = await command("mutation");
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(
    "leave_communication_conversation",
    {
      requested_conversation_id: parsed.data.conversationId,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error) return fail("You cannot leave this unavailable conversation.");
  refresh(parsed.data.conversationId);
  return {
    status: "success",
    message:
      "You left this conversation. Current work-context access remains separately enforced.",
  };
}

const messageAttachmentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

function matchesMessageAttachmentSignature(bytes: Uint8Array, type: string) {
  if (type === "application/pdf")
    return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (type === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return bytes
      .slice(0, 8)
      .every(
        (byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]
      );
  if (type === "image/webp")
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return type === "text/plain" && !bytes.slice(0, 512).includes(0);
}

export async function uploadCommunicationAttachmentAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const conversationId = formData.get("conversationId");
  const candidate = formData.get("attachment");
  if (
    typeof conversationId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(conversationId) ||
    !(candidate instanceof File)
  )
    return fail("Choose one valid private attachment and conversation.");
  if (
    !messageAttachmentTypes.has(candidate.type) ||
    candidate.size < 1 ||
    candidate.size > 5 * 1024 * 1024
  )
    return fail(
      "Attachments must be PDF, JPEG, PNG, WebP, or plain text and no larger than 5 MB."
    );
  const request = await command("upload");
  if (!request.ok) return request.state;
  const bytes = new Uint8Array(await candidate.arrayBuffer());
  if (!matchesMessageAttachmentSignature(bytes, candidate.type))
    return fail("The attachment contents do not match its declared file type.");
  const safeName =
    candidate.name
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 200) || "attachment";
  const extension = safeName.includes(".")
    ? safeName.slice(safeName.lastIndexOf(".")).toLowerCase()
    : "";
  const objectKey = `${request.session.userId}/messages/${conversationId}/${randomUUID()}${extension}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { data: prepared, error: prepareError } = await request.supabase.rpc(
    "prepare_communication_attachment_upload",
    {
      requested_conversation_id: conversationId,
      requested_original_filename: safeName,
      requested_content_type: candidate.type,
      requested_size_bytes: candidate.size,
      requested_sha256: sha256,
      requested_object_key: objectKey,
      requested_idempotency_key: randomUUID(),
    }
  );
  const metadata =
    prepared && typeof prepared === "object"
      ? (prepared as Record<string, unknown>)
      : null;
  const attachmentId =
    typeof metadata?.attachment_id === "string" ? metadata.attachment_id : null;
  const bucket = typeof metadata?.bucket === "string" ? metadata.bucket : null;
  const authorizedKey =
    typeof metadata?.object_key === "string" ? metadata.object_key : null;
  if (prepareError || !attachmentId || !bucket || !authorizedKey)
    return fail(
      "Attachment preparation could not be authorized for this private conversation."
    );
  const { error: uploadError } = await request.supabase.storage
    .from(bucket)
    .upload(authorizedKey, bytes, {
      contentType: candidate.type,
      upsert: false,
    });
  if (uploadError)
    return fail(
      "Attachment upload failed before it became available to the conversation."
    );
  const { error: completeError } = await request.supabase.rpc(
    "complete_communication_attachment_upload",
    { requested_attachment_id: attachmentId }
  );
  if (completeError)
    return fail(
      "Attachment validation failed. It was not attached to a message."
    );
  refresh(conversationId);
  return {
    status: "success",
    attachmentId,
    message: "Attachment validated and ready for the next message.",
  };
}

function notificationId(formData: FormData) {
  const value = formData.get("notificationId");
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
    ? value
    : null;
}

export async function markCommunicationNotificationReadAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const requestedNotificationId = notificationId(formData);
  if (!requestedNotificationId) return fail("Choose a valid notification.");
  const request = await command("mutation");
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(
    "mark_communication_notification_read",
    {
      requested_notification_id: requestedNotificationId,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error) return fail("Notification state could not be updated.");
  refresh();
  return { status: "success", message: "Notification marked read." };
}

export async function dismissCommunicationNotificationAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const requestedNotificationId = notificationId(formData);
  if (!requestedNotificationId) return fail("Choose a valid notification.");
  const request = await command("mutation");
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(
    "dismiss_communication_notification",
    {
      requested_notification_id: requestedNotificationId,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail(
      "Required notices cannot be dismissed, and this notification may no longer be available."
    );
  refresh();
  return { status: "success", message: "Notification dismissed." };
}

export async function saveCommunicationNotificationPreferencesAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const parsed = parseNotificationPreferencesForm(formData);
  if (!parsed.success)
    return fail(
      "Check the notification preferences.",
      communicationFieldErrors(parsed.error)
    );
  const request = await command("mutation");
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(
    "save_communication_notification_preferences",
    {
      requested_in_app_enabled: parsed.data.inAppEnabled,
      requested_email_enabled: parsed.data.emailEnabled,
      requested_message_alerts_enabled: parsed.data.messageAlertsEnabled,
      requested_mention_alerts_enabled: parsed.data.mentionAlertsEnabled,
      requested_digest_frequency: parsed.data.digestFrequency,
      requested_quiet_hours_start: parsed.data.quietHoursStart || null,
      requested_quiet_hours_end: parsed.data.quietHoursEnd || null,
      requested_timezone: parsed.data.timezone,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail("Notification preferences could not be saved. Try again.");
  refresh();
  return { status: "success", message: "Notification preferences saved." };
}

export async function moderateCommunicationReportAction(
  _previousState: CommunicationActionState = initialCommunicationActionState,
  formData: FormData
): Promise<CommunicationActionState> {
  void _previousState;
  const parsed = parseModerationForm(formData);
  if (!parsed.success)
    return fail(
      "Select a moderation action and record an accountable reason.",
      communicationFieldErrors(parsed.error)
    );
  const request = await command("mutation");
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(
    "moderate_communication_report",
    {
      requested_report_id: parsed.data.reportId,
      requested_action: parsed.data.action,
      requested_reason: parsed.data.reason,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail(
      "Only an active administrator can resolve this report with an accountable human action."
    );
  refresh();
  return {
    status: "success",
    message: "Report resolved and audit event recorded.",
  };
}
