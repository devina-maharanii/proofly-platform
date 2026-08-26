import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608260021_phase25_project_workspaces.sql"
  ),
  "utf8"
);
const hardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608260022_phase25_reviewer_material_hardening.sql"
  ),
  "utf8"
);
const context = readFileSync(
  resolve(process.cwd(), "lib/workspace/context.ts"),
  "utf8"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/workspace/actions.ts"),
  "utf8"
);
const surface = readFileSync(
  resolve(process.cwd(), "components/workspace/project-workspace.tsx"),
  "utf8"
);
const proxy = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
const projectEditor = readFileSync(
  resolve(process.cwd(), "components/project/company-project-editor.tsx"),
  "utf8"
);

describe("Phase 25 protected Project Workspace contract", () => {
  it("models a complete, auditable workspace-state vocabulary while restricting state changes to approved owner commands", () => {
    for (const state of [
      "preparing",
      "active",
      "paused",
      "awaiting_submission",
      "under_review",
      "completed",
      "closed",
    ]) {
      expect(migration).toContain(`'${state}'`);
    }
    expect(migration).toContain("transition_project_workspace(");
    expect(migration).toContain(
      "public.require_active_company_workspace_owner"
    );
    expect(migration).toContain("'workspace.state_changed'");
    expect(migration).toContain("previous = 'preparing'");
    expect(migration).toContain("previous = 'under_review'");
    expect(actions).toContain(
      'authorizeActiveContext({ role: "company_member" })'
    );
    expect(actions).not.toMatch(/formData\.get\("userId"\)/);
    expect(actions).not.toMatch(/formData\.get\("organizationId"\)/);
  });

  it("requires an accepted application and an in-progress project to bootstrap participants, with no direct applicant selection path", () => {
    expect(migration).toContain(
      "create_project_workspace_from_accepted_application("
    );
    expect(migration).toContain("application.state = 'accepted'");
    expect(migration).toContain("project.state = 'in_progress'");
    expect(migration).toContain("application_record.talent_user_id");
    expect(migration).toContain("'talent_participant'");
    expect(migration).toContain("'company_participant'");
    expect(migration).toContain("'workspace.member_granted'");
    expect(migration).not.toContain("select_talent_for_workspace");
  });

  it("enables RLS, revokes direct table access, derives access from active participant or organization context, and hardens reviewer material access", () => {
    for (const table of [
      "project_workspaces",
      "project_workspace_members",
      "project_workspace_tasks",
      "project_workspace_activity",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(migration).not.toMatch(
      /create policy[^;]+for\s+(insert|update|delete)/i
    );
    expect(migration).toContain(
      "revoke all on table public.project_workspaces, public.project_workspace_members, public.project_workspace_tasks, public.project_workspace_activity from anon, authenticated"
    );
    expect(migration).toContain("public.has_organization_permission");
    expect(migration).toContain("member.status = 'active'");
    expect(hardeningMigration).toContain("review_material_granted");
    expect(hardeningMigration).toContain(
      "member.review_material_granted = true"
    );
    expect(hardeningMigration).toContain(
      "role = 'reviewer' or review_material_granted = false"
    );
    expect(migration).toContain("from public, anon;");
    expect(migration).toContain("to authenticated;");
  });

  it("keeps project brief, task context, activity, and review context private and minimizes participant disclosure", () => {
    expect(migration).toContain(
      "visibility text not null default 'participants'"
    );
    expect(migration).toContain(
      "'is_current_actor', member.user_id = actor_id"
    );
    expect(migration).not.toContain("display_name");
    expect(migration).not.toContain("email");
    expect(migration).toContain("access_role = 'reviewer' then '[]'::jsonb");
    expect(migration).toContain("task.assigned_user_id = actor_id");
    expect(migration).toContain("order by occurred_at desc limit 50");
    expect(context).toContain('supabase.rpc("get_project_workspace"');
    expect(context).not.toContain('from("project_workspaces")');
  });

  it("keeps the original shell boundaries while delegating approved task, private-file, and submission controls to the dedicated Phase 26 delivery surface", () => {
    for (const requiredCopy of [
      "Evaluation remains contextual and human-led",
      "Private state and access record",
      "later-review-ready submission package",
    ]) {
      expect(surface).toContain(requiredCopy);
    }
    for (const forbiddenSymbol of [
      "sendMessageAction",
      "scoreSubmission",
      "createContract",
      "createPayment",
      "executeCode",
      "invokeLLM",
    ]) {
      expect(surface).not.toContain(forbiddenSymbol);
      expect(actions).not.toContain(forbiddenSymbol);
    }
  });

  it("adds a noindex fail-closed workspace route and reconciles only the relevant Project handoff copy", () => {
    expect(proxy).toContain('pathname.startsWith("/workspaces/")');
    expect(proxy).toContain('"/workspaces/:path*"');
    expect(surface).toContain("Participant context only");
    expect(projectEditor).toContain("focused application flow");
    expect(projectEditor).toContain("Application and workspace access require");
    expect(projectEditor).not.toMatch(/applicant queue/i);
    expect(projectEditor).not.toMatch(/review queue/i);
  });
});
