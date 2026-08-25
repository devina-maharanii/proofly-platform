/** Proofly Phase 14: server-only private account-settings reader; all records remain owner-scoped through RLS. */
import "server-only";

import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";
import { getGithubIntegrationContext } from "@/lib/github/context";
import { emptyGithubIntegrationContext } from "@/lib/github/types";
import { authorizeActiveContext } from "@/lib/roles/context";

import {
  defaultNotificationPreferences,
  defaultPersonalSettings,
  type AccountSettingsContext,
  type AccountSecurityEvent,
  type ConnectedIdentity,
  type DataRightsRequest,
  type PersonalSettings,
} from "./types";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSettings(
  row: Record<string, unknown> | null
): PersonalSettings {
  if (!row) return defaultPersonalSettings;
  const preferences =
    row.notification_preferences &&
    typeof row.notification_preferences === "object"
      ? (row.notification_preferences as Record<string, unknown>)
      : {};
  return {
    displayName: stringValue(row.display_name),
    avatarUrl: stringValue(row.avatar_url),
    preferredLanguage: "en",
    timezone: stringValue(row.timezone, "UTC"),
    shortBio: stringValue(row.short_bio),
    profileVisibility:
      row.profile_visibility === "public" ? "public" : "private",
    proofVisibilityDefault:
      row.proof_visibility_default === "restricted" ? "restricted" : "private",
    portfolioVisibility:
      row.portfolio_visibility === "public" ? "public" : "private",
    contactVisibility:
      row.contact_visibility === "public" ? "public" : "private",
    membershipVisibility:
      row.membership_visibility === "public" ? "public" : "private",
    searchDiscoverability: booleanValue(row.search_discoverability),
    dataSharing: booleanValue(row.data_sharing),
    notifications: {
      email: booleanValue(
        preferences.email,
        defaultNotificationPreferences.email
      ),
      inApp: booleanValue(
        preferences.inApp,
        defaultNotificationPreferences.inApp
      ),
      projectUpdates: booleanValue(
        preferences.projectUpdates,
        defaultNotificationPreferences.projectUpdates
      ),
      reviewUpdates: booleanValue(
        preferences.reviewUpdates,
        defaultNotificationPreferences.reviewUpdates
      ),
      hiringMessages: booleanValue(
        preferences.hiringMessages,
        defaultNotificationPreferences.hiringMessages
      ),
      paymentUpdates: booleanValue(
        preferences.paymentUpdates,
        defaultNotificationPreferences.paymentUpdates
      ),
      marketing: booleanValue(
        preferences.marketing,
        defaultNotificationPreferences.marketing
      ),
    },
    updatedAt: stringValue(row.updated_at) || null,
  };
}

export async function getAccountSettingsContext(): Promise<AccountSettingsContext | null> {
  const [session, supabase, talentAuthorization] = await Promise.all([
    getVerifiedAuthSession(),
    createServerSupabaseClient(),
    authorizeActiveContext({ role: "talent" }),
  ]);
  if (!session || !supabase) return null;

  const [
    settingsResult,
    requestsResult,
    eventsResult,
    userResult,
    factorsResult,
    identitiesResult,
    github,
  ] = await Promise.all([
    supabase.from("personal_settings").select("*").maybeSingle(),
    supabase
      .from("data_rights_requests")
      .select("id, request_type, status, requested_at, scheduled_for")
      .order("requested_at", { ascending: false })
      .limit(4),
    supabase
      .from("account_security_events")
      .select("id, event_type, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(10),
    supabase.auth.getUser(),
    supabase.auth.mfa.listFactors(),
    supabase.auth.getUserIdentities(),
    talentAuthorization.ok
      ? getGithubIntegrationContext(session.userId)
      : Promise.resolve({
          ...emptyGithubIntegrationContext,
          configured: false,
        }),
  ]);

  const factors = factorsResult.data?.all ?? [];
  const identities = (identitiesResult.data?.identities ?? []).flatMap(
    identity =>
      typeof identity.provider === "string" &&
      typeof identity.identity_id === "string"
        ? [
            {
              provider: identity.provider,
              identityId: identity.identity_id,
            } satisfies ConnectedIdentity,
          ]
        : []
  );

  return {
    email: session.email ?? "",
    emailConfirmed: Boolean(userResult.data.user?.email_confirmed_at),
    mfaEnabled: factors.some(factor => factor.status === "verified"),
    settings: normalizeSettings(
      settingsResult.data as Record<string, unknown> | null
    ),
    identities,
    activeTalentContext: talentAuthorization.ok,
    github,
    dataRightsRequests: (requestsResult.data ?? []).flatMap(row =>
      (row.request_type === "export" || row.request_type === "deletion") &&
      (row.status === "requested" ||
        row.status === "cancelled" ||
        row.status === "scheduled")
        ? [
            {
              id: row.id,
              requestType: row.request_type,
              status: row.status,
              requestedAt: row.requested_at,
              scheduledFor: row.scheduled_for,
            } satisfies DataRightsRequest,
          ]
        : []
    ),
    securityEvents: (eventsResult.data ?? []).map(
      row =>
        ({
          id: row.id,
          eventType: row.event_type,
          occurredAt: row.occurred_at,
        }) satisfies AccountSecurityEvent
    ),
  };
}
