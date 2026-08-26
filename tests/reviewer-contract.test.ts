import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608260030_phase27_reviewer_onboarding.sql"
  ),
  "utf8"
);
const reviewerActions = readFileSync(
  resolve(process.cwd(), "lib/reviewer/actions.ts"),
  "utf8"
);
const reviewerContext = readFileSync(
  resolve(process.cwd(), "lib/reviewer/context.ts"),
  "utf8"
);
const reviewerTypes = readFileSync(
  resolve(process.cwd(), "lib/reviewer/types.ts"),
  "utf8"
);
const proxy = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
const reviewerSurface = readFileSync(
  resolve(process.cwd(), "components/reviewer/reviewer-application-editor.tsx"),
  "utf8"
);

describe("Phase 27 controlled reviewer onboarding contract", () => {
  it("models every explicit reviewer lifecycle state with restricted, auditable transitions", () => {
    for (const state of [
      "requested",
      "in_screening",
      "needs_more_evidence",
      "approved",
      "active",
      "paused",
      "suspended",
      "rejected",
    ]) {
      expect(migration).toContain(`'${state}'`);
    }
    expect(migration).toContain("reviewer_admin_transition_is_valid");
    expect(migration).toContain("resolve_reviewer_application(");
    expect(migration).toContain("reviewer_application.state_changed");
    expect(migration).toContain("actor_id = target_user_id");
    expect(migration).toContain("has_active_platform_administrator_context");
  });

  it("keeps profiles, evidence, conflicts, policy agreement, and audit records private under RLS with no direct mutation policy", () => {
    for (const table of [
      "reviewer_applications",
      "reviewer_profiles",
      "reviewer_profile_skills",
      "reviewer_application_evidence",
      "reviewer_conflict_declarations",
      "reviewer_policy_agreements",
      "reviewer_application_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(migration).not.toMatch(
      /create policy[^;]+for\s+(insert|update|delete)/i
    );
    expect(migration).toContain(
      "revoke all on table public.reviewer_applications"
    );
    expect(migration).toContain(
      "grant select on table public.reviewer_applications"
    );
    expect(migration).toContain("get_reviewer_admin_queue");
    expect(migration).toContain("get_reviewer_admin_application");
  });

  it("enforces canonical expertise, practical evidence, conflict scope, current policy agreement, capacity, and active reviewer state before private material access", () => {
    expect(migration).toContain("taxonomy_version = '1.0.0'");
    expect(migration).toContain("reviewer_application_payload_is_valid");
    expect(migration).toContain("reviewer_profile_is_submittable");
    expect(migration).toContain("reviewer_is_eligible_for_workspace");
    expect(migration).toContain(
      "submission.talent_user_id = application.user_id"
    );
    expect(migration).toContain("conflict.scope = 'general'");
    expect(migration).toContain("profile.max_concurrent_reviews");
    expect(migration).toContain("member.review_material_granted = true");
    expect(migration).toContain("public.reviewer_is_eligible_for_workspace");
    expect(reviewerTypes).toContain("self_review_prohibited");
    expect(reviewerTypes).toContain("organization_relationship_blocks_review");
  });

  it("keeps commands and readers server-only, rate-limited, active-context-checked, and protected from direct route access", () => {
    expect(reviewerActions).toContain('"use server"');
    expect(reviewerActions).toContain("getVerifiedAuthSession");
    expect(reviewerActions).toContain("securityRateLimiter.check");
    expect(reviewerActions).toContain(
      'authorizeActiveContext({ role: "administrator" })'
    );
    expect(reviewerContext).toContain(
      'supabase.rpc("get_reviewer_application")'
    );
    expect(reviewerContext).toContain(
      'supabase.rpc("get_reviewer_admin_queue"'
    );
    expect(proxy).toContain('pathname.startsWith("/reviewer/")');
    expect(proxy).toContain('pathname.startsWith("/admin/reviewers")');
  });

  it("does not introduce review scoring, decisions, payment, public reputation, or AI assistance", () => {
    for (const forbidden of [
      "scoreSubmission",
      "reviewDecision",
      "createPayment",
      "reviewerEarning",
      "invokeLLM",
      "public reviewer reputation",
    ]) {
      expect(reviewerActions).not.toContain(forbidden);
      expect(reviewerSurface).not.toContain(forbidden);
    }
  });
});
