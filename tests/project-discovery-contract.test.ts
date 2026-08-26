import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608260017_phase23_project_discovery.sql"
  ),
  "utf8"
);
const hardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608260018_phase23_discovery_performance_hardening.sql"
  ),
  "utf8"
);
const discovery = readFileSync(
  resolve(process.cwd(), "lib/project/discovery.ts"),
  "utf8"
);
const context = readFileSync(
  resolve(process.cwd(), "lib/project/context.ts"),
  "utf8"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/project/actions.ts"),
  "utf8"
);
const indexPage = readFileSync(
  resolve(process.cwd(), "app/projects/page.tsx"),
  "utf8"
);
const indexView = readFileSync(
  resolve(process.cwd(), "components/project/project-discovery.tsx"),
  "utf8"
);
const publicView = readFileSync(
  resolve(process.cwd(), "components/project/public-project.tsx"),
  "utf8"
);

describe("Phase 23 deterministic project discovery contract", () => {
  it("uses a bounded public reader with text and governed-skill indexes, current states, dates, stable ordering, and cursor pagination", () => {
    expect(migration).toContain("get_public_project_discovery");
    expect(migration).toContain("company_project_drafts_discovery_text_idx");
    expect(migration).toContain("company_project_drafts_discovery_skills_idx");
    expect(migration).toContain(
      "publication.state in ('published','accepting_applications')"
    );
    expect(migration).toContain("project.visibility = 'public'");
    expect(migration).toContain("project.application_deadline >= current_date");
    expect(migration).toContain("updated_at desc");
    expect(migration).toContain("requested_cursor_public_id");
  });

  it("keeps private, invite-only, paused, closed, archived, expired, and company-only draft context out of discovery", () => {
    expect(migration).not.toContain(
      "publication.state in ('published','accepting_applications','paused')"
    );
    expect(discovery).not.toContain(
      'private_invite_only" | "private_invite_only'
    );
    expect(context).toContain('projectType === "private_invite_only"');
    expect(indexView).toContain(
      "Saved projects that are paused, closed, private, or past their deadline are not shown here."
    );
  });

  it("uses URL-backed filters and exposes transparent deterministic reasons instead of AI matching, popularity, or a talent score", () => {
    expect(discovery).toContain("parseProjectDiscoverySearchParams");
    expect(discovery).toContain("projectDiscoveryQueryString");
    expect(indexView).toContain("Why this appears");
    expect(indexView).toContain("never popularity or a talent score");
    expect(indexView).not.toMatch(
      /AI matching|candidate search|recommended for you/i
    );
  });

  it("stores saved projects and recent searches only for an active talent context, with private RLS reads and authenticated-only mutation RPCs", () => {
    expect(migration).toContain("talent_saved_projects");
    expect(migration).toContain("talent_project_search_history");
    expect(migration).toContain("require_active_talent_project_context");
    expect(migration).toContain("toggle_talent_saved_project");
    expect(migration).toContain("record_talent_project_search");
    expect(migration).toContain(
      "grant execute on function public.toggle_talent_saved_project(text), public.record_talent_project_search(text, jsonb), public.get_talent_saved_project_ids(integer), public.get_talent_recent_project_searches(integer) to authenticated"
    );
    expect(migration).not.toContain(
      "grant execute on function public.toggle_talent_saved_project(text) to anon"
    );
    expect(actions).toContain('authorizeActiveContext({ role: "talent" })');
    expect(hardeningMigration).toContain("user_id = (select auth.uid())");
  });

  it("keeps public index metadata canonical while setting query-specific and saved views to noindex, and preserves a non-operative project detail boundary", () => {
    expect(indexPage).toContain('alternates: { canonical: "/projects" }');
    expect(indexPage).toContain("hasQuerySpecificState");
    expect(indexPage).toContain("index: false, follow: false");
    expect(publicView).toMatch(
      /Participation and\s+application submission are not enabled in this phase\./
    );
    expect(publicView).toMatch(/does not accept\s+applications/);
    expect(publicView).not.toMatch(
      /apply now|start application|send message|pay now/i
    );
  });
});
