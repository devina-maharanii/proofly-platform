/** Phase 34 actions: server-only, rate-limited payment coordination without client-derived financial authority. */
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

import { createPaymentAdminSupabaseClient } from "./admin";
import { getSandboxStripeConfig } from "./config";
import {
  createSandboxStripeClient,
  createStripeRefund,
  createStripeTransfer,
} from "./stripe";
import { initialPaymentActionState, type PaymentActionState } from "./types";
import {
  parseEngagementPaymentForm,
  parsePaymentRefundForm,
  parsePaymentReleaseForm,
  parsePlatformPaymentDisputeForm,
} from "./validation";

const failure = (message: string): PaymentActionState => ({
  status: "error",
  message,
});
const success = (
  message: string,
  data: Omit<PaymentActionState, "status" | "message"> = {}
): PaymentActionState => ({ status: "success", message, ...data });

async function requestAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

async function paymentCommand(
  role: "talent" | "company_member" | "administrator",
  companyPermission?: "billing_member"
) {
  const [session, supabase, authorization] = await Promise.all([
    getVerifiedAuthSession(),
    createServerSupabaseClient(),
    authorizeActiveContext({ role, companyPermission }),
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
        "Switch to the authorized private context before continuing."
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
        `Too many payment changes. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  }
  return { ok: true as const, supabase, context: authorization.context };
}

function refreshPayments(engagementId?: string) {
  revalidatePath("/engagements");
  revalidatePath("/company/billing");
  revalidatePath("/payouts");
  revalidatePath("/admin/payments/reconciliation");
  if (engagementId) revalidatePath(`/engagements/${engagementId}`);
}

const paymentIntentIdFrom = (value: unknown) =>
  value &&
  typeof value === "object" &&
  typeof (value as { payment_intent_id?: unknown }).payment_intent_id ===
    "string"
    ? (value as { payment_intent_id: string }).payment_intent_id
    : null;

const payoutAccountIdFrom = (value: unknown) =>
  value &&
  typeof value === "object" &&
  typeof (value as { payout_account_id?: unknown }).payout_account_id ===
    "string"
    ? (value as { payout_account_id: string }).payout_account_id
    : null;

const paymentReleaseIdFrom = (value: unknown) =>
  value &&
  typeof value === "object" &&
  typeof (value as { payment_release_id?: unknown }).payment_release_id ===
    "string"
    ? (value as { payment_release_id: string }).payment_release_id
    : null;

const refundIdFrom = (value: unknown) =>
  value &&
  typeof value === "object" &&
  typeof (value as { refund_id?: unknown }).refund_id === "string"
    ? (value as { refund_id: string }).refund_id
    : null;

const reconciliationRunIdFrom = (value: unknown) =>
  value &&
  typeof value === "object" &&
  typeof (value as { reconciliation_run_id?: unknown })
    .reconciliation_run_id === "string"
    ? (value as { reconciliation_run_id: string }).reconciliation_run_id
    : null;

const executionContext = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;

async function processReleaseWithProvider(paymentReleaseId: string) {
  const config = getSandboxStripeConfig();
  const admin = createPaymentAdminSupabaseClient();
  if (!config || !admin) return "configuration-unavailable" as const;
  const { data, error } = await admin.rpc(
    "get_payment_release_execution_context",
    { requested_payment_release_id: paymentReleaseId }
  );
  const context = executionContext(data);
  const amountMinor =
    typeof context?.amount_minor === "number" ? context.amount_minor : null;
  const currency =
    typeof context?.currency === "string" ? context.currency : null;
  const destinationAccountReference =
    typeof context?.provider_account_reference === "string"
      ? context.provider_account_reference
      : null;
  if (error || !amountMinor || !currency || !destinationAccountReference)
    return "not-eligible" as const;
  try {
    const providerReference = await createStripeTransfer(config, {
      paymentReleaseId,
      amountMinor,
      currency,
      destinationAccountReference,
    });
    const { error: recordError } = await admin.rpc(
      "record_payment_release_processing",
      {
        requested_payment_release_id: paymentReleaseId,
        requested_provider_release_reference: providerReference,
      }
    );
    return recordError ? ("record-pending" as const) : ("submitted" as const);
  } catch {
    return "provider-pending" as const;
  }
}

async function processRefundWithProvider(refundId: string) {
  const config = getSandboxStripeConfig();
  const admin = createPaymentAdminSupabaseClient();
  if (!config || !admin) return "configuration-unavailable" as const;
  const { data, error } = await admin.rpc(
    "get_payment_refund_execution_context",
    { requested_refund_id: refundId }
  );
  const context = executionContext(data);
  const amountMinor =
    typeof context?.amount_minor === "number" ? context.amount_minor : null;
  const providerPaymentReference =
    typeof context?.provider_payment_reference === "string"
      ? context.provider_payment_reference
      : null;
  if (error || !amountMinor || !providerPaymentReference)
    return "not-eligible" as const;
  try {
    const providerReference = await createStripeRefund(config, {
      refundId,
      providerPaymentReference,
      amountMinor,
    });
    const { error: recordError } = await admin.rpc(
      "record_payment_refund_processing",
      {
        requested_refund_id: refundId,
        requested_provider_refund_reference: providerReference,
      }
    );
    return recordError ? ("record-pending" as const) : ("submitted" as const);
  } catch {
    return "provider-pending" as const;
  }
}

export async function createCompanyBillingProfileAction(
  _previousState: PaymentActionState = initialPaymentActionState,
  _formData: FormData
): Promise<PaymentActionState> {
  void _previousState;
  void _formData;
  const command = await paymentCommand("company_member", "billing_member");
  if (!command.ok) return command.state;
  const organizationId = command.context.active?.organizationId;
  if (!organizationId)
    return failure("An active company organization is required.");
  const { error } = await command.supabase.rpc(
    "create_company_billing_profile",
    {
      requested_organization_id: organizationId,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error) {
    return failure(
      "The billing profile could not be prepared from the current authorized payer context."
    );
  }
  refreshPayments();
  return success(
    "Private billing profile recorded. Payment remains unavailable until an approved sandbox market and provider configuration exist."
  );
}

export async function beginEngagementFundingAction(
  _previousState: PaymentActionState = initialPaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  void _previousState;
  const parsed = parseEngagementPaymentForm(formData);
  if (!parsed.success) return failure("Choose a valid private engagement.");
  const command = await paymentCommand("company_member", "billing_member");
  if (!command.ok) return command.state;
  const { data, error } = await command.supabase.rpc(
    "create_engagement_payment_intent",
    {
      requested_engagement_id: parsed.data.engagementId,
      requested_idempotency_key: randomUUID(),
    }
  );
  const paymentIntentId = paymentIntentIdFrom(data);
  if (error || !paymentIntentId) {
    return failure(
      "Funding is unavailable until the provider and compliance policy have been verified for this private market. No money moved."
    );
  }
  refreshPayments(parsed.data.engagementId);
  return success(
    "Funding intent recorded. Continue only through the provider’s sandbox checkout; provider verification is required before work can start.",
    {
      paymentIntentId,
      redirectPath: `/api/payments/checkout?paymentIntentId=${encodeURIComponent(paymentIntentId)}`,
    }
  );
}

export async function beginPayoutOnboardingAction(
  _previousState: PaymentActionState = initialPaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  void _previousState;
  const parsed = parseEngagementPaymentForm(formData);
  if (!parsed.success) return failure("Choose a valid private engagement.");
  const command = await paymentCommand("talent");
  if (!command.ok) return command.state;
  const { data, error } = await command.supabase.rpc(
    "create_payout_onboarding_record",
    {
      requested_engagement_id: parsed.data.engagementId,
      requested_idempotency_key: randomUUID(),
    }
  );
  const payoutAccountId = payoutAccountIdFrom(data);
  if (error || !payoutAccountId) {
    return failure(
      "Payout onboarding is unavailable until an approved sandbox market and provider configuration exist. No payout destination was collected."
    );
  }
  refreshPayments(parsed.data.engagementId);
  return success(
    "Continue in the provider’s sandbox onboarding. Proofly does not store payout destination details.",
    {
      payoutAccountId,
      redirectPath: `/api/payments/payout-onboarding?payoutAccountId=${encodeURIComponent(payoutAccountId)}`,
    }
  );
}

export async function createPaymentReleaseAction(
  _previousState: PaymentActionState = initialPaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  void _previousState;
  const parsed = parsePaymentReleaseForm(formData);
  if (!parsed.success)
    return failure("Choose a valid accepted private milestone.");
  const command = await paymentCommand("company_member", "billing_member");
  if (!command.ok) return command.state;
  const { data, error } = await command.supabase.rpc("create_payment_release", {
    requested_engagement_id: parsed.data.engagementId,
    requested_milestone_id: parsed.data.milestoneId,
    requested_idempotency_key: randomUUID(),
  });
  const paymentReleaseId = paymentReleaseIdFrom(data);
  if (error || !paymentReleaseId) {
    return failure(
      "Release is blocked unless funding, milestone acceptance, an eligible provider payout account, and no payment hold are verified."
    );
  }
  refreshPayments(parsed.data.engagementId);
  const providerResult = await processReleaseWithProvider(paymentReleaseId);
  return success(
    providerResult === "submitted"
      ? "Sandbox provider release submitted. A signed provider webhook must verify it before payout status changes."
      : "Private release instruction remains eligible pending provider verification or reconciliation. No payout status changed.",
    { paymentReleaseId }
  );
}

export async function requestPaymentRefundAction(
  _previousState: PaymentActionState = initialPaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  void _previousState;
  const parsed = parsePaymentRefundForm(formData);
  if (!parsed.success)
    return failure(
      "Use a positive whole-minor amount and a specific private reason."
    );
  const command = await paymentCommand("company_member", "billing_member");
  if (!command.ok) return command.state;
  const { data, error } = await command.supabase.rpc("request_payment_refund", {
    requested_payment_intent_id: parsed.data.paymentIntentId,
    requested_amount_minor: Number(parsed.data.amountMinor),
    requested_reason: parsed.data.reason,
    requested_idempotency_key: randomUUID(),
  });
  if (error) {
    return failure(
      "This private refund request is blocked by the current funding, release, or authorization state. No refund was sent to a provider."
    );
  }
  refreshPayments();
  const refundId = refundIdFrom(data);
  const providerResult = refundId
    ? await processRefundWithProvider(refundId)
    : "record-pending";
  return success(
    providerResult === "submitted"
      ? "Sandbox refund submitted. A signed provider webhook is required before the financial state changes."
      : "Private refund request recorded for verified provider processing or reconciliation. No refund state changed."
  );
}

export async function openPlatformPaymentDisputeAction(
  _previousState: PaymentActionState = initialPaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  void _previousState;
  const parsed = parsePlatformPaymentDisputeForm(formData);
  if (!parsed.success)
    return failure(
      "Link the open private engagement dispute and provide a specific reason."
    );
  const command = await paymentCommand("company_member", "billing_member");
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "open_platform_payment_dispute",
    {
      requested_payment_intent_id: parsed.data.paymentIntentId,
      requested_engagement_dispute_id: parsed.data.engagementDisputeId,
      requested_reason: parsed.data.reason,
      requested_idempotency_key: randomUUID(),
    }
  );
  if (error) {
    return failure(
      "A payment hold can only be linked to an open, private engagement dispute. No provider dispute was created."
    );
  }
  refreshPayments();
  return success(
    "Private payment hold recorded for human review. It does not decide the dispute or execute a refund."
  );
}

function paymentStateMatchesProvider(
  paymentState: unknown,
  providerStatus: string
) {
  if (providerStatus === "succeeded") return paymentState === "funded";
  if (providerStatus === "processing")
    return paymentState === "payment_processing";
  if (providerStatus === "requires_action")
    return paymentState === "requires_action";
  if (providerStatus === "canceled") return paymentState === "funding_failed";
  if (providerStatus === "requires_payment_method")
    return paymentState === "checkout_created" || paymentState === "required";
  return false;
}

export async function runPaymentReconciliationAction(
  _previousState: PaymentActionState = initialPaymentActionState,
  _formData: FormData
): Promise<PaymentActionState> {
  void _previousState;
  void _formData;
  const command = await paymentCommand("administrator");
  if (!command.ok) return command.state;
  const config = getSandboxStripeConfig();
  const admin = createPaymentAdminSupabaseClient();
  if (!config || !admin) {
    return failure(
      "Reconciliation is unavailable until the sandbox provider configuration is securely available. No financial state changed."
    );
  }
  const { data: startData, error: startError } = await command.supabase.rpc(
    "start_payment_reconciliation_run",
    { requested_idempotency_key: randomUUID() }
  );
  const runId = reconciliationRunIdFrom(startData);
  if (startError || !runId) {
    return failure(
      "Reconciliation is unavailable until a configured sandbox provider is present. No financial state changed."
    );
  }
  const { data: contextData, error: contextError } = await admin.rpc(
    "get_payment_reconciliation_execution_context",
    { requested_reconciliation_run_id: runId }
  );
  const context = executionContext(contextData);
  const intents = Array.isArray(context?.payment_intents)
    ? context.payment_intents.slice(0, 100)
    : [];
  if (contextError) {
    await admin.rpc("complete_payment_reconciliation_run", {
      requested_reconciliation_run_id: runId,
      requested_failure_code: "PRIVATE_CONTEXT_UNAVAILABLE",
    });
    return failure(
      "The reconciliation run could not read its private context."
    );
  }
  const stripe = createSandboxStripeClient(config);
  for (const item of intents) {
    const intent = executionContext(item);
    const paymentIntentId = typeof intent?.id === "string" ? intent.id : null;
    const providerPaymentReference =
      typeof intent?.provider_payment_reference === "string"
        ? intent.provider_payment_reference
        : null;
    if (!intent || !paymentIntentId || !providerPaymentReference) continue;
    try {
      const providerPayment = await stripe.paymentIntents.retrieve(
        providerPaymentReference
      );
      await admin.rpc("record_payment_reconciliation_item", {
        requested_reconciliation_run_id: runId,
        requested_payment_intent_id: paymentIntentId,
        requested_state: paymentStateMatchesProvider(
          intent.state,
          providerPayment.status
        )
          ? "matched"
          : "mismatched",
        requested_reason_code: paymentStateMatchesProvider(
          intent.state,
          providerPayment.status
        )
          ? "PROVIDER_STATUS_MATCHED"
          : `PROVIDER_STATUS_${providerPayment.status.toUpperCase()}`.slice(
              0,
              120
            ),
      });
    } catch {
      await admin.rpc("record_payment_reconciliation_item", {
        requested_reconciliation_run_id: runId,
        requested_payment_intent_id: paymentIntentId,
        requested_state: "missing",
        requested_reason_code: "PROVIDER_PAYMENT_NOT_OBSERVED",
      });
    }
  }
  await admin.rpc("complete_payment_reconciliation_run", {
    requested_reconciliation_run_id: runId,
    requested_failure_code: null,
  });
  refreshPayments();
  return success(
    "Sandbox reconciliation completed. Any difference is queued for accountable human review; no financial state was changed."
  );
}
