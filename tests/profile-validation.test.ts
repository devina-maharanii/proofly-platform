import { describe, expect, it } from "vitest";

import { talentProfileInputSchema } from "@/lib/profile/validation";

function validProfile(overrides: Record<string, unknown> = {}) {
  return {
    handle: "alex-dev",
    displayName: "Alex Developer",
    profileImageUrl: "",
    profileImageVisibility: "private",
    headline: "Early-career frontend developer",
    introduction: "I build accessible product interfaces.",
    locationName: "",
    locationVisibility: "private",
    timezone: "UTC+06:00",
    timezoneVisibility: "private",
    languages: ["English", "Bangla"],
    developerFocus: "Accessible frontend systems",
    currentExperienceLevel: "Early-career",
    preferredProjectTypes: ["Product UI"],
    availabilityWindow: "20 hours/week",
    engagementPreference: "Remote contract",
    rateRange: "",
    timezoneOverlapPreference: "4 hours with Europe",
    remoteCollaborationPreference: "Async-friendly",
    targetOpportunityType: "Paid trial",
    skills: [
      {
        skillKey: "typescript",
        claimedLevel: "working",
        context: "Used in a small product UI.",
      },
    ],
    links: [
      {
        linkType: "portfolio",
        label: "Portfolio",
        url: "https://example.com",
        isPublic: false,
      },
    ],
    ...overrides,
  };
}

describe("Phase 17 Talent profile validation", () => {
  it("accepts a bounded profile using canonical skill keys and contextual claimed levels", () => {
    const parsed = talentProfileInputSchema.safeParse(validProfile());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.skills[0]).toMatchObject({
        skillKey: "typescript",
        claimedLevel: "working",
      });
    }
  });

  it("rejects non-canonical skills, duplicate claims, and opaque score fields", () => {
    expect(
      talentProfileInputSchema.safeParse(
        validProfile({
          skills: [
            { skillKey: "made-up-skill", claimedLevel: "working", context: "" },
          ],
        })
      ).success
    ).toBe(false);
    expect(
      talentProfileInputSchema.safeParse(
        validProfile({
          skills: [
            { skillKey: "typescript", claimedLevel: "working", context: "" },
            { skillKey: "typescript", claimedLevel: "advanced", context: "" },
          ],
        })
      ).success
    ).toBe(false);
    expect(
      talentProfileInputSchema.safeParse({ ...validProfile(), talentScore: 99 })
        .success
    ).toBe(false);
  });

  it("rejects unsafe links and private-field visibility values outside the allowlist", () => {
    expect(
      talentProfileInputSchema.safeParse(
        validProfile({
          links: [
            {
              linkType: "portfolio",
              label: "Unsafe",
              url: "http://example.com",
              isPublic: true,
            },
          ],
        })
      ).success
    ).toBe(false);
    expect(
      talentProfileInputSchema.safeParse(
        validProfile({ profileImageVisibility: "everyone" })
      ).success
    ).toBe(false);
  });

  it("normalizes a handle and rejects reserved stable-route words", () => {
    const normalized = talentProfileInputSchema.safeParse(
      validProfile({ handle: "  Alex-Dev  " })
    );
    expect(normalized.success).toBe(true);
    if (normalized.success) expect(normalized.data.handle).toBe("alex-dev");

    for (const handle of ["talent", "settings", "api", "p"]) {
      expect(
        talentProfileInputSchema.safeParse(validProfile({ handle })).success
      ).toBe(false);
    }
  });
});
