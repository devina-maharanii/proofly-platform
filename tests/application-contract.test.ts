import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608260019_phase24_project_applications.sql"
  ),
  "utf8"
);
const hardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608260020_phase24_application_input_hardening.sql"
  ),
  "utf8"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/application/actions.ts"),
  "utf8"
);
const context = readFileSync(
  resolve(process.cwd(), "lib/application/context.ts"),
  "utf8"
);
const editor = readFileSync(
  resolve(process.cwd(), "components/application/application-surfaces.tsx"),
  "utf8"
);
const publicProject = readFileSync(
  resolve(process.cwd(), "components/project/public-project.tsx"),
  "utf8"
);
const proxy = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");

describe("Phase 24 private Project Application contract", () => {
  it("models the complete approved state vocabulary while shipping only Talent draft, submit, and permitted withdrawal commands", () => {
    for (const state of [
      "draft",
      "submitted",
      "withdrawn",
      "shortlisted",
      "invited_to_trial",
      "accepted",
      "rejected",
      "closed",
    ]) {
      expect(migration).toContain(`'${state}'`);
    }
    expect(migration).toContain("save_talent_project_application(");
    expect(migration).toContain("submit_talent_project_application(");
    expect(migration).toContain("withdraw_talent_project_application(");
    expect(migration).not.toContain("shortlist_project_application");
    expect(migration).not.toContain("reject_project_application");
    expect(migration).not.toContain("accept_project_application");
  });

  it("enables RLS, denies direct table writes, derives Talent and organization scope server-side, and exposes only authenticated commands", () => {
    for (const table of [
      "project_applications",
      "project_application_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(migration).not.toMatch(
      /create policy[^;]+for\s+(insert|update|delete)/i
    );
    expect(migration).toContain(
      "public.require_active_talent_application_context()"
    );
    expect(migration).toContain(
      "public.has_organization_permission(organization_id, 'hiring_member')"
    );
    expect(migration).toContain(
      "revoke all on table public.project_applications, public.project_application_events from anon, authenticated"
    );
    for (const signature of [
      "save_talent_project_application(uuid, text, jsonb)",
      "submit_talent_project_application(uuid, boolean)",
      "withdraw_talent_project_application(uuid)",
      "get_talent_project_applications(integer)",
      "get_talent_project_application(uuid)",
      "get_company_project_application_receipt(uuid)",
    ]) {
      expect(migration).toContain(`public.${signature}`);
    }
    expect(migration).toContain("from public, anon;");
    expect(migration).toContain("to authenticated;");
    expect(actions).toContain('authorizeActiveContext({ role: "talent" })');
    expect(actions).not.toMatch(/formData\.get\("userId"\)/);
    expect(actions).not.toMatch(/formData\.get\("organizationId"\)/);
  });

  it("enforces accepting-public-project eligibility, deadline, active duplicate prevention, complete submission, confirmed terms, and auditable retention", () => {
    expect(migration).toContain("publication.state = 'accepting_applications'");
    expect(migration).toContain("project.state = 'accepting_applications'");
    expect(migration).toContain("project.application_deadline >= current_date");
    expect(migration).toContain("project.visibility = 'public'");
    expect(migration).toContain(
      "project_applications_one_active_per_talent_project_idx"
    );
    expect(migration).toContain(
      "where state in ('draft', 'submitted', 'shortlisted', 'invited_to_trial', 'accepted')"
    );
    expect(migration).toContain(
      "raise exception 'DUPLICATE_ACTIVE_APPLICATION'"
    );
    expect(migration).toContain(
      "confirmed_project_terms is distinct from true"
    );
    expect(migration).toContain(
      "public.project_application_is_submittable(result)"
    );
    expect(migration).toContain(
      "public.project_application_terms_snapshot(project_record)"
    );
    expect(migration).toContain("'application.submitted'");
    expect(migration).toContain(
      "previous not in ('draft', 'submitted', 'shortlisted', 'invited_to_trial')"
    );
    expect(migration).toContain(
      "Detailed application content is no longer shown in this receipt"
    );
  });

  it("preserves private evidence and profile boundaries inside an approved company-only receipt snapshot", () => {
    const snapshotFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.project_application_evidence_snapshot"
      ),
      migration.indexOf(
        "create or replace function public.project_application_terms_snapshot"
      )
    );
    expect(snapshotFunction).toContain(
      "'sharing_choice', 'application_private_receipt'"
    );
    for (const forbiddenField of [
      "permission_note",
      "source_reference_url",
      "publication",
      "url",
      "attributions",
    ]) {
      expect(snapshotFunction).not.toContain(forbiddenField);
    }
    expect(snapshotFunction).toContain("item.state <> 'archived'");
    expect(context).toContain("get_company_project_application_receipt");
    expect(context).not.toContain("get_public_project_application");
    expect(editor).toContain("Selecting it does not publish evidence");
    expect(editor).toMatch(
      /links,\s+attribution,\s+permission notes,\s+and\s+publication state are not\s+copied here/
    );
  });

  it("uses fixed fair field design instead of demographic prompts or broad free-text keyword blocking", () => {
    expect(editor).toContain("This is the project-specific response");
    expect(editor).toMatch(/asks for no\s+demographic\s+data/);
    expect(editor).toMatch(/Do not submit a production\s+deliverable\s+here/);
    expect(hardeningMigration).not.toMatch(/male\|female\|men\|women/i);
    expect(hardeningMigration).toContain("'project_response'");
    expect(hardeningMigration).toContain("'evidence_ids'");
  });

  it("adds private routes and an eligible public Project entry without adding a company review queue or outcome promise", () => {
    expect(proxy).toContain('pathname.startsWith("/applications/")');
    expect(proxy).toContain('pathname.startsWith("/company/applications/")');
    expect(proxy).toContain('"/applications/:path*"');
    expect(proxy).toContain('"/company/applications/:path*"');
    expect(publicProject).toContain("Start private application");
    expect(publicProject).toContain(
      "submission never promises a response or outcome"
    );
    expect(editor).not.toMatch(/applicant queue/i);
    expect(editor).not.toMatch(/send_message/i);
    expect(editor).not.toMatch(/create_payment/i);
    expect(editor).not.toMatch(/match_talent/i);
  });
});
