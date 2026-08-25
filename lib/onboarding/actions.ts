/** Proofly Phase 13: server actions derive identity and role context on the server; private drafts never become public profile data. */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";
import { authorizeActiveContext, getRoleContext } from "@/lib/roles/context";

import {
  companyStartSchema,
  parseOnboardingDraft,
  serializeOnboardingDraft,
  validateOnboardingStep,
} from "./validation";
import {
  initialOnboardingActionState,
  type OnboardingActionState,
  type OnboardingDraft,
  type OnboardingRole,
} from "./types";

function failure(
  message: string,
  fieldErrors?: Record<string, string>
): OnboardingActionState {
  return { status: "error", message, fieldErrors };
}

function safePermissionMessage() {
  return "This onboarding context is no longer available. Choose an available context and try again.";
}

function draftFromFormData(formData: FormData) {
  const rawDraft = formData.get("draft");
  if (typeof rawDraft !== "string" || rawDraft.length > 12000) {
    return {
      ok: false as const,
      state: failure(
        "Your draft could not be saved safely. Review the form and try again."
      ),
    };
  }

  try {
    const parsed = parseOnboardingDraft(JSON.parse(rawDraft));
    if (!parsed.success) {
      return {
        ok: false as const,
        state: failure("Check the highlighted fields and try again."),
      };
    }
    return { ok: true as const, draft: parsed.data };
  } catch {
    return {
      ok: false as const,
      state: failure("Your draft could not be read safely. Try again."),
    };
  }
}

function skippedFieldsFromFormData(formData: FormData) {
  return formData.get("skipPortfolio") === "true" ? ["portfolio_url"] : [];
}

async function saveDraft(
  role: Exclude<OnboardingRole, "reviewer">,
  organizationId: string | null,
  draft: OnboardingDraft,
  skippedFields: string[],
  step: string,
  finalReview = false
) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return failure(
      "Onboarding is temporarily unavailable. Sign in again and retry."
    );
  }

  const storedDraft = serializeOnboardingDraft(draft);
  const { error } = await supabase.rpc(
    finalReview ? "complete_onboarding" : "save_onboarding_draft",
    finalReview
      ? {
          requested_role: role,
          requested_organization_id: organizationId,
          requested_draft: storedDraft,
          requested_skipped_fields: skippedFields,
        }
      : {
          requested_role: role,
          requested_organization_id: organizationId,
          requested_draft: storedDraft,
          requested_skipped_fields: skippedFields,
          requested_state: "in_progress",
          requested_step_key: step,
        }
  );

  if (error) {
    return failure(
      error.message.includes("VALIDATION")
        ? "Review the required fields and try again."
        : safePermissionMessage()
    );
  }

  revalidatePath("/onboarding");
  revalidatePath("/auth/continue");
  return {
    status: "success" as const,
    message: finalReview
      ? "Your onboarding is complete. Your next action is ready."
      : "Your private progress is saved.",
  };
}

export async function saveActiveOnboardingAction(
  _previousState: OnboardingActionState = initialOnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  void _previousState;
  const parsedDraft = draftFromFormData(formData);
  if (!parsedDraft.ok) return parsedDraft.state;

  const authorization = await authorizeActiveContext();
  if (
    !authorization.ok ||
    (authorization.context.active?.role !== "talent" &&
      authorization.context.active?.role !== "company_member")
  ) {
    return failure(safePermissionMessage());
  }

  const role = authorization.context.active.role;
  const organizationId = authorization.context.active.organizationId;
  const step =
    typeof formData.get("step") === "string"
      ? String(formData.get("step"))
      : "identity";
  const intent = formData.get("intent") === "complete" ? "complete" : "save";
  const fieldErrors = validateOnboardingStep(parsedDraft.draft, role, step);
  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      "Check the highlighted fields before continuing.",
      fieldErrors
    );
  }

  return saveDraft(
    role,
    organizationId,
    parsedDraft.draft,
    skippedFieldsFromFormData(formData),
    step,
    intent === "complete"
  );
}

export async function startCompanyOnboardingAction(
  _previousState: OnboardingActionState = initialOnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  void _previousState;
  const parsed = companyStartSchema.safeParse({
    organizationName: formData.get("organizationName"),
    organizationSlug: formData.get("organizationSlug"),
  });
  if (!parsed.success) {
    return failure("Check the organization details and try again.", {
      organizationName:
        parsed.error.issues.find(issue => issue.path[0] === "organizationName")
          ?.message ?? "",
      organizationSlug:
        parsed.error.issues.find(issue => issue.path[0] === "organizationSlug")
          ?.message ?? "",
    });
  }

  const [session, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) {
    return failure(
      "Your session is no longer available. Sign in again to continue."
    );
  }

  const { error } = await supabase.rpc("start_company_onboarding", {
    requested_organization_name: parsed.data.organizationName,
    requested_organization_slug: parsed.data.organizationSlug,
  });
  if (error) {
    return failure(
      error.message.includes("CONFLICT")
        ? "That organization address is already in use. Choose a different one."
        : "We could not create the organization safely. Try again later."
    );
  }

  revalidatePath("/auth/continue");
  redirect("/onboarding" as never);
}

export async function saveReviewerOnboardingAction(
  _previousState: OnboardingActionState = initialOnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  void _previousState;
  const parsedDraft = draftFromFormData(formData);
  if (!parsedDraft.ok) return parsedDraft.state;

  const session = await getVerifiedAuthSession();
  const step =
    typeof formData.get("step") === "string"
      ? String(formData.get("step"))
      : "identity";
  if (!session) {
    return failure(
      "Your session is no longer available. Sign in again to continue."
    );
  }

  const fieldErrors = validateOnboardingStep(
    parsedDraft.draft,
    "reviewer",
    step
  );
  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      "Check the highlighted fields before continuing.",
      fieldErrors
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return failure(
      "Onboarding is temporarily unavailable. Sign in again and retry."
    );
  }

  const complete = formData.get("intent") === "complete";
  const storedDraft = serializeOnboardingDraft(parsedDraft.draft);
  const { error } = await supabase.rpc(
    complete
      ? "complete_reviewer_onboarding"
      : "save_reviewer_onboarding_draft",
    complete
      ? {
          requested_draft: storedDraft,
          requested_skipped_fields: skippedFieldsFromFormData(formData),
        }
      : {
          requested_draft: storedDraft,
          requested_skipped_fields: skippedFieldsFromFormData(formData),
          requested_step_key: step,
        }
  );
  if (error) {
    return failure(
      error.message.includes("VALIDATION")
        ? "Review the required fields and try again."
        : "We could not save your reviewer request safely. Try again later."
    );
  }

  revalidatePath("/onboarding");
  revalidatePath("/auth/continue");
  return {
    status: "success",
    message: complete
      ? "Your reviewer request is pending qualified human review."
      : "Your private progress is saved.",
  };
}

export async function getActiveOnboardingRole() {
  const context = await getRoleContext();
  return context?.active?.role ?? null;
}
