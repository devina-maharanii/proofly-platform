"use server";

/** Evidence Ledger Editorial — Phase 30 gives the Talent explicit control over public outcome and endorsement context. */
import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  initialProofGraphActionState,
  type ProofGraphActionState,
} from "./types";

const isUuid = (value: FormDataEntryValue | null): value is string =>
  typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

const fail = (message: string): ProofGraphActionState => ({
  status: "error",
  message,
});

async function address() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

async function command() {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "talent" }),
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
        "Switch to your Talent context before updating Proof visibility."
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
        `Too many Proof visibility updates. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  return { ok: true as const, supabase };
}

function refreshProofViews() {
  revalidatePath("/proof");
  revalidatePath("/talent/[handle]", "page");
}

async function outcomeAction(
  previousState: ProofGraphActionState,
  formData: FormData,
  rpc:
    "consent_company_proof_outcome" | "withdraw_company_proof_outcome_consent",
  successMessage: string
): Promise<ProofGraphActionState> {
  void previousState;
  const outcomeId = formData.get("outcomeId");
  if (!isUuid(outcomeId))
    return fail("Choose a valid company outcome context.");
  const request = await command();
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(rpc, {
    requested_outcome_id: outcomeId,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return fail(
      "This Proof context could not be updated. Only its Talent owner can consent to or withdraw it."
    );
  refreshProofViews();
  return { status: "success", message: successMessage };
}

async function endorsementAction(
  previousState: ProofGraphActionState,
  formData: FormData,
  rpc: "consent_proof_endorsement" | "withdraw_proof_endorsement",
  successMessage: string
): Promise<ProofGraphActionState> {
  void previousState;
  const endorsementId = formData.get("endorsementId");
  if (!isUuid(endorsementId))
    return fail("Choose a valid company endorsement.");
  const request = await command();
  if (!request.ok) return request.state;
  const { error } = await request.supabase.rpc(rpc, {
    requested_endorsement_id: endorsementId,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return fail(
      "This endorsement could not be updated. Only its Talent owner can consent to or withdraw it."
    );
  refreshProofViews();
  return { status: "success", message: successMessage };
}

export async function consentCompanyProofOutcomeAction(
  previousState: ProofGraphActionState = initialProofGraphActionState,
  formData: FormData
) {
  return outcomeAction(
    previousState,
    formData,
    "consent_company_proof_outcome",
    "Company outcome context is now public with your consent."
  );
}

export async function withdrawCompanyProofOutcomeConsentAction(
  previousState: ProofGraphActionState = initialProofGraphActionState,
  formData: FormData
) {
  return outcomeAction(
    previousState,
    formData,
    "withdraw_company_proof_outcome_consent",
    "Public consent was withdrawn. The retained audit record stays private."
  );
}

export async function consentProofEndorsementAction(
  previousState: ProofGraphActionState = initialProofGraphActionState,
  formData: FormData
) {
  return endorsementAction(
    previousState,
    formData,
    "consent_proof_endorsement",
    "Company endorsement is now public with your consent."
  );
}

export async function withdrawProofEndorsementAction(
  previousState: ProofGraphActionState = initialProofGraphActionState,
  formData: FormData
) {
  return endorsementAction(
    previousState,
    formData,
    "withdraw_proof_endorsement",
    "Public consent was withdrawn. The retained audit record stays private."
  );
}
