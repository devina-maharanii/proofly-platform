/** Phase 12 RLS contract tests: migration-level checks prevent accidental client authority or organization leakage. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250001_phase12_roles_and_organizations.sql"
  ),
  "utf8"
);
const reviewerResolutionGuard = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250002_phase12_reviewer_resolution_guard.sql"
  ),
  "utf8"
);
const rpcGrantHardening = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250003_phase12_rpc_grant_hardening.sql"
  ),
  "utf8"
);
const roleActions = readFileSync(
  resolve(process.cwd(), "lib/roles/actions.ts"),
  "utf8"
);
const roleContext = readFileSync(
  resolve(process.cwd(), "lib/roles/context.ts"),
  "utf8"
);

describe("Phase 12 Supabase RLS and mutation boundary", () => {
  it("creates every approved organization and role table with RLS enabled", () => {
    for (const table of [
      "organizations",
      "organization_memberships",
      "role_capabilities",
      "capability_requests",
      "active_contexts",
      "authorization_events",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
  });

  it("requires authenticated membership and exact organization permission in database policy helpers", () => {
    expect(migration).toContain("membership.user_id = auth.uid()");
    expect(migration).toContain("membership.status = 'active'");
    expect(migration).toContain("'owner' = any(membership.permissions)");
    expect(migration).toContain("raise exception 'NOT_FOUND_OR_PRIVATE'");
  });

  it("revokes anonymous and signed-in access to helper and elevation RPCs", () => {
    expect(rpcGrantHardening).toContain("from anon, authenticated");
    expect(rpcGrantHardening).toContain(
      "revoke all on function public.grant_administrator_capability(uuid)"
    );
    expect(rpcGrantHardening).toContain(
      "revoke all on function public.resolve_reviewer_capability(uuid, boolean, text)"
    );
    expect(rpcGrantHardening).toContain(
      "grant execute on function public.set_active_context(public.active_context_role, uuid) to authenticated"
    );
  });

  it("prevents client forms from self-assigning reviewer or administrator capability", () => {
    expect(migration).toContain("requested_role = 'reviewer'");
    expect(migration).toContain("not public.is_platform_administrator()");
    expect(reviewerResolutionGuard).toContain("and status = 'pending'");
    expect(reviewerResolutionGuard).toContain("if not found then");
    expect(roleActions).toContain(
      'supabase.rpc("request_reviewer_capability")'
    );
    expect(roleActions).not.toContain("role_capabilities");
  });

  it("keeps a reviewer request pending until a separate qualified resolution", () => {
    expect(migration).toContain(
      "status public.capability_request_status not null default 'pending'"
    );
    expect(migration).toContain(
      "when public.capability_requests.status in ('declined', 'withdrawn') then 'pending'"
    );
    expect(reviewerResolutionGuard).toContain("and status = 'pending'");
  });

  it("re-authorizes a submitted role and organization with server state instead of accepting client user or membership claims", () => {
    expect(roleActions).toContain('supabase.rpc("set_active_context"');
    expect(roleActions).not.toContain("userId");
    expect(roleActions).not.toContain("permissions");
    expect(roleActions).not.toContain('formData.get("userId")');
    expect(roleContext).toContain('.eq("status", "active")');
  });
});
