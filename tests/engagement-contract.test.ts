import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { engagementStates, engagementTypes } from "@/lib/engagement/types";

const read = (relative: string) =>
  readFileSync(resolve(process.cwd(), relative), "utf8");
const foundation = read(
  "supabase/migrations/202608270049_phase33_engagement_foundation.sql"
);
const commands = read(
  "supabase/migrations/202608270050_phase33_engagement_commands.sql"
);
const marketHardening = read(
  "supabase/migrations/202608270051_phase33_market_and_authorization_hardening.sql"
);
const changeOrders = read(
  "supabase/migrations/202608270052_phase33_change_order_hardening.sql"
);
const lifecycleHardening = read(
  "supabase/migrations/202608270053_phase33_lifecycle_and_access_hardening.sql"
);
const readers = read(
  "supabase/migrations/202608270054_phase33_private_reader_context.sql"
);
const ongoingReader = read(
  "supabase/migrations/202608270055_phase33_company_ongoing_contract_reader.sql"
);
const actions = read("lib/engagement/actions.ts");
const surface = read("components/engagement/engagement-surfaces.tsx");
const proxy = read("proxy.ts");

describe("Phase 33 bounded paid-trial and contract contract", () => {
  it("defines only the approved engagement types and explicit lifecycle states", () => {
    expect(engagementTypes).toEqual([
      "paid_trial",
      "milestone_contract",
      "ongoing_contract",
    ]);
    expect(engagementStates).toEqual(
      expect.arrayContaining([
        "draft",
        "proposed",
        "negotiating",
        "accepted",
        "funding_required",
        "funded",
        "in_progress",
        "submitted",
        "changes_requested",
        "accepted_for_payment",
        "completed",
        "declined",
        "expired",
        "cancelled_before_start",
        "terminated",
        "disputed",
        "resolved",
        "refunded",
      ])
    );
    expect(foundation).toContain("create type public.engagement_type");
    expect(commands).toContain("private.engagement_transition_allowed");
  });

  it("fails closed for unsupported markets and keeps provider funding private and non-browser-controlled", () => {
    expect(marketHardening).toContain("not private.engagement_company_context");
    expect(marketHardening).toContain("provider_capability_confirmed");
    expect(foundation).toContain("default 'blocked'");
    expect(commands).toContain(
      "create or replace function private.record_verified_engagement_funding"
    );
    expect(commands).toContain(
      "private.record_verified_engagement_funding(uuid, text, public.engagement_funding_state) from public, anon, authenticated"
    );
    expect(actions).not.toContain("record_verified_engagement_funding");
    expect(actions).not.toMatch(/stripe|checkout|payment_intent|transfer/i);
  });

  it("requires a company-origin eligible application proposal and a completed paid trial before ongoing work", () => {
    expect(marketHardening).toContain(
      "private.engagement_company_context(application_record.organization_id, 'hiring_member')"
    );
    expect(commands).toContain(
      "application.state in ('shortlisted', 'invited_to_trial', 'accepted')"
    );
    expect(commands).toContain(
      "parent.engagement_type = 'paid_trial' and parent.state = 'completed'"
    );
    expect(ongoingReader).toContain(
      "'application_id', engagement.application_id"
    );
    expect(actions).toContain('input.engagementType === "ongoing_contract"');
  });

  it("makes accepted terms and negotiated history append-only and requires explicit new versions for additive paid scope", () => {
    expect(foundation).toContain("terms_snapshot jsonb not null");
    expect(foundation).toContain("engagement_negotiation_entries");
    expect(changeOrders).toContain("additive_amount_minor bigint not null");
    expect(changeOrders).toContain("'compensation_amount_minor'");
    expect(changeOrders).toContain("'change_order_id'");
    expect(lifecycleHardening).toContain("PAID_TRIAL_CHANGE_ORDER_NOT_ALLOWED");
    expect(surface).toContain("Terms are not silently rewritten");
  });

  it("preserves milestone evidence and makes submissions, disputes, and resolutions idempotent and auditable", () => {
    expect(lifecycleHardening).toContain(
      "engagement_milestone_submissions_idempotency_idx"
    );
    expect(lifecycleHardening).toContain("engagement_disputes_idempotency_idx");
    expect(lifecycleHardening).toContain(
      "engagement_dispute_resolutions_idempotency_idx"
    );
    expect(lifecycleHardening).toContain("'evidence_preserved', true");
    expect(lifecycleHardening).toContain(
      "prior_state := engagement_record.state"
    );
    expect(lifecycleHardening).toContain("'new_work_remains_paused', true");
    expect(lifecycleHardening).toContain(
      "current_state = 'submitted' and requested_state in ('in_progress'"
    );
  });

  it("blocks production credentials and requires an expiry-bounded company-approved access ledger", () => {
    expect(foundation).toContain(
      "'repository', 'staging_environment', 'documentation', 'sandbox_data', 'other_non_production'"
    );
    expect(lifecycleHardening).toContain("role_record <> 'talent'");
    expect(lifecycleHardening).toContain("sensitive_pattern");
    expect(lifecycleHardening).toContain("state in ('requested', 'granted')");
    expect(surface).toMatch(
      /The access ledger does not deliver a URL, token, secret,\s+password, credential, or production access/
    );
  });

  it("keeps all engagement tables RLS-protected with no direct authenticated table grants", () => {
    for (const table of [
      "engagements",
      "engagement_terms_versions",
      "engagement_terms_acceptances",
      "engagement_negotiation_entries",
      "engagement_milestones",
      "engagement_milestone_submissions",
      "engagement_milestone_decisions",
      "engagement_access_grants",
      "engagement_disputes",
      "engagement_dispute_resolutions",
      "engagement_change_orders",
      "engagement_events",
      "engagement_funding_events",
    ]) {
      expect(foundation).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(foundation).toContain("from anon, authenticated");
    expect(readers).toContain("private.require_engagement_participant");
    expect(actions).toContain("getVerifiedAuthSession");
    expect(actions).toContain("securityRateLimiter.check");
  });

  it("keeps routes private/noindex and avoids proof, reputation, matching, social-messaging, legal, or AI decision side effects", () => {
    expect(proxy).toContain('"/engagements"');
    expect(proxy).toContain('"/admin/engagements/disputes"');
    expect(surface).toContain("not legal advice");
    expect(surface).toContain(
      "does not create public proof, reputation, matching signals, generic messaging"
    );
    expect(surface).not.toMatch(
      /leaderboard|ranking|automated hiring|AI decision/i
    );
    expect(actions).not.toMatch(
      /communication_messages|matching_|proof_reputation|verification_proofs/i
    );
  });
});
