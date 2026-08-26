import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608260016_phase22_company_projects.sql"
  ),
  "utf8"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/project/actions.ts"),
  "utf8"
);
const validation = readFileSync(
  resolve(process.cwd(), "lib/project/validation.ts"),
  "utf8"
);
const publicPage = readFileSync(
  resolve(process.cwd(), "app/projects/[publicId]/page.tsx"),
  "utf8"
);
const notFoundPage = readFileSync(
  resolve(process.cwd(), "app/projects/[publicId]/not-found.tsx"),
  "utf8"
);
const publicView = readFileSync(
  resolve(process.cwd(), "components/project/public-project.tsx"),
  "utf8"
);
const sitemap = readFileSync(resolve(process.cwd(), "app/sitemap.ts"), "utf8");

describe("Phase 22 company project contract", () => {
  it("uses organization-owned drafts, public snapshots, append-only lifecycle events, explicit state, RLS, and no upload storage", () => {
    expect(migration).toContain("company_project_drafts");
    expect(migration).toContain("company_project_publications");
    expect(migration).toContain("company_project_events");
    expect(migration).toContain(
      "'draft', 'preview', 'published', 'accepting_applications', 'paused', 'in_progress', 'closed', 'archived'"
    );
    expect(migration).toContain("attachment_policy = 'no_uploads_enabled'");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("require_active_company_project_context");
  });

  it("keeps organization scope server-derived, allows hiring members to save drafts, and requires an owner for preview, publication, and transitions", () => {
    expect(migration).toContain(
      "'owner' = any(membership.permissions) or 'hiring_member' = any(membership.permissions)"
    );
    expect(migration).toContain("require_active_company_project_context(true)");
    expect(actions).toContain(
      'authorizeActiveContext({ role: "company_member" })'
    );
    expect(actions).not.toContain("organizationId: formData");
    expect(actions).not.toContain("requested_organization_id");
  });

  it("hardens mutation RPCs against anonymous execution while permitting only bounded published readers anonymously", () => {
    expect(migration).toContain(
      "revoke all on function public.save_company_project(uuid, jsonb), public.prepare_company_project_preview(uuid), public.publish_company_project(uuid), public.transition_company_project(uuid, public.company_project_state), public.get_public_project(text), public.get_public_project_sitemap(integer) from public, anon"
    );
    expect(migration).toContain(
      "grant execute on function public.save_company_project(uuid, jsonb), public.prepare_company_project_preview(uuid), public.publish_company_project(uuid), public.transition_company_project(uuid, public.company_project_state) to authenticated"
    );
    expect(migration).toContain(
      "grant execute on function public.get_public_project(text), public.get_public_project_sitemap(integer) to anon, authenticated"
    );
    expect(migration).not.toContain(
      "grant execute on function public.save_company_project(uuid, jsonb) to anon"
    );
  });

  it("publishes only safe public snapshots and never exposes a private invite-only project through the public reader or sitemap", () => {
    expect(migration).toContain(
      "project_type = 'private_invite_only' and visibility = 'restricted'"
    );
    expect(migration).toContain(
      "publication.state in ('published', 'accepting_applications', 'paused')"
    );
    expect(migration).toContain("project.visibility = 'public'");
    expect(migration).toContain(
      "publication.state in ('published', 'accepting_applications')"
    );
    expect(sitemap).toContain("getPublicProjectSitemap");
    expect(sitemap).toContain("publicProjectPath");
  });

  it("enforces governed skills, protected-term rejection, explicit ownership and compensation, bounded evaluation time, weighted rubrics, deadlines, and response expectations", () => {
    expect(validation).toContain("canonicalSkills");
    expect(validation).toContain("protectedRequirementPattern");
    expect(validation).toContain(
      "Production work cannot be presented as unpaid evaluation"
    );
    expect(validation).toContain(
      "evaluation exercise must be bounded to 20 hours"
    );
    expect(validation).toContain("priorities must total 100");
    expect(validation).toContain("participantExpectations");
    expect(validation).toContain("expectedResponseTime");
    expect(validation).toContain("noProductionReuse");
  });

  it("uses noindex unavailable metadata and states public-surface boundaries instead of adding applications, messages, invitations, workspaces, contracts, payments, or hiring decisions", () => {
    expect(publicPage).toContain("alternates: { canonical: pathname }");
    expect(publicPage).toContain("opengraph-image");
    expect(notFoundPage).toContain("index: false, follow: false");
    expect(notFoundPage).toMatch(
      /Proofly does not disclose which condition\s+applies/
    );
    expect(publicView).not.toMatch(
      /apply now|send message|invite now|start payment/i
    );
    expect(publicView).toMatch(/does not accept\s+applications/);
    expect(publicView).toContain("issue or accept invitations");
    expect(publicView).toContain("make a hiring decision");
  });
});
