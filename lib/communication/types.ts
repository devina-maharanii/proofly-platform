/** Evidence Ledger Editorial — Phase 31 communication is private, object-linked, auditable, and never a public social feed. */

export const conversationTypes = [
  "application",
  "project",
  "workspace",
  "review",
  "trial",
  "support",
] as const;
export type ConversationType = (typeof conversationTypes)[number];

export type CommunicationActionState = Readonly<{
  status: "idle" | "success" | "error";
  message?: string;
  conversationId?: string;
  attachmentId?: string;
  fieldErrors?: Readonly<Record<string, string>>;
}>;

export const initialCommunicationActionState: CommunicationActionState = {
  status: "idle",
};

export type CommunicationInboxItem = Readonly<{
  id: string;
  contextType: ConversationType;
  contextEntityId: string;
  organizationId: string | null;
  archived: boolean;
  muted: boolean;
  lastReadAt: string | null;
  latestMessageAt: string | null;
  latestMessagePreview: string;
  unreadCount: number;
}>;

export type CommunicationAttachment = Readonly<{
  id: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
}>;

export type CommunicationMessage = Readonly<{
  id: string;
  sequenceNumber: number;
  senderIsCurrentActor: boolean;
  body: string;
  deliveryState: "created" | "delivered" | "failed";
  moderationState: "visible" | "reported" | "restricted";
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  mentionedCurrentActor: boolean;
  attachments: readonly CommunicationAttachment[];
}>;

export type CommunicationConversation = Readonly<{
  id: string;
  contextType: ConversationType;
  contextEntityId: string;
  organizationId: string | null;
  state: "open" | "closed";
  participants: readonly Readonly<{
    role: "talent" | "company_member" | "reviewer" | "administrator";
    isCurrentActor: boolean;
    leftAt: string | null;
  }>[];
  messages: readonly CommunicationMessage[];
}>;

export type CommunicationNotification = Readonly<{
  id: string;
  notificationType: string;
  category: string;
  priority: "low" | "normal" | "high" | "required";
  sourceEntityType: string;
  sourceEntityId: string;
  deepLink: string;
  summary: string;
  readAt: string | null;
  dismissedAt: string | null;
  requiredNotice: boolean;
  createdAt: string;
}>;

export type CommunicationNotificationPreferences = Readonly<{
  inAppEnabled: boolean;
  emailEnabled: boolean;
  messageAlertsEnabled: boolean;
  mentionAlertsEnabled: boolean;
  digestFrequency: "immediate" | "daily" | "off";
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  requiredNoticeExplanation: string;
}>;

export type CommunicationModerationReport = Readonly<{
  reportId: string;
  category: string;
  detail: string;
  createdAt: string;
  messageId: string;
  messageBody: string;
  messageState: string;
  conversationId: string;
  contextType: ConversationType;
}>;

export const conversationLabel = (type: ConversationType) =>
  ({
    application: "Application conversation",
    project: "Project discussion",
    workspace: "Workspace discussion",
    review: "Review clarification",
    trial: "Paid trial coordination",
    support: "Platform support",
  })[type];

export const conversationPath = (conversationId: string) =>
  `/messages/${conversationId}`;
