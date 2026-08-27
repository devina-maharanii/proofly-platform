"use server";

/** Evidence Ledger Editorial — Phase 32 sends only bounded controls to guarded RPCs; matching actions never mutate hiring or proof truth. */
import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import { initialMatchingActionState, type MatchingActionState } from "./types";
import {
  matchingFieldErrors,
  parseMatchingPreferencesForm,
  parseMatchingRequirementsForm,
  parseRecommendationControlForm,
} from "./validation";

const fail = (
  message: string,
  fieldErrors?: Record<string, string>
): MatchingActionState => ({ status: "error", message, fieldErrors });
const requestAddress = async () => {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
};

async function matchingCommand(role: "talent" | "company_member") {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase)
    return {
      ok: false as const,
      state: fail("Your session has expired. Sign in again to continue."),
    };
  if (
    !authorization.ok ||
    (role === "company_member" && !authorization.context.active?.organizationId)
  )
    return {
      ok: false as const,
      state: fail(
        role === "talent"
          ? "Switch to your Talent context to manage matching controls."
          : "Switch to an active company context to manage matching requirements."
      ),
    };
  const limit = securityRateLimiter.check(
    "mutation",
    session.userId,
    await requestAddress()
  );
  if (!limit.ok)
    return {
      ok: false as const,
      state: fail(
        `Too many matching changes. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  return { ok: true as const, supabase };
}

function refreshMatching(projectId?: string) {
  revalidatePath("/matching");
  revalidatePath("/company/projects/[projectId]/matching", "page");
  revalidatePath("/admin/matching");
  if (projectId) revalidatePath(`/company/projects/${projectId}/matching`);
}

export async function saveMatchingPreferencesAction(
  _previousState: MatchingActionState = initialMatchingActionState,
  formData: FormData
): Promise<MatchingActionState> {
  void _previousState;
  const parsed = parseMatchingPreferencesForm(formData);
  if (!parsed.success)
    return fail(
      "Check the matching participation and preference fields, then try again.",
      matchingFieldErrors(parsed.error)
    );
  const command = await matchingCommand("talent");
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "save_matching_talent_preferences",
    {
      requested_preferences: {
        project_recommendations_state: parsed.data.projectRecommendationsState,
        company_discoverability_state: parsed.data.companyDiscoverabilityState,
        availability_status: parsed.data.availabilityStatus,
        share_availability_with_companies:
          parsed.data.shareAvailabilityWithCompanies,
        work_arrangement: parsed.data.workArrangement,
        timezone: parsed.data.timezone,
        application_capacity: parsed.data.applicationCapacity,
      },
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail(
      "Matching preferences could not be saved safely. Review the active context and try again."
    );
  refreshMatching();
  return {
    status: "success",
    message:
      "Your matching participation and voluntary preference controls are saved. Changes affect future recommendations only.",
  };
}

export async function saveMatchingProjectRequirementsAction(
  _previousState: MatchingActionState = initialMatchingActionState,
  formData: FormData
): Promise<MatchingActionState> {
  void _previousState;
  const parsed = parseMatchingRequirementsForm(formData);
  if (!parsed.success)
    return fail(
      "Check the matching requirement fields and remove protected-characteristic criteria.",
      matchingFieldErrors(parsed.error)
    );
  const command = await matchingCommand("company_member");
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "save_matching_project_requirements",
    {
      requested_project_id: parsed.data.projectId,
      requested_requirement: {
        matching_enabled: parsed.data.matchingEnabled,
        required_evidence_expectations:
          parsed.data.requiredEvidenceExpectations,
        availability_expectation: parsed.data.availabilityExpectation,
        work_arrangement: parsed.data.workArrangement,
        timezone_expectation: parsed.data.timezoneExpectation,
        collaboration_needs: parsed.data.collaborationNeeds,
      },
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail(
      "These private project matching requirements could not be saved. Confirm that the project, required skills, and active company context are current."
    );
  refreshMatching(parsed.data.projectId);
  return {
    status: "success",
    message:
      "A versioned matching requirement revision is saved. It is a recommendation input, not an application or hiring decision.",
  };
}

async function recommendationControl(
  formData: FormData,
  kind: "dismiss" | "feedback" | "report" | "human"
) {
  const parsed = parseRecommendationControlForm(formData);
  if (!parsed.success)
    return {
      parsed,
      command: null,
      state: fail(
        "This recommendation control is unavailable.",
        matchingFieldErrors(parsed.error)
      ),
    };
  const command = await matchingCommand(
    kind === "human" ? "company_member" : "talent"
  );
  return { parsed, command, state: null };
}

export async function dismissMatchingRecommendationAction(
  _previousState: MatchingActionState = initialMatchingActionState,
  formData: FormData
): Promise<MatchingActionState> {
  void _previousState;
  const result = await recommendationControl(formData, "dismiss");
  if (!result.parsed.success) return result.state!;
  if (!result.command?.ok)
    return result.command?.state ?? fail("Your session has expired.");
  const { error } = await result.command.supabase.rpc(
    "dismiss_matching_recommendation",
    {
      requested_recommendation_id: result.parsed.data.recommendationId,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail(
      "This recommendation is no longer available or cannot be dismissed."
    );
  refreshMatching();
  return {
    status: "success",
    message:
      "Recommendation dismissed. This is feedback on relevance, not a change to proof, profile, application, or hiring status.",
  };
}

export async function recordMatchingFeedbackAction(
  _previousState: MatchingActionState = initialMatchingActionState,
  formData: FormData
): Promise<MatchingActionState> {
  void _previousState;
  const result = await recommendationControl(formData, "feedback");
  if (!result.parsed.success || !result.parsed.data.feedbackType)
    return fail("Choose a feedback reason before continuing.");
  if (!result.command?.ok)
    return result.command?.state ?? fail("Your session has expired.");
  const { error } = await result.command.supabase.rpc(
    "record_matching_recommendation_feedback",
    {
      requested_recommendation_id: result.parsed.data.recommendationId,
      requested_feedback_type: result.parsed.data.feedbackType,
      requested_detail: result.parsed.data.detail,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail(
      "Feedback could not be recorded because this recommendation is no longer available."
    );
  refreshMatching();
  return {
    status: "success",
    message:
      "Feedback recorded separately from proof, reputation, and hiring decisions.",
  };
}

export async function reportMatchingRecommendationAction(
  _previousState: MatchingActionState = initialMatchingActionState,
  formData: FormData
): Promise<MatchingActionState> {
  void _previousState;
  const result = await recommendationControl(formData, "report");
  if (!result.parsed.success || !result.parsed.data.feedbackType)
    return fail("Choose a report category before continuing.");
  if (!result.command?.ok)
    return result.command?.state ?? fail("Your session has expired.");
  const { error } = await result.command.supabase.rpc(
    "report_matching_recommendation",
    {
      requested_recommendation_id: result.parsed.data.recommendationId,
      requested_category: result.parsed.data.feedbackType,
      requested_detail: result.parsed.data.detail,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail(
      "This report could not be recorded because the recommendation is no longer available."
    );
  refreshMatching();
  return {
    status: "success",
    message:
      "Report recorded for human review. It does not change a person’s proof, reputation, eligibility, or hiring status.",
  };
}

export async function recordMatchingHumanOverrideAction(
  _previousState: MatchingActionState = initialMatchingActionState,
  formData: FormData
): Promise<MatchingActionState> {
  void _previousState;
  const result = await recommendationControl(formData, "human");
  if (!result.parsed.success || !result.parsed.data.humanAction)
    return fail(
      "Choose the accountable human review action before continuing."
    );
  if (!result.command?.ok)
    return result.command?.state ?? fail("Your session has expired.");
  const { error } = await result.command.supabase.rpc(
    "record_matching_human_override",
    {
      requested_recommendation_id: result.parsed.data.recommendationId,
      requested_action: result.parsed.data.humanAction,
      requested_rationale: result.parsed.data.detail,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail(
      "This recommendation is no longer available for a human review action."
    );
  refreshMatching();
  return {
    status: "success",
    message:
      "Accountable human review action recorded. It does not create an application, invitation, shortlist state, contract, or hiring decision.",
  };
}
