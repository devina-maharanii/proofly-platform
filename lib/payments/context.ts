/** Phase 34 readers: parse only bounded, provider-redacted RPC JSON returned for the current financial party. */
import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import type {
  CompanyBillingOverview,
  EngagementPaymentStatus,
  PrivatePayoutStatus,
  PaymentReconciliationQueue,
} from "./types";

type JsonRecord = Record<string, unknown>;

const record = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const nullableText = (value: unknown) =>
  typeof value === "string" ? value : null;
const bool = (value: unknown) => value === true;
const minor = (value: unknown) =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= Number.MAX_SAFE_INTEGER
    ? value
    : 0;
const array = (value: unknown) => (Array.isArray(value) ? value : []);

function paymentStatus(value: unknown): EngagementPaymentStatus | null {
  const source = record(value);
  if (!source || !text(source.engagement_id)) return null;
  const intent = record(source.payment_intent);
  return {
    engagementId: text(source.engagement_id),
    isBillingParty: bool(source.is_billing_party),
    marketPaymentAvailable: bool(source.market_payment_available),
    fundingState: text(source.funding_state),
    paymentIntent: intent
      ? {
          id: text(intent.id),
          state: text(
            intent.state
          ) as EngagementPaymentStatus["paymentIntent"] extends infer T
            ? T extends { state: infer S }
              ? S
              : never
            : never,
          amountMinor: minor(intent.gross_amount_minor),
          currency: text(intent.currency),
          platformFeeMinor: minor(intent.platform_fee_minor),
          providerFeeMinor: minor(intent.provider_fee_minor),
          taxAmountMinor: minor(intent.tax_amount_minor),
          fundingTotalMinor: minor(intent.funding_total_minor),
          expectedTalentNetMinor: minor(intent.expected_talent_net_minor),
          checkoutExpiresAt: nullableText(intent.checkout_expires_at),
          fundedAt: nullableText(intent.funded_at),
        }
      : null,
    releases: array(source.releases).flatMap(item => {
      const release = record(item);
      return release && text(release.id) && text(release.milestone_id)
        ? [
            {
              id: text(release.id),
              milestoneId: text(release.milestone_id),
              state: text(
                release.state
              ) as EngagementPaymentStatus["releases"][number]["state"],
              amountMinor: minor(release.gross_amount_minor),
              currency: text(release.currency),
              providerFeeMinor: minor(release.provider_fee_minor),
              taxWithholdingMinor: minor(release.tax_withholding_minor),
              expectedTalentNetMinor: minor(release.expected_talent_net_minor),
              releasedAt: nullableText(release.released_at),
            },
          ]
        : [];
    }),
    refunds: array(source.refunds).flatMap(item => {
      const refund = record(item);
      return refund && text(refund.id)
        ? [
            {
              id: text(refund.id),
              state: text(refund.state),
              amountMinor: minor(refund.amount_minor),
              currency: text(refund.currency),
              requestedAt: nullableText(refund.requested_at),
              refundedAt: nullableText(refund.refunded_at),
            },
          ]
        : [];
    }),
    disputeHold: bool(source.dispute_hold),
    receipts: array(source.receipts).flatMap(item => {
      const receipt = record(item);
      return receipt && text(receipt.id)
        ? [
            {
              id: text(receipt.id),
              type: text(receipt.type),
              statusLabel: text(receipt.status_label),
              amountMinor: minor(receipt.amount_minor),
              currency: text(receipt.currency),
              issuedAt: nullableText(receipt.issued_at),
            },
          ]
        : [];
    }),
  };
}

export async function getEngagementPaymentStatus(engagementId: string) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_engagement_payment_status", {
    requested_engagement_id: engagementId,
  });
  return error ? null : paymentStatus(data);
}

export async function getCompanyBillingOverview(): Promise<CompanyBillingOverview | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(
    "get_active_company_billing_overview"
  );
  const source = error ? null : record(data);
  if (!source || !text(source.organization_id)) return null;
  const profile = record(source.billing_profile);
  return {
    organizationId: text(source.organization_id),
    billingProfile: profile
      ? {
          id: text(profile.id),
          status: text(profile.status),
          isAuthorizedPayer: bool(profile.is_authorized_payer),
          policyAcknowledgedAt: nullableText(profile.policy_acknowledged_at),
        }
      : null,
    spendControls: array(source.spend_controls).flatMap(item => {
      const control = record(item);
      return control
        ? [
            {
              amountMinor: minor(control.period_limit_minor),
              currency: text(control.currency),
              state: text(control.state),
              perPaymentLimitMinor: minor(control.per_payment_limit_minor),
              periodLimitMinor: minor(control.period_limit_minor),
              periodStartsAt: nullableText(control.period_starts_at),
              periodEndsAt: nullableText(control.period_ends_at),
            },
          ]
        : [];
    }),
    payments: array(source.payments).flatMap(item => {
      const payment = record(item);
      return payment && text(payment.id)
        ? [
            {
              id: text(payment.id),
              engagementId: text(payment.engagement_id),
              state: text(
                payment.state
              ) as CompanyBillingOverview["payments"][number]["state"],
              amountMinor: minor(payment.funding_total_minor),
              fundingTotalMinor: minor(payment.funding_total_minor),
              currency: text(payment.currency),
              createdAt: nullableText(payment.created_at),
              fundedAt: nullableText(payment.funded_at),
            },
          ]
        : [];
    }),
    sandboxModeOnly: bool(source.sandbox_mode_only),
  };
}

export async function getPrivatePayoutStatus(): Promise<PrivatePayoutStatus | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_private_payout_status");
  const source = error ? null : record(data);
  if (!source) return null;
  return {
    payoutAccounts: array(source.payout_accounts).flatMap(item => {
      const account = record(item);
      return account && text(account.id)
        ? [
            {
              id: text(account.id),
              state: text(account.state),
              requirementsStatusCode: text(account.requirements_status_code),
              lastVerifiedAt: nullableText(account.last_verified_at),
            },
          ]
        : [];
    }),
    payouts: array(source.payouts).flatMap(item => {
      const payout = record(item);
      return payout && text(payout.id)
        ? [
            {
              id: text(payout.id),
              state: text(
                payout.state
              ) as PrivatePayoutStatus["payouts"][number]["state"],
              amountMinor: minor(payout.amount_minor),
              currency: text(payout.currency),
              paidAt: nullableText(payout.paid_at),
              createdAt: nullableText(payout.created_at),
            },
          ]
        : [];
    }),
    sandboxModeOnly: bool(source.sandbox_mode_only),
    payoutDestinationDisclosure: text(source.payout_destination_disclosure),
  };
}

export async function getPaymentReconciliationQueue(): Promise<PaymentReconciliationQueue | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(
    "get_payment_reconciliation_queue"
  );
  const source = error ? null : record(data);
  if (!source) return null;
  return {
    runs: array(source.runs).flatMap(item => {
      const run = record(item);
      return run && text(run.id)
        ? [
            {
              id: text(run.id),
              state: text(run.state),
              createdAt: nullableText(run.created_at),
              startedAt: nullableText(run.started_at),
              completedAt: nullableText(run.completed_at),
            },
          ]
        : [];
    }),
    items: array(source.items).flatMap(item => {
      const queueItem = record(item);
      return queueItem && text(queueItem.id)
        ? [
            {
              id: text(queueItem.id),
              runId: text(queueItem.run_id),
              state: text(queueItem.state),
              reasonCode: text(queueItem.reason_code),
              createdAt: nullableText(queueItem.created_at),
              resolvedAt: nullableText(queueItem.resolved_at),
            },
          ]
        : [];
    }),
    deadLetters: array(source.dead_letters).flatMap(item => {
      const event = record(item);
      return event && text(event.id)
        ? [
            {
              id: text(event.id),
              eventType: text(event.event_type),
              normalizedEventType: text(event.normalized_event_type),
              failureCode: nullableText(event.failure_code),
              receivedAt: nullableText(event.received_at),
              retryCount: minor(event.retry_count),
            },
          ]
        : [];
    }),
  };
}
