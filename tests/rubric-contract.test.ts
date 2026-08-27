import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608270031_phase28_review_rubrics.sql"
  ),
  "utf8"
);
const hardening = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608270032_phase28_rubric_function_hardening.sql"
  ),
  "utf8"
);
const ownerHardening = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608270033_phase28_rubric_owner_transitions.sql"
  ),
  "utf8"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/rubric/actions.ts"),
  "utf8"
);
const context = readFileSync(
  resolve(process.cwd(), "lib/rubric/context.ts"),
  "utf8"
);
const surface = readFileSync(
  resolve(process.cwd(), "components/rubric/rubric-editor.tsx"),
  "utf8"
);
const proxy = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");

describe("Phase 28 controlled rubric authoring contract", () => {
  it("models project-scoped rubrics, immutable version records, dimensions, descriptors, calibration, locks, and audit events", () => {
    for (const table of [
      "project_rubrics",
      "project_rubric_versions",
      "project_rubric_dimensions",
      "project_rubric_descriptors",
      "project_rubric_calibration_examples",
      "project_rubric_calibration_disagreements",
      "project_workspace_rubric_locks",
      "project_rubric_events",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    for (const state of [
      "draft",
      "ready_for_review",
      "published",
      "locked",
      "archived",
    ]) {
      expect(migration).toContain(`'${state}'`);
    }
    expect(migration).toContain("assert_project_rubric_version_immutable");
    expect(migration).toContain("project_rubric_versions_are_immutable");
    expect(migration).toContain("rubric.version_locked");
    expect(migration).toContain("project_workspace_rubric_locks");
  });

  it("uses controlled organization authoring, owner-only publish/archive, private helpers, and no direct table mutation policy", () => {
    expect(migration).toContain("require_active_company_rubric_author");
    expect(ownerHardening).toContain("require_active_company_rubric_owner");
    expect(ownerHardening).toContain(
      "requested_state in ('published', 'archived')"
    );
    expect(hardening).toContain("set schema private");
    expect(hardening).toContain("private.project_rubric_payload_is_valid");
    expect(hardening).toContain("private.lock_project_workspace_rubric");
    expect(migration).not.toMatch(
      /create policy[^;]+for\s+(insert|update|delete)/i
    );
    expect(migration).toContain("revoke all on table public.project_rubrics");
  });

  it("makes descriptor and feedback visibility explicit, keeps calibration disagreement private, and prevents reviewer-private guidance from reaching talent", () => {
    for (const visibility of [
      "talent_and_company",
      "company_only",
      "reviewer_private",
    ]) {
      expect(migration).toContain(`'${visibility}'`);
    }
    expect(migration).toContain("project_rubric_calibration_disagreements");
    expect(migration).toContain("reviewer_user_id = auth.uid()");
    expect(migration).toContain(
      "case when access_role = 'talent_participant' then null else dimension.reviewer_guidance end"
    );
    expect(migration).toContain(
      "dimension.feedback_visibility = 'talent_and_company'"
    );
  });

  it("uses server-only sessions, active contexts, rate limits, restricted RPC readers, and a protected private route", () => {
    expect(actions).toContain('"use server"');
    expect(actions).toContain("getVerifiedAuthSession");
    expect(actions).toContain(
      'authorizeActiveContext({ role: "company_member" })'
    );
    expect(actions).toContain('authorizeActiveContext({ role: "reviewer" })');
    expect(actions).toContain("securityRateLimiter.check");
    expect(context).toContain('supabase.rpc("get_company_project_rubric"');
    expect(proxy).toContain('pathname.startsWith("/company/projects/")');
    expect(surface).toContain("Historical version preserved");
  });

  it("does not introduce a review queue, review decision, reputation, payout, or AI scoring feature", () => {
    const phaseSurface = [actions, context, surface, migration].join("\n");
    for (const forbidden of [
      "reviewQueue",
      "reviewDecision",
      "reviewerEarning",
      "createPayment",
      "invokeLLM",
      "aiScore",
    ]) {
      expect(phaseSurface).not.toContain(forbidden);
    }
  });
});
