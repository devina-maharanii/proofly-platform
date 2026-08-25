import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250011_phase19_github_integration.sql"
  ),
  "utf8"
);
const edgeFunction = readFileSync(
  resolve(process.cwd(), "supabase/functions/github-integration/index.ts"),
  "utf8"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/github/actions.ts"),
  "utf8"
);
const publicProfile = readFileSync(
  resolve(process.cwd(), "components/profile/public-talent-profile.tsx"),
  "utf8"
);
const settingsSurface = readFileSync(
  resolve(process.cwd(), "components/settings/account-settings.tsx"),
  "utf8"
);
const connectRoute = readFileSync(
  resolve(process.cwd(), "app/api/github/connect/route.ts"),
  "utf8"
);

describe("Phase 19 GitHub consent and privacy contract", () => {
  it("keeps every provider connection, snapshot, exclusion, sync, and event record behind RLS with no direct browser table reads", () => {
    for (const table of [
      "github_oauth_attempts",
      "github_connections",
      "github_repository_snapshots",
      "github_repository_exclusions",
      "github_sync_runs",
      "github_integration_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(migration).toContain(
      "revoke all on table public.github_oauth_attempts, public.github_connections, public.github_repository_snapshots, public.github_repository_exclusions, public.github_sync_runs, public.github_integration_events from anon, authenticated"
    );
    expect(migration).toContain("get_own_github_integration_context()");
    expect(migration).toContain(
      "grant execute on function public.get_own_github_integration_context() to authenticated"
    );
    expect(migration).not.toContain(
      "grant select on table public.github_oauth_attempts"
    );
  });

  it("restricts public GitHub output to a published Talent profile and explicitly selected, non-removed snapshots", () => {
    expect(migration).toContain(
      "get_public_talent_github_context(requested_handle text)"
    );
    expect(migration).toContain("profile.state = 'published'");
    expect(migration).toContain("repository.selected_public");
    expect(migration).toContain("repository.removed_at is null");
    expect(migration).toContain(
      "connection.status in ('connected', 'partially_synced')"
    );
    expect(migration).toContain("'context_status', 'not_verified'");
    expect(migration).toContain(
      "grant execute on function public.get_public_talent_github_context(text) to anon, authenticated"
    );
  });

  it("stores only ciphertext for provider tokens and records revocation with local data deletion", () => {
    expect(migration).toContain("encrypted_access_token text");
    expect(migration).toContain("encrypted_refresh_token text");
    expect(migration).not.toContain("raw_provider_payload");
    expect(migration).not.toContain("private_repository");
    expect(edgeFunction).toContain('name: "AES-GCM"');
    expect(edgeFunction).toContain("encrypted_access_token: null");
    expect(edgeFunction).toContain("encrypted_refresh_token: null");
    expect(edgeFunction).toContain("data_deleted_at: now");
    expect(edgeFunction).toContain("revokeGithubToken(providerToken)");
  });

  it("enforces one-time OAuth state, PKCE, empty scopes, HTTPS provider URLs, and a bounded public-owner import", () => {
    expect(edgeFunction).toContain('code_challenge_method: "S256"');
    expect(edgeFunction).toContain("state_hash: await sha256(state)");
    expect(edgeFunction).toContain("expires_at: nowPlus(600)");
    expect(edgeFunction).toContain("attempt.consumed_at");
    expect(edgeFunction).toContain("body.scope?.trim()");
    expect(edgeFunction).toContain('Deno.env.get("SUPABASE_ANON_KEY")');
    expect(edgeFunction).toContain("visibility=public&affiliation=owner");
    expect(edgeFunction).toContain("per_page=100&page=1");
    expect(edgeFunction).toContain("/^https:\\/\\/github\\.com\\//");
    expect(edgeFunction).toContain("await encrypt(token.access_token)");
  });

  it("runs initial and manual imports asynchronously with idempotency, bounded outcomes, and explicit provider failure states", () => {
    expect(migration).toContain("unique (connection_id, idempotency_key)");
    expect(migration).toContain("repositories_seen <= 100");
    expect(migration).toContain("repositories_imported <= 100");
    expect(edgeFunction).toContain(
      "EdgeRuntime.waitUntil(synchronize(connection.id, run.id))"
    );
    expect(edgeFunction).toContain(
      "EdgeRuntime.waitUntil(synchronize(connection.id, selectedRun.id))"
    );
    expect(edgeFunction).toContain('code === "rate_limited"');
    expect(edgeFunction).toContain("github.sync_rate_limited");
    expect(actions).toContain("Idempotency-Key");
    expect(connectRoute).toContain("securityRateLimiter.check");
    expect(connectRoute).toContain('settingsRedirect("rate-limited")');
    expect(actions).toContain(
      "Existing selected public context remains unchanged"
    );
    expect(settingsSurface).toContain("GitHub authorization was cancelled");
    expect(settingsSurface).toContain(
      "GitHub returned broader access than Proofly accepts"
    );
  });

  it("keeps GitHub activity contextual and excludes automated assessment, private access, write operations, and future-phase review features", () => {
    expect(publicProfile).toContain("Source context / GitHub");
    expect(publicProfile).toContain("not Proofly-reviewed proof");
    expect(publicProfile).toContain("skill verification");
    expect(edgeFunction).not.toContain("/user/repos?visibility=private");
    expect(edgeFunction).not.toContain("POST /repos/");
    expect(edgeFunction).not.toContain("plagiarism");
    expect(edgeFunction).not.toContain("review rubric");
    expect(edgeFunction).not.toContain("score");
    expect(edgeFunction).not.toContain("artificial intelligence");
  });
});
