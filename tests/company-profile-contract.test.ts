import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608260013_phase21_company_profiles.sql"
  ),
  "utf8"
);
const attributionMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608260014_phase21_member_attribution_display_names.sql"
  ),
  "utf8"
);
const grantHardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608260015_phase21_company_profile_grant_hardening.sql"
  ),
  "utf8"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/company/actions.ts"),
  "utf8"
);
const publicPage = readFileSync(
  resolve(process.cwd(), "app/companies/[slug]/page.tsx"),
  "utf8"
);
const publicView = readFileSync(
  resolve(process.cwd(), "components/company/public-company-profile.tsx"),
  "utf8"
);
const sitemap = readFileSync(resolve(process.cwd(), "app/sitemap.ts"), "utf8");

describe("Phase 21 company profile contract", () => {
  it("uses organization-owned drafts, public snapshots, lifecycle history, and RLS", () => {
    expect(migration).toContain("company_profile_drafts");
    expect(migration).toContain("company_profile_publications");
    expect(migration).toContain("company_profile_events");
    expect(migration).toContain("company_profile.draft_saved");
    expect(migration).toContain("company_profile.ready_to_preview");
    expect(migration).toContain("company_profile.published");
    expect(migration).toContain("company_profile.hidden");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("require_active_company_profile_context");
  });

  it("keeps edits organization-scoped, allows only owners to publish or hide, and records member attribution separately", () => {
    expect(migration).toContain(
      "'owner' = any(membership.permissions) or 'hiring_member' = any(membership.permissions)"
    );
    expect(migration).toContain("require_active_company_profile_context(true)");
    expect(migration).toContain("company_profile_member_attributions");
    expect(migration).toContain("requested_member_is_public");
    expect(actions).toContain(
      'authorizeActiveContext({ role: "company_member" })'
    );
    expect(actions).not.toContain("organizationId: formData");
  });

  it("revokes anonymous execution from every company mutation while keeping only bounded public readers anonymous", () => {
    expect(grantHardeningMigration).toContain(
      "revoke all on function public.save_company_profile(jsonb, text, boolean) from public, anon"
    );
    expect(grantHardeningMigration).toContain(
      "revoke all on function public.publish_company_profile() from public, anon"
    );
    expect(grantHardeningMigration).toContain(
      "grant execute on function public.get_public_company_profile(text) to anon, authenticated"
    );
    expect(grantHardeningMigration).not.toContain(
      "grant execute on function public.save_company_profile(jsonb, text, boolean) to anon"
    );
  });

  it("projects public members only from both personal and company-level opt-in, with historical context", () => {
    expect(attributionMigration).toContain(
      "person_settings.membership_visibility = 'public'"
    );
    expect(attributionMigration).toContain("attribution.is_public");
    expect(attributionMigration).toContain(
      "'display_name', person_settings.display_name"
    );
    expect(attributionMigration).toContain("'historical'");
    expect(attributionMigration).not.toContain("email");
  });

  it("returns only published company snapshots through the public reader and protects route namespaces", () => {
    expect(migration).toContain("publication.state = 'published'");
    expect(migration).toContain("is_reserved_company_profile_handle");
    expect(migration).toContain("'companies'");
    expect(migration).toContain("get_public_company_profile_sitemap");
  });

  it("adds canonical metadata, Open Graph sharing, noindex unavailable state, and published-only sitemap enrollment", () => {
    expect(publicPage).toContain("alternates: { canonical: pathname }");
    expect(publicPage).toContain("opengraph-image");
    expect(publicPage).toContain("index: false, follow: false");
    expect(sitemap).toContain("getPublicCompanyProfileSitemap");
    expect(sitemap).toContain("publicCompanyProfilePath");
  });

  it("states boundaries instead of adding directory, messaging, application, project, billing, or ranking workflows", () => {
    expect(publicView).toContain("does not publish a role");
    expect(publicView).toContain(
      "does not establish organization verification"
    );
    expect(publicView).not.toMatch(
      /leaderboard|universal score|apply now|send message/i
    );
  });
});
