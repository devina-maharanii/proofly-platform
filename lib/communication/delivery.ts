/** Evidence Ledger Editorial — Phase 31 declares a provider-neutral delivery boundary: no email, push, or external delivery occurs until a configured adapter is approved. */
import type { CommunicationNotificationPreferences } from "./types";

export type CommunicationDeliveryChannel =
  "in_app" | "email" | "push" | "digest";
export type CommunicationDeliveryDecision =
  "delivered" | "suppressed" | "pending";

export type CommunicationDeliveryPlan = Readonly<{
  channel: CommunicationDeliveryChannel;
  decision: CommunicationDeliveryDecision;
  reason: string;
}>;

/** Maps a user preference to observable ledger decisions without contacting a provider. */
export function planCommunicationDelivery(
  preferences: CommunicationNotificationPreferences,
  requiredNotice: boolean
): readonly CommunicationDeliveryPlan[] {
  const inAppAllowed = requiredNotice || preferences.inAppEnabled;
  const emailAllowed = requiredNotice || preferences.emailEnabled;
  return [
    {
      channel: "in_app",
      decision: inAppAllowed ? "delivered" : "suppressed",
      reason: inAppAllowed ? "available_in_app" : "in_app_preference_disabled",
    },
    {
      channel: "email",
      decision: "suppressed",
      reason: emailAllowed
        ? "provider_not_configured"
        : "email_preference_disabled",
    },
    {
      channel: "push",
      decision: "suppressed",
      reason: "provider_not_configured",
    },
    {
      channel: "digest",
      decision:
        !requiredNotice &&
        emailAllowed &&
        preferences.digestFrequency === "daily"
          ? "pending"
          : "suppressed",
      reason:
        !requiredNotice &&
        emailAllowed &&
        preferences.digestFrequency === "daily"
          ? "awaiting_daily_digest"
          : "digest_not_selected",
    },
  ];
}
