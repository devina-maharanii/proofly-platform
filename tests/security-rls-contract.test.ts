import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

function migration(name: string) {
  return readFileSync(
    join(repositoryRoot, "supabase/migrations", name),
    "utf8"
  );
}

describe("Phase 15 RLS and privileged-boundary contract", () => {
  it("keeps all released role, onboarding, and account tables behind RLS with narrow private read policies", () => {
    const roles = migration("202608250001_phase12_roles_and_organizations.sql");
    const onboarding = migration("202608250004_phase13_onboarding.sql");
    const settings = migration("202608250006_phase14_account_settings.sql");

    for (const table of [
      "organizations",
      "organization_memberships",
      "role_capabilities",
      "capability_requests",
      "active_contexts",
      "authorization_events",
      "onboarding_progress",
      "onboarding_events",
      "personal_settings",
      "data_rights_requests",
      "account_security_events",
    ]) {
      const source = [roles, onboarding, settings].join("\n");
      expect(source).toMatch(
        new RegExp(
          `alter table public\\.${table} enable row level security`,
          "i"
        )
      );
    }
    expect(settings).toContain("people can view their private settings");
    expect(settings).toContain("people can view their data rights requests");
    expect(settings).toContain("people can view their security events");
  });

  it("does not grant direct ordinary-user mutation policies or ordinary-user administration elevation", () => {
    const roles = migration("202608250001_phase12_roles_and_organizations.sql");
    const grants = migration("202608250003_phase12_rpc_grant_hardening.sql");

    expect(roles).not.toMatch(
      /for\s+(insert|update|delete)\s+to\s+(anon|authenticated)/i
    );
    expect(grants).toContain(
      "revoke all on function public.grant_administrator_capability"
    );
    expect(grants).toContain("from anon, authenticated");
  });

  it("leaves storage and provider endpoints deny-by-default until their own approved module adds private policies", () => {
    const securityRules = readFileSync(
      join(repositoryRoot, "docs/SECURITY_RULES.md"),
      "utf8"
    );
    expect(securityRules).toContain("no public bucket");
    expect(securityRules).toContain("no provider endpoint exists yet");
  });
});
