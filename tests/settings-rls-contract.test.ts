import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250006_phase14_account_settings.sql"
  ),
  "utf8"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/settings/actions.ts"),
  "utf8"
);
const context = readFileSync(
  resolve(process.cwd(), "lib/settings/context.ts"),
  "utf8"
);

describe("Phase 14 settings RLS and server-boundary contract", () => {
  it("enables RLS on every personal-settings table and provides owner-only read policies", () => {
    for (const table of [
      "personal_settings",
      "data_rights_requests",
      "account_security_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(migration).toContain("using ((select auth.uid()) = user_id)");
    expect(migration).toContain("using ((select auth.uid()) = actor_user_id)");
  });

  it("uses restricted self-service RPC grants and no anonymous access", () => {
    for (const signature of [
      "save_personal_settings(jsonb)",
      "request_data_right(public.data_rights_request_type)",
      "record_account_security_event(text)",
    ]) {
      expect(migration).toContain(
        `revoke all on function public.${signature} from public, anon`
      );
      expect(migration).toContain(
        `grant execute on function public.${signature} to authenticated`
      );
    }
  });

  it("derives account ownership from verified session and never accepts a client-supplied owner, role, or organization", () => {
    expect(context).toContain("getVerifiedAuthSession()");
    expect(actions).not.toMatch(/formData\.get\("userId"\)/);
    expect(actions).not.toMatch(/formData\.get\("role"\)/);
    expect(actions).not.toMatch(/formData\.get\("organizationId"\)/);
  });

  it("requires current-password confirmation before password, other-session, identity, export, and deletion mutations", () => {
    expect(actions).toMatch(
      /verifyCurrentPassword\(\s*parsed\.data\.currentPassword\s*\)/
    );
    expect(actions).toContain('signOut({ scope: "others" })');
    expect(actions).toContain("unlinkIdentity(githubIdentity)");
    expect(actions).toContain('requested_event: "account.password_changed"');
    expect(actions).toContain('requested_event: "account.sessions_revoked"');
    expect(actions).toContain('requested_event: "account.identity_unlinked"');
  });

  it("keeps sensitive event payloads free of passwords, tokens, and private request content", () => {
    expect(migration).not.toMatch(/\bpassword\s+(text|varchar|jsonb)/i);
    expect(migration).not.toContain("access_token");
    expect(migration).not.toContain("refresh_token");
    expect(migration).not.toContain("payload jsonb");
  });
});
