/** Evidence Ledger Editorial — Phase 31 readers use restricted RPC projections; raw private messages and moderator records never cross this server boundary. */
import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  conversationTypes,
  type CommunicationAttachment,
  type CommunicationConversation,
  type CommunicationInboxItem,
  type CommunicationMessage,
  type CommunicationModerationReport,
  type CommunicationNotification,
  type CommunicationNotificationPreferences,
  type ConversationType,
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const stringValue = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const nullableString = (value: unknown) =>
  typeof value === "string" && value ? value : null;
const numberValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
const conversationType = (value: unknown): ConversationType | null =>
  typeof value === "string" &&
  conversationTypes.includes(value as ConversationType)
    ? (value as ConversationType)
    : null;

function inboxItem(value: unknown): CommunicationInboxItem | null {
  if (!isRecord(value)) return null;
  const contextType = conversationType(value.context_type);
  const id = stringValue(value.id);
  const contextEntityId = stringValue(value.context_entity_id);
  if (!id || !contextType || !contextEntityId) return null;
  return {
    id,
    contextType,
    contextEntityId,
    organizationId: nullableString(value.organization_id),
    archived: value.archived === true,
    muted: value.muted === true,
    lastReadAt: nullableString(value.last_read_at),
    latestMessageAt: nullableString(value.latest_message_at),
    latestMessagePreview: stringValue(value.latest_message_preview),
    unreadCount: numberValue(value.unread_count),
  };
}

function attachment(value: unknown): CommunicationAttachment | null {
  if (!isRecord(value) || !stringValue(value.id)) return null;
  return {
    id: stringValue(value.id),
    originalFilename: stringValue(
      value.original_filename,
      "Private attachment"
    ),
    contentType: stringValue(value.content_type),
    sizeBytes: numberValue(value.size_bytes),
  };
}

function message(value: unknown): CommunicationMessage | null {
  if (
    !isRecord(value) ||
    !stringValue(value.id) ||
    !stringValue(value.created_at)
  )
    return null;
  const delivery = stringValue(value.delivery_state);
  const moderation = stringValue(value.moderation_state);
  if (
    !["created", "delivered", "failed"].includes(delivery) ||
    !["visible", "reported", "restricted"].includes(moderation)
  )
    return null;
  return {
    id: stringValue(value.id),
    sequenceNumber: numberValue(value.sequence_number),
    senderIsCurrentActor: value.sender_is_current_actor === true,
    body: stringValue(value.body),
    deliveryState: delivery as CommunicationMessage["deliveryState"],
    moderationState: moderation as CommunicationMessage["moderationState"],
    editedAt: nullableString(value.edited_at),
    deletedAt: nullableString(value.deleted_at),
    createdAt: stringValue(value.created_at),
    mentionedCurrentActor: value.mentioned_current_actor === true,
    attachments: Array.isArray(value.attachments)
      ? value.attachments.flatMap(item => {
          const parsed = attachment(item);
          return parsed ? [parsed] : [];
        })
      : [],
  };
}

export async function getCommunicationInbox(): Promise<
  readonly CommunicationInboxItem[]
> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_communication_inbox", {
    maximum_count: 30,
  });
  if (error || !Array.isArray(data)) return [];
  return data.flatMap(value => {
    const parsed = inboxItem(value);
    return parsed ? [parsed] : [];
  });
}

export async function getCommunicationConversation(
  conversationId: string
): Promise<CommunicationConversation | null> {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_communication_conversation", {
    requested_conversation_id: conversationId,
    requested_before: null,
    maximum_count: 50,
  });
  if (error || !isRecord(data)) return null;
  const contextType = conversationType(data.context_type);
  if (
    !contextType ||
    !stringValue(data.id) ||
    !stringValue(data.context_entity_id)
  )
    return null;
  return {
    id: stringValue(data.id),
    contextType,
    contextEntityId: stringValue(data.context_entity_id),
    organizationId: nullableString(data.organization_id),
    state: data.state === "closed" ? "closed" : "open",
    participants: Array.isArray(data.participants)
      ? data.participants.flatMap(value => {
          if (!isRecord(value)) return [];
          const role = stringValue(value.role);
          if (
            !["talent", "company_member", "reviewer", "administrator"].includes(
              role
            )
          )
            return [];
          return [
            {
              role: role as CommunicationConversation["participants"][number]["role"],
              isCurrentActor: value.is_current_actor === true,
              leftAt: nullableString(value.left_at),
            },
          ];
        })
      : [],
    messages: Array.isArray(data.messages)
      ? data.messages.flatMap(value => {
          const parsed = message(value);
          return parsed ? [parsed] : [];
        })
      : [],
  };
}

export async function getCommunicationNotifications(): Promise<
  readonly CommunicationNotification[]
> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc(
    "get_communication_notifications",
    {
      maximum_count: 30,
    }
  );
  if (error || !Array.isArray(data)) return [];
  return data.flatMap(value => {
    if (!isRecord(value) || !stringValue(value.id)) return [];
    const priority = stringValue(value.priority);
    if (!["low", "normal", "high", "required"].includes(priority)) return [];
    return [
      {
        id: stringValue(value.id),
        notificationType: stringValue(value.notification_type),
        category: stringValue(value.category),
        priority: priority as CommunicationNotification["priority"],
        sourceEntityType: stringValue(value.source_entity_type),
        sourceEntityId: stringValue(value.source_entity_id),
        deepLink: stringValue(value.deep_link, "/messages"),
        summary: stringValue(value.summary),
        readAt: nullableString(value.read_at),
        dismissedAt: nullableString(value.dismissed_at),
        requiredNotice: value.required_notice === true,
        createdAt: stringValue(value.created_at),
      },
    ];
  });
}

export async function getCommunicationNotificationPreferences(): Promise<CommunicationNotificationPreferences> {
  const fallback: CommunicationNotificationPreferences = {
    inAppEnabled: true,
    emailEnabled: true,
    messageAlertsEnabled: true,
    mentionAlertsEnabled: true,
    digestFrequency: "immediate",
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: "UTC",
    requiredNoticeExplanation:
      "Security, payment, and legally required notices remain available even when optional alerts are off.",
  };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return fallback;
  const { data, error } = await supabase.rpc(
    "get_communication_notification_preferences"
  );
  if (error || !isRecord(data)) return fallback;
  const digest = stringValue(data.digest_frequency);
  return {
    inAppEnabled: data.in_app_enabled !== false,
    emailEnabled: data.email_enabled !== false,
    messageAlertsEnabled: data.message_alerts_enabled !== false,
    mentionAlertsEnabled: data.mention_alerts_enabled !== false,
    digestFrequency:
      digest === "daily" || digest === "off" ? digest : "immediate",
    quietHoursStart: nullableString(data.quiet_hours_start),
    quietHoursEnd: nullableString(data.quiet_hours_end),
    timezone: stringValue(data.timezone, "UTC"),
    requiredNoticeExplanation: stringValue(
      data.required_notice_explanation,
      fallback.requiredNoticeExplanation
    ),
  };
}

export async function getCommunicationModerationQueue(): Promise<
  readonly CommunicationModerationReport[]
> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc(
    "get_communication_moderation_queue",
    { maximum_count: 30 }
  );
  if (error || !Array.isArray(data)) return [];
  return data.flatMap(value => {
    if (!isRecord(value)) return [];
    const contextType = conversationType(value.context_type);
    if (
      !contextType ||
      !stringValue(value.report_id) ||
      !stringValue(value.message_id)
    )
      return [];
    return [
      {
        reportId: stringValue(value.report_id),
        category: stringValue(value.category),
        detail: stringValue(value.detail),
        createdAt: stringValue(value.created_at),
        messageId: stringValue(value.message_id),
        messageBody: stringValue(value.message_body),
        messageState: stringValue(value.message_state),
        conversationId: stringValue(value.conversation_id),
        contextType,
      },
    ];
  });
}
