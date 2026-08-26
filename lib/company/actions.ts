"use server";

/** Phase 21 server actions: profile fields are organization-scoped, authorized on the server, rate-limited, and never create projects, hiring, billing, or private workspace administration. */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  initialCompanyProfileActionState,
  type CompanyProfileActionState,
} from "./types";
import { fieldErrors, parseCompanyProfileForm } from "./validation";

function failure(
  message: string,
  fieldErrors?: Record<string, string>
): CompanyProfileActionState {
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

async function companyProfileCommand() {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "company_member" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) {
    return {
      ok: false as const,
      state: failure("Your session has expired. Sign in again to continue."),
    };
  }
  if (!authorization.ok || !authorization.context.active?.organizationId) {
    return {
      ok: false as const,
      state: failure(
        "Switch to an active company context to edit this private company profile."
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
        `Too many company profile changes. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  }
  return {
    ok: true as const,
    supabase,
    organizationId: authorization.context.active.organizationId,
  };
}

function refreshCompanyProfile(slug?: string) {
  revalidatePath("/company/profile");
  revalidatePath("/auth/continue");
  revalidatePath("/companies/[slug]", "page");
  if (slug) revalidatePath(`/companies/${slug}`);
}

export async function saveCompanyProfileAction(
  _previousState: CompanyProfileActionState = initialCompanyProfileActionState,
  formData: FormData
): Promise<CompanyProfileActionState> {
  void _previousState;
  const parsed = parseCompanyProfileForm(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and try again.",
      fieldErrors(parsed.error)
    );
  }
  const command = await companyProfileCommand();
  if (!command.ok) return command.state;
  const profile = parsed.data;
  const { error } = await command.supabase.rpc("save_company_profile", {
    requested_profile: {
      logo_url: profile.logoUrl,
      short_description: profile.shortDescription,
      website_url: profile.websiteUrl,
      industry: profile.industry,
      company_size: profile.companySize,
      founded_year: profile.foundedYear,
      what_we_build: profile.whatWeBuild,
      engineering_practices: profile.engineeringPractices,
      technology_areas: profile.technologyAreas,
      collaboration_style: profile.collaborationStyle,
      timezone_overlap: profile.timezoneOverlap,
      work_location_preference: profile.workLocationPreference,
      typical_project_types: profile.typicalProjectTypes,
      hiring_focus: profile.hiringFocus,
      engagement_types: profile.engagementTypes,
      review_trial_philosophy: profile.reviewTrialPhilosophy,
      active_opportunities: profile.activeOpportunities,
      response_expectations: profile.responseExpectations,
    },
    requested_member_role: profile.memberRoleLabel,
    requested_member_is_public: profile.showMyAttribution,
  });
  if (error) {
    return failure(
      error.code === "42501"
        ? "Your company context does not allow this profile change."
        : "Your private company draft could not be saved safely. Try again."
    );
  }
  refreshCompanyProfile();
  return {
    status: "success",
    message: "Your private company profile draft is saved.",
  };
}

async function lifecycleAction(
  action:
    | "mark_company_profile_ready"
    | "publish_company_profile"
    | "hide_company_profile",
  success: string
): Promise<CompanyProfileActionState> {
  const command = await companyProfileCommand();
  if (!command.ok) return command.state;
  const { data, error } = await command.supabase.rpc(action);
  if (error) {
    return failure(
      action === "mark_company_profile_ready"
        ? "Add a clear description, work context, hiring context, and usable public company address before previewing."
        : "This company profile state could not be changed safely. Review the private draft and try again."
    );
  }
  const result = data as { slug?: unknown } | null;
  refreshCompanyProfile(
    result && typeof result.slug === "string" ? result.slug : undefined
  );
  return { status: "success", message: success };
}

export async function prepareCompanyProfilePreviewAction(
  _previousState: CompanyProfileActionState = initialCompanyProfileActionState
): Promise<CompanyProfileActionState> {
  void _previousState;
  return lifecycleAction(
    "mark_company_profile_ready",
    "Your company profile is ready for a private preview. Publishing remains a separate choice."
  );
}

export async function publishCompanyProfileAction(
  _previousState: CompanyProfileActionState = initialCompanyProfileActionState,
  formData: FormData
): Promise<CompanyProfileActionState> {
  void _previousState;
  if (formData.get("confirmPublicCompanyProfile") !== "confirmed") {
    return failure("Review the public fields and confirm before publishing.");
  }
  return lifecycleAction(
    "publish_company_profile",
    "The approved company context is now public. You can hide it at any time."
  );
}

export async function hideCompanyProfileAction(
  _previousState: CompanyProfileActionState = initialCompanyProfileActionState
): Promise<CompanyProfileActionState> {
  void _previousState;
  return lifecycleAction(
    "hide_company_profile",
    "The public company page is hidden. The private draft remains available to authorized members."
  );
}
