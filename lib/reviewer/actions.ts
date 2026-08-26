"use server";

/** Phase 27 reviewer commands: authenticated, rate-limited server actions over allowlisted database RPCs. */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import { initialReviewerActionState, type ReviewerActionState } from "./types";
import {
  parseReviewerAdminTransitionForm,
  parseReviewerApplicationForm,
} from "./validation";

const failure = (message: string): ReviewerActionState => ({
  status: "error",
  message,
});

async function requestAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

async function reviewerCommand() {
  const [session, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) {
    return {
      ok: false as const,
      state: failure("Your session has expired. Sign in again to continue."),
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
        `Too many reviewer changes. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  }
  return { ok: true as const, session, supabase };
}

export async function saveReviewerApplicationAction(
  _previousState: ReviewerActionState = initialReviewerActionState,
  formData: FormData
): Promise<ReviewerActionState> {
  void _previousState;
  const parsed = parseReviewerApplicationForm(formData);
  if (!parsed.success) {
    return failure(
      "Check the reviewer profile, canonical skills, evidence, and conflict declarations before saving."
    );
  }
  const command = await reviewerCommand();
  if (!command.ok) return command.state;
  const { data, error } = await command.supabase.rpc(
    "save_reviewer_application",
    {
      requested_profile: {
        display_name: parsed.data.displayName,
        professional_focus: parsed.data.professionalFocus,
        experience_context: parsed.data.experienceContext,
        review_experience: parsed.data.reviewExperience,
        timezone: parsed.data.timezone,
        languages: parsed.data.languages,
        availability_status: parsed.data.availabilityStatus,
        max_concurrent_reviews: parsed.data.maxConcurrentReviews,
        feedback_style: parsed.data.feedbackStyle,
        public_bio: parsed.data.publicBio,
      },
      requested_skills: parsed.data.skills.map(skill => ({
        skill_key: skill.skillKey,
        expertise_context: skill.expertiseContext,
      })),
      requested_evidence: parsed.data.evidence.map(evidence => ({
        evidence_type: evidence.evidenceType,
        title: evidence.title,
        description: evidence.description,
        source_url: evidence.sourceUrl,
      })),
      requested_conflicts: parsed.data.conflicts.map(conflict => ({
        relationship_kind: conflict.relationshipKind,
        scope: conflict.scope,
        organization_id: conflict.organizationId ?? "",
        context: conflict.context,
      })),
    }
  );
  if (error || !data) {
    return failure(
      "This reviewer application draft could not be saved safely. Check the current application state and try again."
    );
  }
  revalidatePath("/reviewer/application");
  revalidatePath("/auth/continue");
  return {
    status: "success",
    message: "Private reviewer application draft saved.",
  };
}

export async function submitReviewerApplicationAction(
  _previousState: ReviewerActionState = initialReviewerActionState,
  formData: FormData
): Promise<ReviewerActionState> {
  void _previousState;
  if (
    formData.get("acknowledgeConflicts") !== "on" ||
    formData.get("acknowledgePolicy") !== "on"
  ) {
    return failure(
      "Confirm the conflict declaration and reviewer conduct policy before requesting approval."
    );
  }
  const command = await reviewerCommand();
  if (!command.ok) return command.state;
  const { data, error } = await command.supabase.rpc(
    "submit_reviewer_application",
    {
      acknowledged_conflicts: true,
      acknowledged_policy: true,
    }
  );
  if (error || !data) {
    return failure(
      "This application cannot be submitted yet. Save complete profile, evidence, and expertise details first."
    );
  }
  revalidatePath("/reviewer/application");
  revalidatePath("/admin/reviewers");
  revalidatePath("/auth/continue");
  return {
    status: "success",
    message: "Reviewer application submitted for a human screening review.",
  };
}

export async function activateReviewerApplicationAction(
  _previousState: ReviewerActionState = initialReviewerActionState,
  formData: FormData
): Promise<ReviewerActionState> {
  void formData;
  void _previousState;
  const command = await reviewerCommand();
  if (!command.ok) return command.state;
  const { data, error } = await command.supabase.rpc(
    "activate_reviewer_application"
  );
  if (error || !data) {
    return failure(
      "Reviewer access cannot be activated in the current state. Confirm that approval and the current policy agreement remain valid."
    );
  }
  revalidatePath("/reviewer/application");
  revalidatePath("/reviewer/opportunities");
  revalidatePath("/auth/continue");
  return {
    status: "success",
    message:
      "Reviewer access is active. Opportunities remain subject to expertise, conflict, capacity, and material checks.",
  };
}

export async function resolveReviewerApplicationAction(
  _previousState: ReviewerActionState = initialReviewerActionState,
  formData: FormData
): Promise<ReviewerActionState> {
  void _previousState;
  const parsed = parseReviewerAdminTransitionForm(formData);
  if (!parsed.success)
    return failure("Check the reviewer state decision and note.");
  const [command, authorization] = await Promise.all([
    reviewerCommand(),
    authorizeActiveContext({ role: "administrator" }),
  ]);
  if (!command.ok) return command.state;
  if (!authorization.ok) {
    return failure(
      "Switch to an authorized administrator context to manage reviewer approval."
    );
  }
  const { data, error } = await command.supabase.rpc(
    "resolve_reviewer_application",
    {
      target_user_id: parsed.data.targetUserId,
      requested_state: parsed.data.requestedState,
      requested_note: parsed.data.note,
    }
  );
  if (error || !data) {
    return failure(
      "This reviewer state could not be recorded. Confirm the allowed lifecycle transition and its required note."
    );
  }
  revalidatePath("/admin/reviewers");
  revalidatePath("/admin/reviewers/[applicationId]", "page");
  revalidatePath("/reviewer/application");
  return {
    status: "success",
    message: "Reviewer lifecycle decision recorded in the private audit trail.",
  };
}
