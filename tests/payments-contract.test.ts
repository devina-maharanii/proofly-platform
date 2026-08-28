import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  parseEngagementPaymentForm,
  parsePaymentRefundForm,
  parsePaymentReleaseForm,
  parsePlatformPaymentDisputeForm,
} from "@/lib/payments/validation";

const engagementId = "550e8400-e29b-41d4-a716-446655440000";
const milestoneId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const paymentIntentId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("Phase 34 payment contracts", () => {
  it("accepts only bounded IDs and integer minor-unit refund amounts", () => {
    const result = parsePaymentRefundForm(
      form({
        paymentIntentId,
        amountMinor: "12500",
        reason: "Milestone was cancelled before provider settlement completed.",
      })
    );

    expect(result.success).toBe(true);
    expect(
      parsePaymentRefundForm(
        form({
          paymentIntentId,
          amountMinor: "0",
          reason: "This is a sufficiently detailed refund rationale.",
        })
      ).success
    ).toBe(false);
    expect(
      parsePaymentRefundForm(
        form({
          paymentIntentId,
          amountMinor: "12.50",
          reason: "This is a sufficiently detailed refund rationale.",
        })
      ).success
    ).toBe(false);
  });

  it("does not accept card, bank, tax, or credential fields as payment input", () => {
    const data = form({
      engagementId,
      cardNumber: "4242424242424242",
      bankAccount: "raw-account",
      taxIdentifier: "raw-tax-id",
      secretKey: "sk_test_never_from_form",
    });
    const result = parseEngagementPaymentForm(data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ engagementId });
      expect(result.data).not.toHaveProperty("cardNumber");
      expect(result.data).not.toHaveProperty("secretKey");
    }
  });

  it("requires exact UUID linkage for release and platform dispute commands", () => {
    expect(
      parsePaymentReleaseForm(form({ engagementId, milestoneId })).success
    ).toBe(true);
    expect(
      parsePaymentReleaseForm(form({ engagementId, milestoneId: "not-a-uuid" }))
        .success
    ).toBe(false);
    expect(
      parsePlatformPaymentDisputeForm(
        form({
          paymentIntentId,
          engagementDisputeId: milestoneId,
          reason: "Provider status and engagement evidence need human review.",
        })
      ).success
    ).toBe(true);
  });

  it("fails closed for live keys and keeps provider events reviewable", () => {
    const configSource = readFileSync("lib/payments/config.ts", "utf8");
    const adapterSource = readFileSync("lib/payments/stripe.ts", "utf8");
    expect(configSource).toContain('secretKey?.startsWith("sk_test_")');
    expect(configSource).toContain('webhookSecret?.startsWith("whsec_")');
    expect(adapterSource).toContain('"funding_succeeded"');
    expect(adapterSource).toContain('"refund_failed"');
    expect(adapterSource).toContain('"payout_reversed"');
    expect(adapterSource).toContain('"ignored"');
  });

  it("keeps provider credentials and webhook processing server-only", () => {
    const configSource = readFileSync("lib/payments/config.ts", "utf8");
    const webhookSource = readFileSync(
      "app/api/payments/webhook/stripe/route.ts",
      "utf8"
    );
    expect(configSource).toContain('import "server-only"');
    expect(webhookSource).toContain("verifyAndNormalizeStripeEvent");
    expect(webhookSource).toContain("record_verified_payment_provider_event");
    expect(webhookSource).not.toContain("process.env.STRIPE_SECRET_KEY");
  });

  it("keeps database financial records private, append-only, and provider-event idempotent", () => {
    const foundation = readFileSync(
      "supabase/migrations/202608270056_phase34_payment_foundation.sql",
      "utf8"
    );
    const commands = readFileSync(
      "supabase/migrations/202608270057_phase34_payment_commands.sql",
      "utf8"
    );
    const ledger = readFileSync(
      "supabase/migrations/202608270058_phase34_ledger_balance_hardening.sql",
      "utf8"
    );
    const privacy = readFileSync(
      "supabase/migrations/202608270059_phase34_financial_privacy_readers.sql",
      "utf8"
    );
    const grants = readFileSync(
      "supabase/migrations/202608270065_phase34_reconciliation_grant_hardening.sql",
      "utf8"
    );
    expect(foundation.toLowerCase()).toContain("enable row level security");
    expect(foundation.toLowerCase()).toContain(
      "revoke all on table public.payment_provider_configurations"
    );
    expect(ledger).toContain(
      "create or replace function private.assert_payment_ledger_operation_balanced"
    );
    expect(commands).toContain(
      "on conflict (payment_intent_id, actor_user_id, event_type, idempotency_key)"
    );
    expect(commands).toContain("record_verified_payment_provider_event");
    expect(commands).toContain("provider_event_id");
    expect(privacy).toContain("payment_provider_events");
    expect(grants).toContain("revoke execute");
    expect(grants).toContain("from authenticated");
  });

  it("does not route financial facts into public proof, reputation, matching, or social messaging", () => {
    const actionSource = readFileSync("lib/payments/actions.ts", "utf8");
    const migrationSource = readFileSync(
      "supabase/migrations/202608270057_phase34_payment_commands.sql",
      "utf8"
    );
    expect(actionSource).not.toMatch(
      /(?:proof_events|reputation_events|matching|conversation)/i
    );
    expect(migrationSource).not.toMatch(
      /proof_events|reputation_events|matching/i
    );
  });
});

describe("Phase 34 corrected execution SQL", () => {
  it("keeps release execution linked through the canonical payout account FK", () => {
    const source = readFileSync(
      "supabase/migrations/202608270066_phase34_execution_schema_corrections.sql",
      "utf8"
    );
    expect(source).toContain("account.id = release_record.payout_account_id");
    expect(source).not.toContain("release_record.talent_user_id");
    expect(source).not.toContain("stable set search_path");
  });

  it("uses canonical refund idempotency and payment-event append contracts", () => {
    const source = readFileSync(
      "supabase/migrations/202608270066_phase34_execution_schema_corrections.sql",
      "utf8"
    );
    expect(source).toContain("requested_idempotency_key");
    expect(source).toContain("private.append_payment_event");
    expect(source).not.toMatch(
      /payment_refunds[\\s\\S]{0,240}\\bidempotency_key\\b/
    );
    expect(source).not.toContain("event_data");
    expect(source).not.toContain("provider_processing");
  });
});
