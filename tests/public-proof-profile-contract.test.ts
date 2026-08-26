import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250012_phase20_public_proof_profiles.sql"
  ),
  "utf8"
);
const publicProfile = readFileSync(
  resolve(process.cwd(), "components/profile/public-talent-profile.tsx"),
  "utf8"
);
const publicPage = readFileSync(
  resolve(process.cwd(), "app/talent/[handle]/page.tsx"),
  "utf8"
);
const shareControl = readFileSync(
  resolve(process.cwd(), "components/profile/public-profile-share.tsx"),
  "utf8"
);
const sitemap = readFileSync(resolve(process.cwd(), "app/sitemap.ts"), "utf8");

describe("Phase 20 public proof profile contract", () => {
  it("reserves stable route words in validation and database constraints", () => {
    expect(migration).toContain(
      "talent_profile_drafts_handle_not_reserved_check"
    );
    expect(migration).toContain(
      "talent_profile_publications_handle_not_reserved_check"
    );
    expect(migration).toContain("is_reserved_talent_profile_handle");
    expect(migration).toContain("'talent'");
    expect(migration).toContain("'settings'");
  });

  it("allows public readers to return only published profiles, published evidence, and active verified Proof", () => {
    expect(migration).toContain("profile.state = 'published'");
    expect(migration).toContain("proof.status = 'verified'");
    expect(migration).toContain("proof.revoked_at is null");
    expect(migration).toContain("evidence.state = 'published'");
    expect(migration).not.toContain("reviewer_notes");
  });

  it("keeps claimed skills, selected evidence, verified Proof, and GitHub context visibly distinct", () => {
    expect(publicProfile).toContain("Claimed skills");
    expect(publicProfile).toContain("Selected work evidence");
    expect(publicProfile).toContain("Verified Proof");
    expect(publicProfile).toContain("GitHub context");
    expect(publicProfile).toContain("not Proofly-reviewed proof");
    expect(publicProfile).not.toMatch(/leaderboard|universal score|followers/i);
  });

  it("sets canonical, Open Graph, and noindex behavior while enrolling only published profile handles in the sitemap", () => {
    expect(publicPage).toContain("alternates: { canonical: pathname }");
    expect(publicPage).toContain("opengraph-image");
    expect(publicPage).toContain("index: false, follow: false");
    expect(sitemap).toContain("getPublicTalentProfileSitemap");
    expect(sitemap).toContain("publicTalentProfilePath");
  });

  it("provides accessible native-share and clipboard fallback controls without a social feed", () => {
    expect(shareControl).toContain("navigator.share");
    expect(shareControl).toContain("navigator.clipboard.writeText");
    expect(shareControl).toContain('role="status"');
  });
});
