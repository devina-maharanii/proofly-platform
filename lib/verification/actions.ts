"use server";

/**
 * Evidence Ledger Editorial — Phase 29 commands are narrow server actions for
 * human accountable verification. Each command authenticates, rate-limits,
 * validates bounded input, and delegates final authority to guarded RPCs.
 */
import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";
import { workspacePath } from "@/lib/workspace/types";

import {
  initialVerificationActionState,
  type VerificationActionState,
} from "./types";
import {
  parseVerificationAppealForm,
  parseVerificationDecisionForm,
  parseVerificationRevocationForm,
  verificationDecisionPayload,
  verificationFieldErrors,
} from "./validation";

const fail = (message: string, fieldErrors?: Record<string, string>) => ({
  status: "error" as const,
  message,
  fieldErrors,
});

const isUuid = (value: FormDataEntryValue | null): value is string =>
  typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

async function address() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

async function command(
  requirement?: Parameters<typeof authorizeActiveContext>[0]
) {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext(requirement),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase)
    return {
      ok: false as const,
      state: fail("Your session has expired. Sign in again to continue."),
    };
  if (!authorization.ok)
    return {
      ok: false as const,
      state: fail(
        "Switch to the authorized private context before continuing."
      ),
    };
  const limit = securityRateLimiter.check(
    "mutation",
    session.userId,
    await address()
  );
  if (!limit.ok)
    return {
      ok: false as const,
      state: fail(
        `Too many verification actions. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  return { ok: true as const, supabase };
}

const refresh = (workspaceId: string) => {
  revalidatePath(workspacePath(workspaceId));
  revalidatePath(`/reviewer/verifications/${workspaceId}`);
  revalidatePath("/admin/verifications");
};

export async function prepareProjectVerificationAction(
  _previousState: VerificationActionState = initialVerificationActionState,
  formData: FormData
): Promise<VerificationActionState> {
  void _previousState;
  const workspaceId = formData.get("workspaceId");
  if (!isUuid(workspaceId)) return fail("Choose a valid private workspace.");
  const request = await command({ role: "company_member" });
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc("prepare_project_verification", {
    requested_workspace_id: workspaceId,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return fail(
      "Verification could not be prepared. The submitted version, locked rubric, and company ownership must remain eligible."
    );
  refresh(workspaceId);
  return {
    status: "success",
    message:
      "The exact submitted version is ready for qualified reviewer assignment. No decision has been made.",
  };
}

export async function assignProjectVerificationReviewerAction(
  _previousState: VerificationActionState = initialVerificationActionState,
  formData: FormData
): Promise<VerificationActionState> {
  void _previousState;
  const workspaceId = formData.get("workspaceId");
  const verificationId = formData.get("verificationId");
  const reviewerUserId = formData.get("reviewerUserId");
  if (
    !isUuid(workspaceId) ||
    !isUuid(verificationId) ||
    !isUuid(reviewerUserId)
  )
    return fail("Choose a valid verification and qualified reviewer.");
  const request = await command();
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(
    "assign_project_verification_reviewer",
    {
      requested_verification_id: verificationId,
      requested_reviewer_user_id: reviewerUserId,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail(
      "This reviewer cannot be assigned. Active reviewer context, matching expertise, capacity, conflict, self-review, and organization checks are required."
    );
  refresh(workspaceId);
  return {
    status: "success",
    message:
      "Qualified reviewer assigned. The assignment does not grant the company decision authority.",
  };
}

export async function beginProjectVerificationReviewAction(
  _previousState: VerificationActionState = initialVerificationActionState,
  formData: FormData
): Promise<VerificationActionState> {
  void _previousState;
  const workspaceId = formData.get("workspaceId");
  const reviewId = formData.get("reviewId");
  if (!isUuid(workspaceId) || !isUuid(reviewId))
    return fail("Choose a valid assigned review.");
  const request = await command({ role: "reviewer" });
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(
    "begin_project_verification_review",
    { requested_review_id: reviewId }
  );
  if (error)
    return fail(
      "This review could not be started. Only its active, qualified, conflict-free reviewer may begin it."
    );
  refresh(workspaceId);
  return {
    status: "success",
    message:
      "Human review started against the locked rubric and exact submission version.",
  };
}

export async function decideProjectVerificationReviewAction(
  _previousState: VerificationActionState = initialVerificationActionState,
  formData: FormData
): Promise<VerificationActionState> {
  void _previousState;
  const reviewId = formData.get("reviewId");
  const parsed = parseVerificationDecisionForm(formData);
  if (!isUuid(reviewId) || !parsed.success) {
    return fail(
      "Complete one accountable observation for every locked rubric dimension before recording a human decision.",
      parsed.success ? undefined : verificationFieldErrors(parsed.error)
    );
  }
  const request = await command({ role: "reviewer" });
  if (!request.ok) return request.state;
  const payload = verificationDecisionPayload(parsed.data);
  const { error } = await request.supabase.rpc(
    "decide_project_verification_review",
    {
      requested_review_id: reviewId,
      requested_decision: payload.decision,
      requested_decision_summary: payload.decision_summary,
      requested_actionable_next_steps: payload.actionable_next_steps,
      requested_reviewer_attribution_mode: payload.reviewer_attribution_mode,
      requested_observations: payload.observations,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return fail(
      "This decision could not be recorded. The active assignee, exact rubric dimensions, and final human-review state are checked again by the server."
    );
  refresh(parsed.data.workspaceId);
  return {
    status: "success",
    message:
      "Human decision recorded with an immutable reviewer observation trail. No public Proof was created automatically.",
  };
}

export async function appealProjectVerificationAction(
  _previousState: VerificationActionState = initialVerificationActionState,
  formData: FormData
): Promise<VerificationActionState> {
  void _previousState;
  const parsed = parseVerificationAppealForm(formData);
  if (!parsed.success)
    return fail("Describe the appeal in 30 to 1,800 characters.");
  const request = await command({ role: "talent" });
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc("appeal_project_verification", {
    requested_verification_id: parsed.data.verificationId,
    requested_reason: parsed.data.reason,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return fail(
      "This appeal could not be recorded. Only the Talent owner of a not-verified record may request one."
    );
  refresh(parsed.data.workspaceId);
  return {
    status: "success",
    message:
      "Appeal recorded as a separate restricted record. It has not overwritten the original decision.",
  };
}

export async function revokeProjectVerificationAction(
  _previousState: VerificationActionState = initialVerificationActionState,
  formData: FormData
): Promise<VerificationActionState> {
  void _previousState;
  const parsed = parseVerificationRevocationForm(formData);
  if (!parsed.success)
    return fail(
      "Select a revocation reason and record a 20 to 1,600 character accountable note."
    );
  const request = await command({ role: "administrator" });
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc("revoke_project_verification", {
    requested_verification_id: parsed.data.verificationId,
    requested_reason: parsed.data.reason,
    requested_note: parsed.data.note,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return fail(
      "This verification could not be revoked. Only an active administrator may revoke an active verified record with an accountable note."
    );
  refresh(parsed.data.workspaceId);
  return {
    status: "success",
    message:
      "Verification revoked. Any linked public Proof has been removed while restricted audit history remains retained.",
  };
}

export async function assignProjectVerificationAppealAction(
  _previousState: VerificationActionState = initialVerificationActionState,
  formData: FormData
): Promise<VerificationActionState> {
  void _previousState;
  const workspaceId = formData.get("workspaceId");
  const verificationId = formData.get("verificationId");
  const reviewerUserId = formData.get("reviewerUserId");
  if (
    !isUuid(workspaceId) ||
    !isUuid(verificationId) ||
    !isUuid(reviewerUserId)
  ) {
    return fail("Choose a valid appeal record and qualified reviewer.");
  }
  const request = await command({ role: "administrator" });
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(
    "assign_project_verification_appeal",
    {
      requested_verification_id: verificationId,
      requested_reviewer_user_id: reviewerUserId,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error) {
    return fail(
      "The appeal reviewer could not be assigned. The original reviewer, conflicted reviewers, inactive reviewers, and reviewers without matching capacity are excluded."
    );
  }
  refresh(workspaceId);
  return {
    status: "success",
    message:
      "Separate appeal reviewer assigned. The original decision remains in its retained record.",
  };
}

export async function publishVerifiedProofAction(
  _previousState: VerificationActionState = initialVerificationActionState,
  formData: FormData
): Promise<VerificationActionState> {
  void _previousState;
  const workspaceId = formData.get("workspaceId");
  const verificationId = formData.get("verificationId");
  const evidenceId = formData.get("evidenceId");
  const skillKey = formData.get("skillKey");
  if (
    !isUuid(workspaceId) ||
    !isUuid(verificationId) ||
    !isUuid(evidenceId) ||
    typeof skillKey !== "string" ||
    !/^[a-z0-9-]{1,80}$/.test(skillKey)
  ) {
    return fail("Choose one published evidence record and one verified skill.");
  }
  const request = await command({ role: "talent" });
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc("publish_verified_proof", {
    requested_verification_id: verificationId,
    requested_evidence_id: evidenceId,
    requested_skill_key: skillKey,
    requested_idempotency_key: randomUUID(),
  });
  if (error) {
    return fail(
      "This Proof could not be made public. You must own the verified record, choose your own published evidence, and choose one skill bound to the locked rubric."
    );
  }
  refresh(workspaceId);
  return {
    status: "success",
    message:
      "You chose to make this verified Proof public. Reviewer-private notes remain private.",
  };
}
