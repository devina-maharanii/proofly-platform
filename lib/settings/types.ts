/** Proofly Phase 14: private personal-account settings; no organization, marketplace, billing, or reviewer-payout state. */

import type { GithubIntegrationContext } from "@/lib/github/types";

export type PrivacyVisibility = "private" | "public";
export type ProofVisibility = "private" | "restricted";

export type NotificationPreferences = Readonly<{
  email: boolean;
  inApp: boolean;
  projectUpdates: boolean;
  reviewUpdates: boolean;
  hiringMessages: boolean;
  paymentUpdates: boolean;
  marketing: boolean;
}>;

export type PersonalSettings = Readonly<{
  displayName: string;
  avatarUrl: string;
  preferredLanguage: "en";
  timezone: string;
  shortBio: string;
  profileVisibility: PrivacyVisibility;
  proofVisibilityDefault: ProofVisibility;
  portfolioVisibility: PrivacyVisibility;
  contactVisibility: PrivacyVisibility;
  membershipVisibility: PrivacyVisibility;
  searchDiscoverability: boolean;
  dataSharing: boolean;
  notifications: NotificationPreferences;
  updatedAt: string | null;
}>;

export type SettingsFormState = Readonly<{
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Readonly<Record<string, string>>;
}>;

export const initialSettingsFormState: SettingsFormState = { status: "idle" };

export const defaultNotificationPreferences: NotificationPreferences = {
  email: true,
  inApp: true,
  projectUpdates: true,
  reviewUpdates: true,
  hiringMessages: true,
  paymentUpdates: true,
  marketing: false,
};

export const defaultPersonalSettings: PersonalSettings = {
  displayName: "",
  avatarUrl: "",
  preferredLanguage: "en",
  timezone: "UTC",
  shortBio: "",
  profileVisibility: "private",
  proofVisibilityDefault: "private",
  portfolioVisibility: "private",
  contactVisibility: "private",
  membershipVisibility: "private",
  searchDiscoverability: false,
  dataSharing: false,
  notifications: defaultNotificationPreferences,
  updatedAt: null,
};

export type DataRightsRequest = Readonly<{
  id: string;
  requestType: "export" | "deletion";
  status: "requested" | "cancelled" | "scheduled";
  requestedAt: string;
  scheduledFor: string | null;
}>;

export type AccountSecurityEvent = Readonly<{
  id: string;
  eventType: string;
  occurredAt: string;
}>;

export type ConnectedIdentity = Readonly<{
  provider: string;
  identityId: string;
}>;

export type AccountSettingsContext = Readonly<{
  email: string;
  emailConfirmed: boolean;
  mfaEnabled: boolean;
  settings: PersonalSettings;
  identities: readonly ConnectedIdentity[];
  activeTalentContext: boolean;
  github: GithubIntegrationContext;
  dataRightsRequests: readonly DataRightsRequest[];
  securityEvents: readonly AccountSecurityEvent[];
}>;
