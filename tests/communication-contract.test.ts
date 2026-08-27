import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { planCommunicationDelivery } from "@/lib/communication/delivery";
import {
  createConversationSchema,
  sendMessageSchema,
} from "@/lib/communication/validation";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608270042_phase31_messaging_notifications.sql"
  ),
  "utf8"
);
const hardening = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608270043_phase31_messaging_hardening.sql"
  ),
  "utf8"
);
const notificationStateHardening = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608270045_phase31_notification_state_hardening.sql"
  ),
  "utf8"
);
const context = readFileSync(
  resolve(process.cwd(), "lib/communication/context.ts"),
  "utf8"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/communication/actions.ts"),
  "utf8"
);
const surfaces = readFileSync(
  resolve(process.cwd(), "components/communication/messaging-surfaces.tsx"),
  "utf8"
);
const proxy = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");

describe("Phase 31 object-linked communication contract", () => {
  it("limits conversation types to authoritative contexts and expressly blocks trial messaging pending Phase 32", () => {
    for (const type of [
      "application",
      "project",
      "workspace",
      "review",
      "trial",
      "support",
    ]) {
      expect(migration).toContain(`'${type}'`);
    }
    expect(migration).toContain("requested_context_type = 'trial'");
    expect(
      createConversationSchema.safeParse({
        contextType: "trial",
        contextEntityId: "550e8400-e29b-41d4-a716-446655440000",
      }).success
    ).toBe(false);
    expect(
      createConversationSchema.safeParse({
        contextType: "workspace",
        contextEntityId: "550e8400-e29b-41d4-a716-446655440000",
      }).success
    ).toBe(true);
  });

  it("re-derives participant access from live application, workspace, review, support, active-role, and organization facts", () => {
    for (const guard of [
      "private.communication_actor_has_context_access",
      "private.communication_participant_still_authorized",
      "application.state in ('submitted', 'shortlisted', 'invited_to_trial', 'accepted')",
      "public.project_workspace_access_role",
      "public.is_reviewer_active_user",
      "public.has_active_platform_administrator_context",
    ]) {
      expect(migration).toContain(guard);
    }
    expect(context).toContain('rpc("get_communication_conversation"');
    expect(context).not.toMatch(
      /from\("communication_messages"\)|from\("communication_conversations"\)/
    );
  });

  it("requires safe bounded plaintext messages, server idempotency, exact ordering, revisions, and redaction rather than destructive rewrite", () => {
    expect(
      sendMessageSchema.safeParse({
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        body: "Please review the workspace brief.",
      }).success
    ).toBe(true);
    for (const unsafe of [
      "<script>alert(1)</script>",
      "javascript:alert(1)",
      "http://unsafe.example",
      "password=not-for-chat",
    ]) {
      expect(
        sendMessageSchema.safeParse({
          conversationId: "550e8400-e29b-41d4-a716-446655440000",
          body: unsafe,
        }).success
      ).toBe(false);
    }
    expect(migration).toContain(
      "unique (conversation_id, sender_user_id, idempotency_key)"
    );
    expect(migration).toContain("unique (conversation_id, sequence_number)");
    expect(migration).toContain("communication_message_revisions");
    expect(migration).toContain(
      "revision_kind in ('edited', 'redacted', 'restricted')"
    );
    expect(migration).toContain("This message was deleted by its sender.");
    expect(actions).toContain("randomUUID()");
    expect(surfaces).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("keeps attachment object keys server-generated, metadata bounded, files private, and downloads re-authorized with short-lived signed URLs", () => {
    expect(actions).toContain('createHash("sha256")');
    expect(actions).toContain("matchesMessageAttachmentSignature");
    expect(actions).toContain("/messages/${conversationId}/");
    expect(migration).toContain("proofly-message-private");
    expect(migration).toContain("size_bytes between 1 and 5242880");
    expect(migration).toContain("scan_state = 'clean'");
    expect(migration).toContain(
      "can_insert_communication_attachment_storage_object"
    );
    expect(migration).toContain("get_communication_attachment_download_target");
    expect(surfaces).toContain("Private attachment (maximum 5 MB)");
  });

  it("models mute, archive, leave, block, report, human-only moderation, and retained audit history without an autonomous decision-maker", () => {
    for (const command of [
      "set_communication_conversation_control",
      "leave_communication_conversation",
      "block_communication_participant",
      "report_communication_message",
      "moderate_communication_report",
      "communication_moderation_events",
      "report.moderated",
    ]) {
      expect(migration).toContain(command);
    }
    expect(surfaces).toContain("automation has no moderation authority");
    expect(`${migration}\n${hardening}\n${actions}\n${surfaces}`).not.toMatch(
      /ai moderator|autonomous moderation|automated final decision/i
    );
    expect(hardening).toContain(
      "on conflict (message_id, reporter_user_id) do nothing"
    );
    expect(hardening).toContain(
      "communication_reports_reporter_idempotency_idx"
    );
  });

  it("uses typed, deduplicated notification records and filters every visible notification again after its context access changes", () => {
    expect(migration).toContain(
      "unique (recipient_user_id, deduplication_key)"
    );
    expect(migration).toContain("communication_notification_type");
    expect(migration).toContain("communication_notification_category");
    expect(hardening).toContain(
      "private.communication_notification_still_authorized"
    );
    expect(hardening).toContain(
      "communication_user_has_active_administrator_context"
    );
    expect(hardening).toContain(
      "Future source types must add an explicit case"
    );
    expect(hardening).toContain("get_communication_notifications");
    expect(context).toContain("get_communication_notifications");
    expect(notificationStateHardening).toContain(
      "private.communication_notification_still_authorized"
    );
  });

  it("honors in-app, email, quiet/digest preference intent while transparently keeping unconfigured external channels provider-neutral", () => {
    const base = {
      inAppEnabled: true,
      emailEnabled: true,
      messageAlertsEnabled: true,
      mentionAlertsEnabled: true,
      digestFrequency: "daily" as const,
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "UTC",
      requiredNoticeExplanation: "Required notices remain available.",
    };
    expect(planCommunicationDelivery(base, false)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "in_app", decision: "delivered" }),
        expect.objectContaining({
          channel: "email",
          decision: "suppressed",
          reason: "provider_not_configured",
        }),
        expect.objectContaining({ channel: "digest", decision: "pending" }),
      ])
    );
    expect(
      planCommunicationDelivery(
        { ...base, inAppEnabled: false, emailEnabled: false },
        true
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "in_app", decision: "delivered" }),
        expect.objectContaining({
          channel: "email",
          reason: "provider_not_configured",
        }),
      ])
    );
    expect(hardening).toContain("notification.delivery_recorded");
  });

  it("makes all communication routes private and leaves Proof, reputation, matching, open chat, promotion, and payment workflows out of Phase 31", () => {
    for (const protectedPath of [
      "/messages",
      "/messages/:path*",
      "/notifications",
      "/notifications/:path*",
      "/admin/communication/:path*",
    ]) {
      expect(proxy).toContain(`"${protectedPath}"`);
    }
    const phaseSource = `${migration}\n${hardening}\n${context}\n${actions}\n${surfaces}`;
    expect(phaseSource).not.toMatch(
      /public social feed|cold outreach|bulk promotion|candidate discovery|reputation score|proof ranking|AI sender/i
    );
    expect(phaseSource).not.toMatch(
      /create.*contract|charge|payment checkout/i
    );
  });
});
