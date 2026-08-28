/** Phase 34 provider adapter: sandbox Stripe calls and normalized, redacted event facts only. */
import "server-only";

import { createHash } from "node:crypto";

import Stripe from "stripe";

import type { SandboxStripeConfig } from "./config";

export const normalizedPaymentEventTypes = [
  "funding_succeeded",
  "funding_failed",
  "payment_action_required",
  "payment_hold",
  "release_succeeded",
  "release_failed",
  "refund_succeeded",
  "refund_failed",
  "provider_dispute_opened",
  "provider_dispute_closed",
  "payout_paid",
  "payout_failed",
  "payout_reversed",
  "payout_account_updated",
  "ignored",
] as const;
export type NormalizedPaymentEventType =
  (typeof normalizedPaymentEventTypes)[number];

export type NormalizedStripeEvent = Readonly<{
  providerEventId: string;
  providerEventType: string;
  providerObjectReference: string;
  providerAccountReference: string;
  normalizedEventType: NormalizedPaymentEventType;
  occurredAt: string;
  rawBodySha256: string;
  redactedPayload: Record<string, string | number | boolean | null>;
}>;

export function createSandboxStripeClient(config: SandboxStripeConfig) {
  return new Stripe(config.secretKey, { maxNetworkRetries: 2 });
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function eventObject(event: Stripe.Event) {
  return event.data.object as unknown as Record<string, unknown>;
}

function normalizedType(event: Stripe.Event): NormalizedPaymentEventType {
  const object = eventObject(event);
  if (event.type === "payment_intent.succeeded") return "funding_succeeded";
  if (event.type === "payment_intent.payment_failed") return "funding_failed";
  if (event.type === "payment_intent.requires_action")
    return "payment_action_required";
  if (event.type === "charge.dispute.created") return "provider_dispute_opened";
  if (event.type === "charge.dispute.closed") return "provider_dispute_closed";
  if (event.type === "transfer.created") return "release_succeeded";
  if (event.type === "transfer.reversed") return "release_failed";
  if (event.type === "refund.updated") {
    return object.status === "succeeded" ? "refund_succeeded" : "refund_failed";
  }
  if (event.type === "payout.paid") return "payout_paid";
  if (event.type === "payout.failed") return "payout_failed";
  if (event.type === "payout.canceled") return "payout_reversed";
  if (event.type === "account.updated") return "payout_account_updated";
  return "ignored";
}

function objectReference(event: Stripe.Event): string {
  const object = eventObject(event);
  if (event.type.startsWith("charge.dispute.")) {
    return (
      stringValue(object.payment_intent) ??
      stringValue(object.charge) ??
      stringValue(object.id) ??
      event.id
    );
  }
  return stringValue(object.id) ?? event.id;
}

function redactedEventPayload(event: Stripe.Event) {
  const object = eventObject(event);
  const payload: Record<string, string | number | boolean | null> = {
    object_type: stringValue(object.object) ?? "unknown",
    status: stringValue(object.status),
  };
  if (event.type === "account.updated") {
    payload.payout_account_state = Boolean(object.charges_enabled)
      ? "eligible"
      : "requirements_due";
    payload.requirements_status_code = Boolean(object.details_submitted)
      ? "complete"
      : "details_required";
  }
  if (event.type.startsWith("charge.dispute.")) {
    payload.reason_code = stringValue(object.reason) ?? "provider_dispute";
  }
  return payload;
}

export function verifyAndNormalizeStripeEvent(
  rawBody: string,
  signature: string | null,
  config: SandboxStripeConfig
): NormalizedStripeEvent | null {
  if (!signature || rawBody.length > 1_000_000) return null;
  let event: Stripe.Event;
  try {
    event = createSandboxStripeClient(config).webhooks.constructEvent(
      rawBody,
      signature,
      config.webhookSecret
    );
  } catch {
    return null;
  }
  const providerAccountReference =
    stringValue(event.account) ?? config.platformAccountReference;
  const occurredAt = new Date(event.created * 1000);
  if (
    !Number.isFinite(occurredAt.getTime()) ||
    !stringValue(event.id) ||
    !stringValue(event.type)
  ) {
    return null;
  }
  return {
    providerEventId: event.id,
    providerEventType: event.type,
    providerObjectReference: objectReference(event),
    providerAccountReference,
    normalizedEventType: normalizedType(event),
    occurredAt: occurredAt.toISOString(),
    rawBodySha256: createHash("sha256").update(rawBody).digest("hex"),
    redactedPayload: redactedEventPayload(event),
  };
}

export async function createStripeCheckout(
  config: SandboxStripeConfig,
  input: Readonly<{
    paymentIntentId: string;
    amountMinor: number;
    currency: string;
  }>
) {
  const stripe = createSandboxStripeClient(config);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: input.paymentIntentId,
      payment_intent_data: {
        metadata: { proofly_payment_intent_id: input.paymentIntentId },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountMinor,
            product_data: { name: "Proofly engagement funding" },
          },
        },
      ],
      success_url: `${config.appUrl}/engagements?payment=provider-submitted`,
      cancel_url: `${config.appUrl}/engagements?payment=checkout-cancelled`,
    },
    { idempotencyKey: `proofly-checkout-${input.paymentIntentId}` }
  );
  if (!session.url || !session.payment_intent)
    throw new Error("CHECKOUT_UNAVAILABLE");
  return {
    checkoutUrl: session.url,
    providerCheckoutReference: session.id,
    providerPaymentReference:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent.id,
    expiresAt: new Date((session.expires_at ?? 0) * 1000).toISOString(),
  };
}

export async function createStripePayoutOnboarding(
  config: SandboxStripeConfig,
  input: Readonly<{
    payoutAccountId: string;
    providerAccountReference: string | null;
  }>
) {
  const stripe = createSandboxStripeClient(config);
  const account = input.providerAccountReference
    ? await stripe.accounts.retrieve(input.providerAccountReference)
    : await stripe.accounts.create(
        {
          type: "express",
          capabilities: { transfers: { requested: true } },
          metadata: { proofly_payout_account_id: input.payoutAccountId },
        },
        { idempotencyKey: `proofly-payout-account-${input.payoutAccountId}` }
      );
  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${config.appUrl}/payouts?payment=payout-refresh`,
    return_url: `${config.appUrl}/payouts?payment=payout-return`,
    type: "account_onboarding",
  });
  return { providerAccountReference: account.id, onboardingUrl: link.url };
}

export async function createStripeTransfer(
  config: SandboxStripeConfig,
  input: Readonly<{
    paymentReleaseId: string;
    amountMinor: number;
    currency: string;
    destinationAccountReference: string;
  }>
) {
  const transfer = await createSandboxStripeClient(config).transfers.create(
    {
      amount: input.amountMinor,
      currency: input.currency.toLowerCase(),
      destination: input.destinationAccountReference,
      metadata: { proofly_payment_release_id: input.paymentReleaseId },
    },
    { idempotencyKey: `proofly-release-${input.paymentReleaseId}` }
  );
  return transfer.id;
}

export async function createStripeRefund(
  config: SandboxStripeConfig,
  input: Readonly<{
    refundId: string;
    providerPaymentReference: string;
    amountMinor: number;
  }>
) {
  const refund = await createSandboxStripeClient(config).refunds.create(
    {
      payment_intent: input.providerPaymentReference,
      amount: input.amountMinor,
    },
    { idempotencyKey: `proofly-refund-${input.refundId}` }
  );
  return refund.id;
}
