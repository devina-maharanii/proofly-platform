/** Proofly Phase 14: server-only personal account mutations derive identity from verified sessions and never return passwords, tokens, or private provider data. */
"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";
import {
  securityRateLimiter,
  type SecurityRateLimitAction,
} from "@/lib/security/rate-limit";

import { getAccountSettingsContext } from "./context";
import {
  currentPasswordSchema,
  dataRightSchema,
  fieldErrors,
  formBoolean,
  notificationPreferencesSchema,
  passwordChangeSchema,
  privacySettingsSchema,
  profileSettingsSchema,
} from "./validation";
import {
  initialSettingsFormState,
  type PersonalSettings,
  type SettingsFormState,
} from "./types";

function value(formData: FormData, key: string): string {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

function errorState(
  message: string,
  fieldErrors?: Record<string, string>
): SettingsFormState {
  return { status: "error", message, fieldErrors };
}

async function requestAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

async function enforceSettingsRateLimit(
  action: SecurityRateLimitAction
): Promise<SettingsFormState | null> {
  const session = await getVerifiedAuthSession();
  if (!session) {
    return errorState("Your session has expired. Sign in again to continue.");
  }
  const result = securityRateLimiter.check(
    action,
    session.userId,
    await requestAddress()
  );
  return result.ok
    ? null
    : errorState(
        `Too many account requests. Try again in about ${result.retryAfterSeconds} seconds.`
      );
}

async function currentSettings(): Promise<PersonalSettings | null> {
  return (await getAccountSettingsContext())?.settings ?? null;
}

async function saveSettings(
  settings: PersonalSettings
): Promise<SettingsFormState | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase)
    return errorState("Account settings are unavailable. Try again later.");
  const { error } = await supabase.rpc("save_personal_settings", {
    requested_settings: {
      display_name: settings.displayName,
      avatar_url: settings.avatarUrl,
      preferred_language: settings.preferredLanguage,
      timezone: settings.timezone,
      short_bio: settings.shortBio,
      profile_visibility: settings.profileVisibility,
      proof_visibility_default: settings.proofVisibilityDefault,
      portfolio_visibility: settings.portfolioVisibility,
      contact_visibility: settings.contactVisibility,
      membership_visibility: settings.membershipVisibility,
      search_discoverability: settings.searchDiscoverability,
      data_sharing: settings.dataSharing,
      notification_preferences: settings.notifications,
    },
  });
  return error
    ? errorState("Your changes could not be saved. Try again.")
    : null;
}

async function verifyCurrentPassword(
  password: string
): Promise<SettingsFormState | null> {
  const session = await getVerifiedAuthSession();
  const supabase = await createServerSupabaseClient();
  if (!session?.email || !supabase) {
    return errorState("Your session has expired. Sign in again to continue.");
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: session.email,
    password,
  });
  return error ? errorState("Current password confirmation failed.") : null;
}

function refreshSettings() {
  revalidatePath("/settings");
}

export async function saveProfileAction(
  _previousState: SettingsFormState = initialSettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  void _previousState;
  const parsed = profileSettingsSchema.safeParse({
    displayName: value(formData, "displayName"),
    avatarUrl: value(formData, "avatarUrl"),
    preferredLanguage: "en",
    timezone: value(formData, "timezone"),
    shortBio: value(formData, "shortBio"),
  });
  if (!parsed.success)
    return errorState(
      "Check the highlighted fields.",
      fieldErrors(parsed.error)
    );
  const rateLimitFailure = await enforceSettingsRateLimit("mutation");
  if (rateLimitFailure) return rateLimitFailure;
  const existing = await currentSettings();
  if (!existing)
    return errorState("Your session has expired. Sign in again to continue.");
  const failure = await saveSettings({ ...existing, ...parsed.data });
  if (failure) return failure;
  refreshSettings();
  return { status: "success", message: "Profile basics saved." };
}

export async function savePrivacyAction(
  _previousState: SettingsFormState = initialSettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  void _previousState;
  const parsed = privacySettingsSchema.safeParse({
    profileVisibility: value(formData, "profileVisibility"),
    proofVisibilityDefault: value(formData, "proofVisibilityDefault"),
    portfolioVisibility: value(formData, "portfolioVisibility"),
    contactVisibility: value(formData, "contactVisibility"),
    membershipVisibility: value(formData, "membershipVisibility"),
    searchDiscoverability: formBoolean(formData, "searchDiscoverability"),
    dataSharing: formBoolean(formData, "dataSharing"),
  });
  if (!parsed.success)
    return errorState(
      "Check the highlighted privacy controls.",
      fieldErrors(parsed.error)
    );
  const rateLimitFailure = await enforceSettingsRateLimit("mutation");
  if (rateLimitFailure) return rateLimitFailure;
  const existing = await currentSettings();
  if (!existing)
    return errorState("Your session has expired. Sign in again to continue.");
  const failure = await saveSettings({ ...existing, ...parsed.data });
  if (failure) return failure;
  refreshSettings();
  return { status: "success", message: "Privacy defaults saved." };
}

export async function saveNotificationsAction(
  _previousState: SettingsFormState = initialSettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  void _previousState;
  const parsed = notificationPreferencesSchema.safeParse({
    email: formBoolean(formData, "email"),
    inApp: formBoolean(formData, "inApp"),
    projectUpdates: formBoolean(formData, "projectUpdates"),
    reviewUpdates: formBoolean(formData, "reviewUpdates"),
    hiringMessages: formBoolean(formData, "hiringMessages"),
    paymentUpdates: formBoolean(formData, "paymentUpdates"),
    marketing: formBoolean(formData, "marketing"),
  });
  if (!parsed.success)
    return errorState(
      "Check the notification choices.",
      fieldErrors(parsed.error)
    );
  const rateLimitFailure = await enforceSettingsRateLimit("mutation");
  if (rateLimitFailure) return rateLimitFailure;
  const existing = await currentSettings();
  if (!existing)
    return errorState("Your session has expired. Sign in again to continue.");
  const failure = await saveSettings({
    ...existing,
    notifications: parsed.data,
  });
  if (failure) return failure;
  refreshSettings();
  return { status: "success", message: "Notification preferences saved." };
}

export async function changePasswordAction(
  _previousState: SettingsFormState = initialSettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  void _previousState;
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: value(formData, "currentPassword"),
    newPassword: value(formData, "newPassword"),
    confirmPassword: value(formData, "confirmPassword"),
  });
  if (!parsed.success)
    return errorState("Check the password fields.", fieldErrors(parsed.error));
  const rateLimitFailure = await enforceSettingsRateLimit("sensitive-account");
  if (rateLimitFailure) return rateLimitFailure;
  const confirmationFailure = await verifyCurrentPassword(
    parsed.data.currentPassword
  );
  if (confirmationFailure) return confirmationFailure;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase!.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (error) return errorState("Password could not be updated. Try again.");
  await supabase!.rpc("record_account_security_event", {
    requested_event: "account.password_changed",
  });
  refreshSettings();
  return {
    status: "success",
    message: "Password changed. Review active sessions if this was unexpected.",
  };
}

export async function revokeOtherSessionsAction(
  _previousState: SettingsFormState = initialSettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  void _previousState;
  const parsed = currentPasswordSchema.safeParse({
    currentPassword: value(formData, "currentPassword"),
  });
  if (!parsed.success)
    return errorState(
      "Enter your current password.",
      fieldErrors(parsed.error)
    );
  const rateLimitFailure = await enforceSettingsRateLimit("sensitive-account");
  if (rateLimitFailure) return rateLimitFailure;
  const confirmationFailure = await verifyCurrentPassword(
    parsed.data.currentPassword
  );
  if (confirmationFailure) return confirmationFailure;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase!.auth.signOut({ scope: "others" });
  if (error)
    return errorState("Other sessions could not be revoked. Try again.");
  await supabase!.rpc("record_account_security_event", {
    requested_event: "account.sessions_revoked",
  });
  refreshSettings();
  return {
    status: "success",
    message: "Other sessions were revoked. This device remains signed in.",
  };
}

export async function disconnectGithubAction(
  _previousState: SettingsFormState = initialSettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  void _previousState;
  const parsed = currentPasswordSchema.safeParse({
    currentPassword: value(formData, "currentPassword"),
  });
  if (!parsed.success)
    return errorState(
      "Enter your current password.",
      fieldErrors(parsed.error)
    );
  const rateLimitFailure = await enforceSettingsRateLimit("sensitive-account");
  if (rateLimitFailure) return rateLimitFailure;
  const confirmationFailure = await verifyCurrentPassword(
    parsed.data.currentPassword
  );
  if (confirmationFailure) return confirmationFailure;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase!.auth.getUserIdentities();
  const githubIdentity = data?.identities.find(
    identity => identity.provider === "github"
  );
  if (error || !githubIdentity || (data?.identities.length ?? 0) < 2) {
    return errorState(
      "GitHub cannot be disconnected while it is your only sign-in method."
    );
  }
  const unlinkResult = await supabase!.auth.unlinkIdentity(githubIdentity);
  if (unlinkResult.error)
    return errorState("GitHub could not be disconnected. Try again.");
  await supabase!.rpc("record_account_security_event", {
    requested_event: "account.identity_unlinked",
  });
  refreshSettings();
  return {
    status: "success",
    message: "GitHub was disconnected from this account.",
  };
}

export async function requestDataRightAction(
  _previousState: SettingsFormState = initialSettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  void _previousState;
  const parsed = dataRightSchema.safeParse({
    requestType: value(formData, "requestType"),
    confirmation: value(formData, "confirmation"),
    currentPassword: value(formData, "currentPassword"),
  });
  if (!parsed.success)
    return errorState(
      "Confirm the request and enter your current password.",
      fieldErrors(parsed.error)
    );
  const rateLimitFailure = await enforceSettingsRateLimit("sensitive-account");
  if (rateLimitFailure) return rateLimitFailure;
  const confirmationFailure = await verifyCurrentPassword(
    parsed.data.currentPassword
  );
  if (confirmationFailure) return confirmationFailure;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase!.rpc("request_data_right", {
    request_type: parsed.data.requestType,
  });
  if (error) return errorState("The request could not be recorded. Try again.");
  refreshSettings();
  return {
    status: "success",
    message:
      parsed.data.requestType === "export"
        ? "Your personal-data export request is recorded. No private data is shown here while it is prepared."
        : "Your deletion request is scheduled with a 14-day grace period. Active company-owned records are not silently deleted.",
  };
}
