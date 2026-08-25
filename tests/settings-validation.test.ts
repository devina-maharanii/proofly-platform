import { describe, expect, it } from "vitest";

import {
  currentPasswordSchema,
  dataRightSchema,
  notificationPreferencesSchema,
  passwordChangeSchema,
  privacySettingsSchema,
  profileSettingsSchema,
} from "@/lib/settings/validation";

describe("Phase 14 account-settings validation", () => {
  it("keeps profile data bounded and permits only secure avatar URLs", () => {
    expect(
      profileSettingsSchema.safeParse({
        displayName: "A".repeat(81),
        avatarUrl: "https://images.example/avatar.png",
        preferredLanguage: "en",
        timezone: "UTC",
        shortBio: "",
      }).success
    ).toBe(false);
    expect(
      profileSettingsSchema.safeParse({
        displayName: "Devina",
        avatarUrl: "http://images.example/avatar.png",
        preferredLanguage: "en",
        timezone: "UTC",
        shortBio: "Evidence-first developer.",
      }).success
    ).toBe(false);
  });

  it("defaults visibility choices to an explicit allowlist and rejects client-only roles or user identifiers", () => {
    const parsed = privacySettingsSchema.parse({
      profileVisibility: "private",
      proofVisibilityDefault: "restricted",
      portfolioVisibility: "private",
      contactVisibility: "private",
      membershipVisibility: "private",
      searchDiscoverability: false,
      dataSharing: false,
      role: "administrator",
      userId: "attacker-controlled",
    });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("userId");
    expect(
      privacySettingsSchema.safeParse({
        ...parsed,
        profileVisibility: "everyone",
      }).success
    ).toBe(false);
  });

  it("requires a deliberate, current-password-confirmed data-rights request", () => {
    expect(
      dataRightSchema.safeParse({
        requestType: "deletion",
        confirmation: "DELETE",
        currentPassword: "long-enough",
      }).success
    ).toBe(false);
    expect(
      dataRightSchema.safeParse({
        requestType: "deletion",
        confirmation: "REQUEST",
        currentPassword: "long-enough",
      }).success
    ).toBe(true);
  });

  it("requires a recent password confirmation and matching bounded password replacement", () => {
    expect(
      currentPasswordSchema.safeParse({ currentPassword: "short" }).success
    ).toBe(false);
    expect(
      passwordChangeSchema.safeParse({
        currentPassword: "current-password",
        newPassword: "new-secure-password",
        confirmPassword: "different-password",
      }).success
    ).toBe(false);
    expect(
      passwordChangeSchema.safeParse({
        currentPassword: "current-password",
        newPassword: "new-secure-password",
        confirmPassword: "new-secure-password",
      }).success
    ).toBe(true);
  });

  it("accepts only the declared privacy-safe notification preference keys", () => {
    const parsed = notificationPreferencesSchema.parse({
      email: true,
      inApp: true,
      projectUpdates: true,
      reviewUpdates: true,
      hiringMessages: true,
      paymentUpdates: false,
      marketing: false,
      rawProviderPayload: "never retained",
    });
    expect(parsed).not.toHaveProperty("rawProviderPayload");
  });
});
