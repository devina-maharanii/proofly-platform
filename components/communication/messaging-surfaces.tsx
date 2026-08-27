"use client";

/** Evidence Ledger Editorial — Phase 31 surfaces make private context, sender state, unread status, and human moderation legible without social-feed patterns. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useActionState, useEffect, useMemo, useState } from "react";

import {
  createObjectLinkedConversationAction,
  dismissCommunicationNotificationAction,
  editCommunicationMessageAction,
  leaveCommunicationConversationAction,
  markCommunicationNotificationReadAction,
  markCommunicationConversationReadAction,
  moderateCommunicationReportAction,
  redactCommunicationMessageAction,
  reportCommunicationMessageAction,
  saveCommunicationNotificationPreferencesAction,
  setCommunicationConversationControlAction,
  sendCommunicationMessageAction,
  uploadCommunicationAttachmentAction,
} from "@/lib/communication/actions";
import {
  conversationLabel,
  conversationPath,
  initialCommunicationActionState,
  type CommunicationActionState,
  type CommunicationConversation,
  type CommunicationInboxItem,
  type CommunicationModerationReport,
  type CommunicationNotification,
  type CommunicationNotificationPreferences,
  type ConversationType,
} from "@/lib/communication/types";

const dateText = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "No messages yet";

function Status({ state }: Readonly<{ state: CommunicationActionState }>) {
  if (state.status === "idle") return null;
  return (
    <p
      className="communication-status"
      data-status={state.status}
      role="status"
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

export function ContextConversationButton({
  contextType,
  contextEntityId,
  label = "Open linked conversation",
}: Readonly<{
  contextType: ConversationType;
  contextEntityId: string;
  label?: string;
}>) {
  const router = useRouter();
  const [state, action] = useActionState(
    createObjectLinkedConversationAction,
    initialCommunicationActionState
  );
  useEffect(() => {
    if (state.status === "success" && state.conversationId) {
      router.push(conversationPath(state.conversationId) as Route);
      router.refresh();
    }
  }, [router, state.conversationId, state.status]);
  return (
    <form action={action} className="communication-launcher">
      <input type="hidden" name="contextType" value={contextType} />
      <input type="hidden" name="contextEntityId" value={contextEntityId} />
      <button type="submit" className="button button-secondary">
        {label}
      </button>
      <Status state={state} />
    </form>
  );
}

export function CommunicationInbox({
  inbox,
  notifications,
  preferences,
}: Readonly<{
  inbox: readonly CommunicationInboxItem[];
  notifications: readonly CommunicationNotification[];
  preferences: CommunicationNotificationPreferences;
}>) {
  return (
    <main id="main-content" className="communication-page">
      <header className="communication-page-header">
        <p className="profile-kicker">Private communication</p>
        <h1>Messages with a verified work context</h1>
        <p>
          Every conversation is attached to an application, project, workspace,
          review, or support record. Messages do not change work, review, Proof,
          or payment state.
        </p>
      </header>
      <div className="communication-layout">
        <section className="communication-ledger" aria-labelledby="inbox-title">
          <div className="communication-section-heading">
            <h2 id="inbox-title">Inbox</h2>
            <span>
              {inbox.reduce((count, item) => count + item.unreadCount, 0)}{" "}
              unread
            </span>
          </div>
          {inbox.length ? (
            <ol className="communication-inbox-list">
              {inbox.map(item => (
                <li key={item.id}>
                  <Link
                    href={conversationPath(item.id) as Route}
                    className="communication-inbox-row"
                  >
                    <span className="communication-context">
                      {conversationLabel(item.contextType)}
                    </span>
                    <strong>
                      {item.latestMessagePreview || "Conversation ready"}
                    </strong>
                    <span>{dateText(item.latestMessageAt)}</span>
                    {item.unreadCount > 0 ? (
                      <b>{item.unreadCount} unread</b>
                    ) : (
                      <em>Read</em>
                    )}
                    {item.muted ? <small>Muted</small> : null}
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="communication-empty">
              No permitted conversations yet. Open communication only from an
              eligible work context.
            </p>
          )}
        </section>
        <aside
          className="communication-aside"
          aria-label="Notifications and delivery preferences"
        >
          <NotificationList notifications={notifications} />
          <NotificationPreferencesForm preferences={preferences} />
        </aside>
      </div>
    </main>
  );
}

export function CommunicationNotificationCenter({
  notifications,
  preferences,
}: Readonly<{
  notifications: readonly CommunicationNotification[];
  preferences: CommunicationNotificationPreferences;
}>) {
  return (
    <main id="main-content" className="communication-page">
      <header className="communication-page-header">
        <p className="profile-kicker">Private communication</p>
        <h1>Notification centre</h1>
        <p>
          Notifications remain available only while their precise conversation
          or restricted administrative context remains authorized.
        </p>
      </header>
      <div className="communication-layout">
        <section className="communication-ledger">
          <NotificationList notifications={notifications} />
        </section>
        <aside className="communication-aside">
          <NotificationPreferencesForm preferences={preferences} />
        </aside>
      </div>
    </main>
  );
}

function NotificationList({
  notifications,
}: Readonly<{ notifications: readonly CommunicationNotification[] }>) {
  const [readState, readAction] = useActionState(
    markCommunicationNotificationReadAction,
    initialCommunicationActionState
  );
  const [dismissState, dismissAction] = useActionState(
    dismissCommunicationNotificationAction,
    initialCommunicationActionState
  );
  return (
    <section
      className="communication-notifications"
      aria-labelledby="notification-title"
    >
      <div className="communication-section-heading">
        <h2 id="notification-title">Notifications</h2>
        <span>{notifications.filter(item => !item.readAt).length} new</span>
      </div>
      {notifications.length ? (
        <ol>
          {notifications.map(notification => (
            <li key={notification.id} data-priority={notification.priority}>
              <Link href={notification.deepLink as Route}>
                {notification.summary}
              </Link>
              <small>
                {notification.requiredNotice
                  ? "Required notice"
                  : notification.category}
              </small>
              <div>
                <form action={readAction}>
                  <input
                    type="hidden"
                    name="notificationId"
                    value={notification.id}
                  />
                  <button type="submit">Mark read</button>
                </form>
                {!notification.requiredNotice ? (
                  <form action={dismissAction}>
                    <input
                      type="hidden"
                      name="notificationId"
                      value={notification.id}
                    />
                    <button type="submit">Dismiss</button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="communication-empty">No active notifications.</p>
      )}
      <Status state={readState} />
      <Status state={dismissState} />
    </section>
  );
}

function NotificationPreferencesForm({
  preferences,
}: Readonly<{ preferences: CommunicationNotificationPreferences }>) {
  const [state, action] = useActionState(
    saveCommunicationNotificationPreferencesAction,
    initialCommunicationActionState
  );
  return (
    <section
      className="communication-preferences"
      aria-labelledby="preference-title"
    >
      <h2 id="preference-title">Delivery preferences</h2>
      <form action={action}>
        <label>
          <input
            type="checkbox"
            name="inAppEnabled"
            defaultChecked={preferences.inAppEnabled}
          />{" "}
          In-app alerts
        </label>
        <label>
          <input
            type="checkbox"
            name="emailEnabled"
            defaultChecked={preferences.emailEnabled}
          />{" "}
          Email alerts
        </label>
        <label>
          <input
            type="checkbox"
            name="messageAlertsEnabled"
            defaultChecked={preferences.messageAlertsEnabled}
          />{" "}
          New messages
        </label>
        <label>
          <input
            type="checkbox"
            name="mentionAlertsEnabled"
            defaultChecked={preferences.mentionAlertsEnabled}
          />{" "}
          Mentions
        </label>
        <label>
          Digest{" "}
          <select
            name="digestFrequency"
            defaultValue={preferences.digestFrequency}
          >
            <option value="immediate">Immediate</option>
            <option value="daily">Daily</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label>
          Quiet hours start{" "}
          <input
            name="quietHoursStart"
            type="time"
            defaultValue={preferences.quietHoursStart ?? ""}
          />
        </label>
        <label>
          Quiet hours end{" "}
          <input
            name="quietHoursEnd"
            type="time"
            defaultValue={preferences.quietHoursEnd ?? ""}
          />
        </label>
        <label>
          Timezone{" "}
          <input
            name="timezone"
            defaultValue={preferences.timezone}
            maxLength={80}
          />
        </label>
        <p>{preferences.requiredNoticeExplanation}</p>
        <button type="submit" className="button button-secondary">
          Save delivery preferences
        </button>
        <Status state={state} />
      </form>
    </section>
  );
}

export function CommunicationNotificationPreferencesView({
  preferences,
}: Readonly<{ preferences: CommunicationNotificationPreferences }>) {
  return (
    <main id="main-content" className="communication-page">
      <header className="communication-page-header">
        <p className="profile-kicker">Private communication</p>
        <h1>Notification delivery preferences</h1>
        <p>
          In-app notifications are available now. Email, push, and digest intent
          is recorded safely, but no external delivery provider is configured in
          this phase.
        </p>
      </header>
      <div className="communication-preference-page">
        <NotificationPreferencesForm preferences={preferences} />
      </div>
    </main>
  );
}

export function CommunicationConversationView({
  conversation,
}: Readonly<{ conversation: CommunicationConversation }>) {
  const router = useRouter();
  const [sendState, sendAction] = useActionState(
    sendCommunicationMessageAction,
    initialCommunicationActionState
  );
  const [readState, readAction] = useActionState(
    markCommunicationConversationReadAction,
    initialCommunicationActionState
  );
  const [reportState, reportAction] = useActionState(
    reportCommunicationMessageAction,
    initialCommunicationActionState
  );
  const [redactState, redactAction] = useActionState(
    redactCommunicationMessageAction,
    initialCommunicationActionState
  );
  const [editState, editAction] = useActionState(
    editCommunicationMessageAction,
    initialCommunicationActionState
  );
  const [controlState, controlAction] = useActionState(
    setCommunicationConversationControlAction,
    initialCommunicationActionState
  );
  const [leaveState, leaveAction] = useActionState(
    leaveCommunicationConversationAction,
    initialCommunicationActionState
  );
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [attachmentState, attachmentAction] = useActionState(
    async (_previousState: CommunicationActionState, formData: FormData) => {
      const result = await uploadCommunicationAttachmentAction(
        initialCommunicationActionState,
        formData
      );
      if (result.status === "success" && result.attachmentId) {
        setAttachmentIds(ids =>
          ids.includes(result.attachmentId!)
            ? ids
            : [...ids, result.attachmentId!]
        );
      }
      return result;
    },
    initialCommunicationActionState
  );
  const [networkState, setNetworkState] = useState(
    "Connected — syncing safely"
  );
  const orderedMessages = useMemo(
    () =>
      [...conversation.messages].sort(
        (left, right) => left.sequenceNumber - right.sequenceNumber
      ),
    [conversation.messages]
  );
  useEffect(() => {
    const refresh = () => {
      setNetworkState("Reconnected — checking for new messages");
      router.refresh();
    };
    const offline = () =>
      setNetworkState(
        "Offline — messages will refresh when connection returns"
      );
    window.addEventListener("online", refresh);
    window.addEventListener("offline", offline);
    const interval = window.setInterval(() => {
      if (navigator.onLine) router.refresh();
    }, 30000);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", offline);
      window.clearInterval(interval);
    };
  }, [router]);
  return (
    <main
      id="main-content"
      className="communication-page communication-conversation-page"
    >
      <Link className="communication-back" href={"/messages" as Route}>
        Back to messages
      </Link>
      <header className="communication-page-header">
        <p className="profile-kicker">
          {conversationLabel(conversation.contextType)}
        </p>
        <h1>Private, object-linked conversation</h1>
        <p>
          Context ID: <code>{conversation.contextEntityId}</code>. Participant
          access is re-checked on every read, send, file, and notification
          action.
        </p>
        <p className="communication-live-state" aria-live="polite">
          {networkState}
        </p>
      </header>
      <form action={readAction} className="communication-read-control">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <button type="submit" className="button button-ghost">
          Mark read
        </button>
        <Status state={readState} />
      </form>
      <div className="communication-lifecycle-controls">
        <form action={controlAction}>
          <input type="hidden" name="conversationId" value={conversation.id} />
          <input type="hidden" name="control" value="mute" />
          <input type="hidden" name="enabled" value="true" />
          <button type="submit">Mute alerts</button>
        </form>
        <form action={controlAction}>
          <input type="hidden" name="conversationId" value={conversation.id} />
          <input type="hidden" name="control" value="archive" />
          <input type="hidden" name="enabled" value="true" />
          <button type="submit">Archive</button>
        </form>
        <form action={leaveAction}>
          <input type="hidden" name="conversationId" value={conversation.id} />
          <button type="submit">Leave</button>
        </form>
      </div>
      <Status state={controlState} />
      <Status state={leaveState} />
      <ol
        className="communication-message-list"
        aria-label="Messages ordered from oldest to newest"
      >
        {orderedMessages.map(message => (
          <li key={message.id} data-own={message.senderIsCurrentActor}>
            <article className="communication-message">
              <header>
                <strong>
                  {message.senderIsCurrentActor
                    ? "You"
                    : "Authorized participant"}
                </strong>
                <time dateTime={message.createdAt}>
                  {dateText(message.createdAt)}
                </time>
                <span>{message.deliveryState}</span>
                {message.editedAt ? <span>Edited</span> : null}
                {message.mentionedCurrentActor ? (
                  <span>Mentioned you</span>
                ) : null}
              </header>
              <p>{message.body}</p>
              {message.attachments.length ? (
                <ul>
                  {message.attachments.map(attachment => (
                    <li key={attachment.id}>
                      <Link
                        href={`/messages/attachments/${attachment.id}` as Route}
                      >
                        {attachment.originalFilename}
                      </Link>{" "}
                      <span>Private file</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="communication-message-actions">
                {message.senderIsCurrentActor && !message.deletedAt ? (
                  <details>
                    <summary>Edit</summary>
                    <form action={editAction}>
                      <input
                        type="hidden"
                        name="messageId"
                        value={message.id}
                      />
                      <label>
                        Updated message{" "}
                        <textarea
                          name="body"
                          required
                          maxLength={4000}
                          defaultValue={message.body}
                        />
                      </label>
                      <button type="submit">Save edit</button>
                    </form>
                  </details>
                ) : null}
                {message.senderIsCurrentActor && !message.deletedAt ? (
                  <form action={redactAction}>
                    <input type="hidden" name="messageId" value={message.id} />
                    <button type="submit">Delete</button>
                  </form>
                ) : null}
                {!message.senderIsCurrentActor && !message.deletedAt ? (
                  <form action={reportAction}>
                    <input type="hidden" name="messageId" value={message.id} />
                    <input type="hidden" name="category" value="other" />
                    <input
                      type="hidden"
                      name="detail"
                      value="Reported from the linked private conversation."
                    />
                    <button type="submit">Report</button>
                  </form>
                ) : null}
              </div>
            </article>
          </li>
        ))}
      </ol>
      <Status state={reportState} />
      <Status state={redactState} />
      <Status state={editState} />
      <form action={sendAction} className="communication-composer">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <input
          type="hidden"
          name="attachmentIds"
          value={JSON.stringify(attachmentIds)}
        />
        <label htmlFor="message-body">Message</label>
        <textarea
          id="message-body"
          name="body"
          required
          maxLength={4000}
          placeholder="Clarify the linked work context. Do not include passwords, API keys, or sensitive documents."
        />
        <p>
          Attachments remain private, scanned, and available only through a
          short-lived signed link after this conversation’s participant check.
        </p>
        <button type="submit" className="button button-primary">
          Send message
        </button>
        <Status state={sendState} />
      </form>
      <form action={attachmentAction} className="communication-attachment-form">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <label htmlFor="message-attachment">
          Private attachment (maximum 5 MB)
        </label>
        <input
          id="message-attachment"
          name="attachment"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
          required
        />
        <button type="submit" className="button button-secondary">
          Validate attachment
        </button>
        <p>
          {attachmentIds.length
            ? `${attachmentIds.length} attachment${attachmentIds.length === 1 ? "" : "s"} ready for the next message.`
            : "Files are validated before becoming attachable."}
        </p>
        <Status state={attachmentState} />
      </form>
    </main>
  );
}

export function CommunicationModerationQueue({
  reports,
}: Readonly<{ reports: readonly CommunicationModerationReport[] }>) {
  const [state, action] = useActionState(
    moderateCommunicationReportAction,
    initialCommunicationActionState
  );
  return (
    <main id="main-content" className="communication-page">
      <header className="communication-page-header">
        <p className="profile-kicker">Restricted administration</p>
        <h1>Communication reports</h1>
        <p>
          Reports are not conclusions. An active administrator must record an
          accountable action; automation has no moderation authority.
        </p>
      </header>
      {reports.length ? (
        <ol className="communication-report-list">
          {reports.map(report => (
            <li key={report.reportId}>
              <article>
                <p>
                  <strong>{report.category}</strong> ·{" "}
                  {dateText(report.createdAt)}
                </p>
                <blockquote>{report.messageBody}</blockquote>
                <p>{report.detail || "No additional reporter detail."}</p>
                <form action={action}>
                  <input
                    type="hidden"
                    name="reportId"
                    value={report.reportId}
                  />
                  <label>
                    Action{" "}
                    <select name="action" defaultValue="none">
                      <option value="none">Resolve without restricting</option>
                      <option value="restrict_message">
                        Restrict visible message
                      </option>
                    </select>
                  </label>
                  <label>
                    Accountable reason{" "}
                    <textarea
                      name="reason"
                      required
                      minLength={20}
                      maxLength={1000}
                    />
                  </label>
                  <button type="submit" className="button button-secondary">
                    Record human action
                  </button>
                </form>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="communication-empty">No reports need review.</p>
      )}
      <Status state={state} />
    </main>
  );
}
