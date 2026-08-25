import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const onboardingMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250004_phase13_onboarding.sql"
  ),
  "utf8"
);
const hardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250005_phase13_reviewer_draft_hardening.sql"
  ),
  "utf8"
);
const onboardingActions = readFileSync(
  resolve(process.cwd(), "lib/onboarding/actions.ts"),
  "utf8"
);
const onboardingContext = readFileSync(
  resolve(process.cwd(), "lib/onboarding/context.ts"),
  "utf8"
);

describe("Phase 13 onboarding RLS and privacy contract", () => {
  it("enables RLS on every private onboarding table and exposes read access only to the record owner", () => {
    for (const table of ["onboarding_progress", "onboarding_events"]) {
      expect(onboardingMigration).toContain(`create table public.${table}`);
      expect(onboardingMigration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(onboardingMigration).toContain("(select auth.uid()) = user_id");
    expect(onboardingMigration).toContain(
      "(select auth.uid()) = actor_user_id"
    );
    expect(onboardingMigration).not.toContain(
      "on public.onboarding_progress for insert"
    );
  });

  it("keeps privacy-safe events structural: no arbitrary metadata or private draft value is accepted by the event table", () => {
    expect(onboardingMigration).toContain("event_type text not null check");
    expect(onboardingMigration).toContain("step_key text check");
    expect(onboardingMigration).not.toContain("metadata jsonb");
    expect(onboardingMigration).not.toContain("event_payload");
  });

  it("uses auth.uid and active membership/context checks rather than client user, role, or organization authority", () => {
    expect(onboardingMigration).toContain("actor_id uuid := auth.uid()");
    expect(onboardingMigration).toContain(
      "not public.is_active_organization_member(requested_organization_id)"
    );
    expect(onboardingMigration).toContain(
      "active_context.active_organization_id = requested_organization_id"
    );
    expect(onboardingActions).toContain("authorizeActiveContext()");
    expect(onboardingActions).not.toContain('formData.get("userId")');
    expect(onboardingActions).not.toContain('formData.get("permissions")');
    expect(onboardingContext).toContain('.eq("user_id", session.userId)');
  });

  it("keeps reviewer access human-controlled: the request creates no role capability and a draft is allowed before approval", () => {
    expect(onboardingMigration).toContain("'onboarding.reviewer_requested'");
    expect(onboardingMigration).toContain(
      "insert into public.capability_requests (user_id, requested_role, status)"
    );
    expect(onboardingMigration).not.toContain(
      "insert into public.role_capabilities"
    );
    expect(hardeningMigration).toContain(
      "create or replace function public.save_reviewer_onboarding_draft"
    );
  });

  it("limits callable security-definer onboarding RPCs to authenticated self-service operations and revokes anonymous access", () => {
    for (const functionName of [
      "start_company_onboarding(text, text)",
      "save_onboarding_draft(public.active_context_role, uuid, jsonb, text[], public.onboarding_state, text)",
      "complete_onboarding(public.active_context_role, uuid, jsonb, text[])",
      "complete_reviewer_onboarding(jsonb, text[])",
    ]) {
      expect(onboardingMigration).toContain(
        `revoke all on function public.${functionName} from public, anon`
      );
    }
    expect(hardeningMigration).toContain(
      "revoke all on function public.save_reviewer_onboarding_draft(jsonb, text[], text) from public, anon"
    );
    expect(hardeningMigration).toContain(
      "grant execute on function public.save_reviewer_onboarding_draft(jsonb, text[], text) to authenticated"
    );
  });

  it("bounds private draft size and whitelists reviewer draft keys before persistence", () => {
    expect(hardeningMigration).toContain("draft_size_check");
    expect(hardeningMigration).toContain("octet_length(draft::text) <= 12000");
    expect(hardeningMigration).toContain("jsonb_object_keys(requested_draft)");
    expect(hardeningMigration).toContain("where key <> all(valid_keys)");
  });
});
