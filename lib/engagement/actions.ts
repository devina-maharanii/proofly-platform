/** Phase 33 command boundary: every mutation has a verified session, fast active-context gate where applicable, server-generated idempotency, rate limit, and database-authoritative authorization. */
"use server";

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
  engagementPath,
  initialEngagementActionState,
  type EngagementActionState,
} from "./types";
import {
  buildEngagementTermsSnapshot,
  parseAccessGrantForm,
  parseAccessRequestForm,
  parseDisputeForm,
  parseDisputeResolutionForm,
  parseEngagementIdForm,
  parseEngagementNegotiationForm,
  parseEngagementProposalForm,
  parseEngagementReasonForm,
  parseMilestoneDecisionForm,
  parseMilestoneSubmissionForm,
} from "./validation";

const failure = (message: string): EngagementActionState => ({
  status: "error",
  message,
});
const success = (
  message: string,
  engagementId?: string
): EngagementActionState => ({ status: "success", message, engagementId });

async function requestAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

async function engagementCommand(
  requiredRole?: "talent" | "company_member" | "administrator"
) {
  const [session, supabase, authorization] = await Promise.all([
    getVerifiedAuthSession(),
    createServerSupabaseClient(),
    requiredRole
      ? authorizeActiveContext({ role: requiredRole })
      : Promise.resolve({ ok: true as const }),
  ]);
  if (!session || !supabase)
    return {
      ok: false as const,
      state: failure("Your session has expired. Sign in again to continue."),
    };
  if (!authorization.ok)
    return {
      ok: false as const,
      state: failure(
        "Switch to the authorized private context before continuing."
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
      state: failure(
        `Too many engagement changes. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  return { ok: true as const, supabase };
}

const refreshEngagement = (engagementId: string) => {
  revalidatePath("/engagements");
  revalidatePath(engagementPath(engagementId));
  revalidatePath("/admin/engagements/disputes");
};

const engagementIdFrom = (value: unknown) =>
  value &&
  typeof value === "object" &&
  typeof (value as { engagement_id?: unknown; engagementId?: unknown })
    .engagement_id === "string"
    ? (value as { engagement_id: string }).engagement_id
    : typeof (value as { engagementId?: unknown })?.engagementId === "string"
      ? (value as { engagementId: string }).engagementId
      : null;

export async function createEngagementProposalAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseEngagementProposalForm(formData);
  if (!parsed.success)
    return failure(
      "Complete every bounded proposal and milestone field. Compensation must equal the milestone amount."
    );
  const command = await engagementCommand("company_member");
  if (!command.ok) return command.state;
  const input = parsed.data;
  const parentEngagementId = formData.get("parentEngagementId");
  if (
    input.engagementType === "ongoing_contract" &&
    (typeof parentEngagementId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(parentEngagementId))
  ) {
    return failure(
      "An ongoing contract must name a completed paid trial from this same private application."
    );
  }
  const { data: draft, error: draftError } = await command.supabase.rpc(
    "create_engagement_draft",
    {
      requested_application_id: input.applicationId,
      requested_engagement_type: input.engagementType,
      requested_market_code: input.marketCode,
      requested_currency: input.currency,
      requested_parent_engagement_id:
        input.engagementType === "ongoing_contract" ? parentEngagementId : null,
      requested_idempotency_key: randomUUID(),
    }
  );
  const engagementId = engagementIdFrom(draft);
  if (draftError || !engagementId)
    return failure(
      "A proposal can begin only from an eligible private application and a currently supported market/provider policy."
    );
  const { error: termsError } = await command.supabase.rpc(
    "save_engagement_terms_draft",
    {
      requested_engagement_id: engagementId,
      requested_terms: buildEngagementTermsSnapshot(input),
      requested_idempotency_key: randomUUID(),
    }
  );
  if (termsError)
    return failure(
      "The proposal draft was not saved. Check the schedule, required bounded terms, and the current market limitation."
    );
  const { error: proposalError } = await command.supabase.rpc(
    "propose_engagement_terms",
    {
      requested_engagement_id: engagementId,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (proposalError)
    return failure(
      "The proposal could not be issued. No funding or work authorization was created."
    );
  refreshEngagement(engagementId);
  return success(
    "Version 1 is recorded as a private proposal. The Talent must accept the exact terms before funding can be considered.",
    engagementId
  );
}

export async function recordEngagementNegotiationAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseEngagementNegotiationForm(formData);
  if (!parsed.success)
    return failure("Add a concise, specific private negotiation record.");
  const command = await engagementCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "record_engagement_negotiation_entry",
    {
      requested_engagement_id: parsed.data.engagementId,
      requested_entry_type: parsed.data.entryType,
      requested_body: parsed.data.body,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return failure(
      "This negotiation entry cannot be recorded in the current private engagement state."
    );
  refreshEngagement(parsed.data.engagementId);
  return success(
    "Private negotiation entry recorded. Material changes require a new version and re-acceptance."
  );
}

export async function acceptEngagementTermsAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseEngagementIdForm(formData);
  const termsVersionId = formData.get("termsVersionId");
  if (
    !parsed.success ||
    typeof termsVersionId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(termsVersionId)
  )
    return failure(
      "Open the current private proposal before accepting its exact version."
    );
  const command = await engagementCommand("talent");
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("accept_engagement_terms", {
    requested_engagement_id: parsed.data.engagementId,
    requested_terms_version_id: termsVersionId,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return failure(
      "This version cannot be accepted. It may be expired, changed, or no longer current."
    );
  refreshEngagement(parsed.data.engagementId);
  return success(
    "The exact current version is accepted and immutable. Work remains blocked until verified provider funding in a supported market."
  );
}

export async function submitEngagementMilestoneAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseMilestoneSubmissionForm(formData);
  if (!parsed.success)
    return failure(
      "Choose a valid private workspace submission version and provide a bounded delivery summary."
    );
  const command = await engagementCommand("talent");
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("submit_engagement_milestone", {
    requested_engagement_id: parsed.data.engagementId,
    requested_milestone_id: parsed.data.milestoneId,
    requested_workspace_submission_version_id:
      parsed.data.workspaceSubmissionVersionId,
    requested_summary: parsed.data.summary,
    requested_known_limitations: parsed.data.knownLimitations,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return failure(
      "This milestone cannot be submitted in the current private work state."
    );
  refreshEngagement(parsed.data.engagementId);
  return success(
    "Milestone submission recorded as an immutable private delivery record."
  );
}

export async function decideEngagementMilestoneAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseMilestoneDecisionForm(formData);
  if (!parsed.success)
    return failure(
      "Choose a permitted decision and add a specific, bounded rationale."
    );
  const command = await engagementCommand("company_member");
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("decide_engagement_milestone", {
    requested_engagement_id: parsed.data.engagementId,
    requested_milestone_id: parsed.data.milestoneId,
    requested_decision: parsed.data.decision,
    requested_rationale: parsed.data.rationale,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return failure(
      "This milestone decision cannot be recorded safely in the current state."
    );
  refreshEngagement(parsed.data.engagementId);
  return success(
    parsed.data.decision === "accepted_for_payment"
      ? "Milestone accepted for a future provider payment step. No money was moved."
      : "Milestone decision recorded in the private evidence ledger."
  );
}

export async function requestEngagementAccessAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseAccessRequestForm(formData);
  if (!parsed.success)
    return failure(
      "Request only a bounded non-production resource with a future expiry. Do not include credentials, tokens, links, or secrets."
    );
  const command = await engagementCommand("talent");
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("request_engagement_access", {
    requested_engagement_id: parsed.data.engagementId,
    requested_access_kind: parsed.data.accessKind,
    requested_resource_label: parsed.data.resourceLabel,
    requested_purpose: parsed.data.purpose,
    requested_expires_at: new Date(parsed.data.expiresAt).toISOString(),
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return failure(
      "This access request was blocked. It must be non-production, credential-free, and within the active private engagement state."
    );
  refreshEngagement(parsed.data.engagementId);
  return success(
    "Access request recorded for company approval. This ledger never carries credentials or production access."
  );
}

export async function grantEngagementAccessAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseAccessGrantForm(formData);
  const engagementId = formData.get("engagementId");
  if (
    !parsed.success ||
    typeof engagementId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(engagementId)
  )
    return failure("Choose a valid pending private access request.");
  const command = await engagementCommand("company_member");
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("grant_engagement_access", {
    requested_access_grant_id: parsed.data.accessGrantId,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return failure(
      "This access request cannot be granted in the current state or may have expired."
    );
  refreshEngagement(engagementId);
  return success(
    "The metadata access grant is recorded. Production access and personal credentials remain prohibited."
  );
}

export async function revokeEngagementAccessAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseAccessGrantForm(formData);
  const engagementId = formData.get("engagementId");
  if (
    !parsed.success ||
    typeof engagementId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(engagementId)
  )
    return failure("Choose a valid private access record.");
  const command = await engagementCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("revoke_engagement_access", {
    requested_access_grant_id: parsed.data.accessGrantId,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return failure(
      "This access record could not be revoked from the current participant context."
    );
  refreshEngagement(engagementId);
  return success(
    "Access record revoked. Any external access must remain separately controlled and fail closed."
  );
}

export async function cancelEngagementAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseEngagementReasonForm(formData);
  if (!parsed.success) return failure("Provide a concise cancellation reason.");
  const command = await engagementCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "cancel_engagement_before_start",
    {
      requested_engagement_id: parsed.data.engagementId,
      requested_reason: parsed.data.reason,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error)
    return failure(
      "This engagement cannot be cancelled before start in its current state."
    );
  refreshEngagement(parsed.data.engagementId);
  return success(
    "Cancellation recorded. Private evidence is retained and any funding reconciliation remains a future provider responsibility."
  );
}

export async function terminateEngagementAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseEngagementReasonForm(formData);
  if (!parsed.success) return failure("Provide a concise termination reason.");
  const command = await engagementCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("terminate_engagement", {
    requested_engagement_id: parsed.data.engagementId,
    requested_reason: parsed.data.reason,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return failure(
      "This engagement cannot be terminated in its current state."
    );
  refreshEngagement(parsed.data.engagementId);
  return success(
    "Termination recorded. Evidence remains retained, access is revoked, and no provider action was performed."
  );
}

export async function openEngagementDisputeAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseDisputeForm(formData);
  if (!parsed.success)
    return failure(
      "Choose a valid dispute category and provide specific private reason and requested remedy."
    );
  const command = await engagementCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("open_engagement_dispute", {
    requested_engagement_id: parsed.data.engagementId,
    requested_milestone_id: parsed.data.milestoneId,
    requested_category: parsed.data.category,
    requested_reason: parsed.data.reason,
    requested_remedy: parsed.data.requestedRemedy,
    requested_evidence_submission_version_ids: [],
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return failure(
      "This dispute cannot be opened in the current state. Evidence remains private and no automatic decision is made."
    );
  refreshEngagement(parsed.data.engagementId);
  return success(
    "Dispute recorded. New work is paused, access records are revoked, and evidence is preserved for human review."
  );
}

export async function resolveEngagementDisputeAction(
  _previousState: EngagementActionState = initialEngagementActionState,
  formData: FormData
): Promise<EngagementActionState> {
  void _previousState;
  const parsed = parseDisputeResolutionForm(formData);
  if (!parsed.success)
    return failure(
      "Choose a permitted accountable outcome and provide a bounded human resolution summary."
    );
  const command = await engagementCommand("administrator");
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("resolve_engagement_dispute", {
    requested_dispute_id: parsed.data.disputeId,
    requested_outcome: parsed.data.outcome,
    requested_resolution_summary: parsed.data.resolutionSummary,
    requested_idempotency_key: randomUUID(),
  });
  if (error)
    return failure(
      "This dispute resolution could not be recorded from the current administrator context."
    );
  revalidatePath("/admin/engagements/disputes");
  return success(
    "Accountable human dispute resolution recorded. It does not alter the prior accepted terms or execute payment."
  );
}
