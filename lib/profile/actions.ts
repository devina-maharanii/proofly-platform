"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import { initialProfileActionState, type ProfileActionState } from "./types";
import { fieldErrors, parseTalentProfileForm } from "./validation";

function failure(
  message: string,
  fieldErrors?: Record<string, string>
): ProfileActionState {
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

async function profileCommand() {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "talent" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) {
    return {
      ok: false as const,
      state: failure("Your session has expired. Sign in again to continue."),
    };
  }
  if (!authorization.ok) {
    return {
      ok: false as const,
      state: failure(
        "Switch to your Talent context to edit this private profile."
      ),
    };
  }
  const limit = securityRateLimiter.check(
    "mutation",
    session.userId,
    await requestAddress()
  );
  if (!limit.ok) {
    return {
      ok: false as const,
      state: failure(
        `Too many profile changes. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  }
  return { ok: true as const, supabase };
}

function refreshProfile() {
  revalidatePath("/profile");
  revalidatePath("/talent/[handle]", "page");
}

export async function saveTalentProfileAction(
  _previousState: ProfileActionState = initialProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  void _previousState;
  const parsed = parseTalentProfileForm(formData);
  if (!parsed.success)
    return failure(
      "Check the highlighted fields and try again.",
      fieldErrors(parsed.error)
    );
  const command = await profileCommand();
  if (!command.ok) return command.state;
  const profile = parsed.data;
  const { error } = await command.supabase.rpc("save_talent_profile", {
    requested_profile: {
      handle: profile.handle,
      display_name: profile.displayName,
      profile_image_url: profile.profileImageUrl,
      profile_image_visibility: profile.profileImageVisibility,
      headline: profile.headline,
      introduction: profile.introduction,
      location_name: profile.locationName,
      location_visibility: profile.locationVisibility,
      timezone: profile.timezone,
      timezone_visibility: profile.timezoneVisibility,
      languages: profile.languages,
      developer_focus: profile.developerFocus,
      current_experience_level: profile.currentExperienceLevel,
      preferred_project_types: profile.preferredProjectTypes,
      availability_window: profile.availabilityWindow,
      engagement_preference: profile.engagementPreference,
      rate_range: profile.rateRange,
      timezone_overlap_preference: profile.timezoneOverlapPreference,
      remote_collaboration_preference: profile.remoteCollaborationPreference,
      target_opportunity_type: profile.targetOpportunityType,
    },
    requested_skills: profile.skills.map(skill => ({
      skill_key: skill.skillKey,
      claimed_level: skill.claimedLevel,
      context: skill.context,
    })),
    requested_links: profile.links.map(link => ({
      link_type: link.linkType,
      label: link.label,
      url: link.url,
      is_public: link.isPublic,
    })),
  });
  if (error) {
    return failure(
      error.code === "23505"
        ? "That public address is already in use. Choose a different one."
        : error.code === "23514"
          ? "That public address is reserved. Choose a different one."
          : "Your private draft could not be saved safely. Try again."
    );
  }
  refreshProfile();
  return { status: "success", message: "Your private profile draft is saved." };
}

async function lifecycleAction(
  action:
    | "mark_talent_profile_ready"
    | "publish_talent_profile"
    | "hide_talent_profile",
  success: string
): Promise<ProfileActionState> {
  const command = await profileCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(action);
  if (error)
    return failure(
      action === "mark_talent_profile_ready"
        ? "Add a display name, headline, focus, public address, and one claimed skill before previewing."
        : "This profile state could not be changed safely. Review your draft and try again."
    );
  refreshProfile();
  return { status: "success", message: success };
}

export async function prepareTalentProfilePreviewAction(
  _previousState: ProfileActionState = initialProfileActionState
): Promise<ProfileActionState> {
  void _previousState;
  return lifecycleAction(
    "mark_talent_profile_ready",
    "Your profile is ready for a private preview. Publishing remains a separate choice."
  );
}

export async function publishTalentProfileAction(
  _previousState: ProfileActionState = initialProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  void _previousState;
  if (formData.get("confirmPublicProfile") !== "confirmed") {
    return failure("Review the public fields and confirm before publishing.");
  }
  const command = await profileCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("publish_talent_profile", {
    acknowledged_public_fields: true,
  });
  if (error) {
    return failure(
      "This profile could not be published safely. Review your draft and try again."
    );
  }
  refreshProfile();
  return {
    status: "success",
    message:
      "Your approved public fields are now published. You can hide this profile at any time.",
  };
}

export async function hideTalentProfileAction(
  _previousState: ProfileActionState = initialProfileActionState
): Promise<ProfileActionState> {
  void _previousState;
  return lifecycleAction(
    "hide_talent_profile",
    "Your public profile is hidden. Your private draft remains available to you."
  );
}
