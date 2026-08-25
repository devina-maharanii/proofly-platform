import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250007_phase17_talent_profiles.sql"
  ),
  "utf8"
);
const languagePrivacyMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250008_phase17_language_privacy.sql"
  ),
  "utf8"
);
const profileHardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250009_phase17_profile_validation_hardening.sql"
  ),
  "utf8"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/profile/actions.ts"),
  "utf8"
);
const context = readFileSync(
  resolve(process.cwd(), "lib/profile/context.ts"),
  "utf8"
);
const publicView = readFileSync(
  resolve(process.cwd(), "components/profile/public-talent-profile.tsx"),
  "utf8"
);

describe("Phase 17 Talent profile RLS and privacy contract", () => {
  it("enables RLS and allows only owner reads for every private profile record", () => {
    for (const table of [
      "talent_profile_drafts",
      "talent_profile_skills",
      "talent_profile_links",
      "talent_profile_publications",
      "talent_profile_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(migration).toContain("using ((select auth.uid()) = user_id)");
    expect(migration).toContain("using ((select auth.uid()) = actor_user_id)");
    expect(migration).not.toContain(
      'create policy "public can view talent profile'
    );
  });

  it("derives ownership and Talent capability server-side and blocks direct table writes", () => {
    expect(migration).toContain("public.require_active_talent_profile_actor()");
    expect(migration).toContain("active_role = 'talent'");
    expect(actions).toContain('authorizeActiveContext({ role: "talent" })');
    expect(actions).not.toMatch(/formData\.get\("userId"\)/);
    expect(actions).not.toMatch(/formData\.get\("role"\)/);
    expect(actions).not.toMatch(/formData\.get\("organizationId"\)/);
    expect(migration).toContain(
      "revoke all on table public.talent_profile_drafts, public.talent_profile_skills, public.talent_profile_links, public.talent_profile_publications, public.talent_profile_events from anon, authenticated"
    );
  });

  it("uses authenticated-only self-service lifecycle functions and leaves public read fail-closed to a snapshot function", () => {
    for (const signature of [
      "save_talent_profile(jsonb, jsonb, jsonb)",
      "mark_talent_profile_ready()",
      "publish_talent_profile()",
      "hide_talent_profile()",
    ]) {
      expect(migration).toContain(
        `revoke all on function public.${signature} from public, anon`
      );
      expect(migration).toContain(
        `grant execute on function public.${signature} to authenticated`
      );
    }
    expect(migration).toContain(
      "grant execute on function public.get_public_talent_profile(text) to anon, authenticated"
    );
    expect(migration).toContain(
      "where handle = lower(trim(requested_handle)) and state = 'published'"
    );
  });

  it("publishes only approved snapshots and never exposes private contact or payment preference fields", () => {
    const publicFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.publish_talent_profile()"
      ),
      migration.indexOf(
        "create or replace function public.hide_talent_profile()"
      )
    );
    expect(publicFunction).toContain(
      "case when draft.profile_image_visibility = 'public'"
    );
    expect(publicFunction).toContain(
      "case when draft.location_visibility = 'public'"
    );
    expect(publicFunction).toContain(
      "case when draft.timezone_visibility = 'public'"
    );
    expect(publicFunction).toContain("where user_id = actor_id and is_public");
    expect(publicFunction).not.toContain("rate_range");
    expect(languagePrivacyMigration).toContain(
      "add column languages_visibility public.profile_field_visibility not null default 'private'"
    );
    expect(languagePrivacyMigration).not.toContain(
      "'languages', draft.languages"
    );
    expect(publicView).toContain("Claimed skills");
    expect(publicView).toMatch(/not verified\s+proof/);
    expect(context).toContain("get_public_talent_profile");
  });

  it("enforces bounded text lists and publication acknowledgement at the database and server-action boundaries", () => {
    expect(profileHardeningMigration).toContain("is_bounded_profile_text_list");
    expect(profileHardeningMigration).toContain(
      "talent_profile_drafts_languages_text_list_check"
    );
    expect(profileHardeningMigration).toContain("CONFIRMATION_REQUIRED");
    expect(profileHardeningMigration).toContain(
      "grant execute on function public.publish_talent_profile(boolean) to authenticated"
    );
    expect(actions).toContain('formData.get("confirmPublicProfile")');
    expect(actions).toContain("acknowledged_public_fields: true");
  });
});
