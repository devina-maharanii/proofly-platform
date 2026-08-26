import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), `supabase/migrations/${name}`), "utf8");

const baseMigration = migration(
  "202608260023_phase26_tasks_files_submissions.sql"
);
const stateMigration = migration(
  "202608260025_phase26_task_transition_hardening.sql"
);
const readersMigration = migration("202608260026_phase26_private_readers.sql");
const capabilitiesMigration = migration(
  "202608260027_phase26_workspace_capabilities.sql"
);
const assignmentMigration = migration(
  "202608260028_phase26_task_assignment_hardening.sql"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/workspace/actions.ts"),
  "utf8"
);
const delivery = readFileSync(
  resolve(process.cwd(), "components/workspace/workspace-delivery.tsx"),
  "utf8"
);
const fileRoute = readFileSync(
  resolve(
    process.cwd(),
    "app/(auth)/workspaces/[workspaceId]/files/[fileVersionId]/route.ts"
  ),
  "utf8"
);
const taskRoute = readFileSync(
  resolve(
    process.cwd(),
    "app/(auth)/workspaces/[workspaceId]/tasks/[taskId]/page.tsx"
  ),
  "utf8"
);
const fileAccess = readFileSync(
  resolve(process.cwd(), "lib/security/file-access.ts"),
  "utf8"
);

describe("Phase 26 task, private-file, and versioned-submission contract", () => {
  it("keeps task state and assignment narrow, server-derived, and auditable", () => {
    for (const state of [
      "backlog",
      "ready",
      "in_progress",
      "blocked",
      "in_review",
      "done",
      "cancelled",
    ]) {
      expect(stateMigration).toContain(`'${state}'`);
    }
    expect(baseMigration).toContain("workspace_task_transition_allowed");
    expect(baseMigration).toContain("'workspace.task_changed'");
    expect(assignmentMigration).toContain(
      "assign_project_workspace_task_to_active_talent"
    );
    expect(assignmentMigration).toContain(
      "require_active_company_workspace_owner"
    );
    expect(assignmentMigration).toContain("role = 'talent_participant'");
    expect(assignmentMigration).not.toContain("requested_user_id");
    expect(actions).not.toMatch(/formData\.get\("userId"\)/);
    expect(actions).not.toMatch(/formData\.get\("organizationId"\)/);
  });

  it("uses a restricted private bucket, fixed metadata limits, participant RLS, and short-lived signed download targets", () => {
    expect(baseMigration).toContain("'proofly-private'");
    expect(baseMigration).toContain(
      "public, file_size_limit, allowed_mime_types"
    );
    expect(baseMigration).toContain("10485760");
    expect(baseMigration).toContain(
      "can_insert_project_workspace_storage_object"
    );
    expect(baseMigration).toContain(
      "can_read_project_workspace_storage_object"
    );
    expect(baseMigration).toContain(
      "storage.objects for insert to authenticated"
    );
    expect(baseMigration).toContain(
      "storage.objects for select to authenticated"
    );
    expect(readersMigration).toContain(
      "get_project_workspace_file_download_target"
    );
    expect(fileRoute).toContain("get_project_workspace_file_download_target");
    expect(fileRoute).toContain("createSignedUrl");
    expect(fileRoute).toContain("maxPrivateSignedUrlSeconds");
    expect(fileAccess).toContain("maxPrivateFileBytes");
    expect(actions).toContain("detectedContentType");
    expect(actions).toContain('createHash("sha256")');
    expect(actions).not.toMatch(/formData\.get\("objectKey"\)/);
  });

  it("preserves artifact versions and blocks silent replacement or direct table mutation", () => {
    expect(baseMigration).toContain("project_workspace_files");
    expect(baseMigration).toContain("project_workspace_file_versions");
    expect(baseMigration).toContain("unique (file_id, version_number)");
    expect(baseMigration).toContain(
      "lifecycle_state in ('active', 'archived')"
    );
    expect(baseMigration).toContain(
      "scan_state in ('pending', 'clean', 'rejected')"
    );
    expect(baseMigration).toContain("prepare_project_workspace_file_upload");
    expect(baseMigration).toContain("complete_project_workspace_file_upload");
    expect(baseMigration).toContain(
      "revoke all on table public.project_workspace_files"
    );
    expect(baseMigration).not.toMatch(
      /create policy[^;]+project_workspace_files[^;]+for\s+(insert|update|delete)/i
    );
  });

  it("requires an owned clean file set, explicit ownership/attribution confirmations, immutable submission versions, and idempotent submit", () => {
    for (const state of [
      "draft",
      "submitted",
      "under_review",
      "changes_requested",
      "resubmitted",
      "accepted",
      "rejected",
    ]) {
      expect(baseMigration).toContain(`'${state}'`);
    }
    expect(baseMigration).toContain("project_workspace_submission_versions");
    expect(baseMigration).toContain("unique (submission_id, version_number)");
    expect(baseMigration).toContain("ownership_confirmed boolean not null");
    expect(baseMigration).toContain("attribution_confirmed boolean not null");
    expect(baseMigration).toContain("file.owner_user_id = actor_id");
    expect(baseMigration).toContain("file_version.scan_state = 'clean'");
    expect(baseMigration).toContain("requested_idempotency_key");
    expect(baseMigration).toContain("'revision_created'");
    expect(baseMigration).toContain("'resubmitted'");
    expect(delivery).toContain("Pre-submit checklist");
    expect(delivery).toContain("ownershipConfirmed");
    expect(delivery).toContain("attributionConfirmed");
    expect(delivery).toContain("Private package preview");
  });

  it("derives capability flags and private readers from the database while keeping review decisions, payment, execution, messaging, and AI out of scope", () => {
    expect(capabilitiesMigration).toContain(
      "get_project_workspace_capabilities"
    );
    expect(capabilitiesMigration).toContain("can_manage_tasks");
    expect(capabilitiesMigration).toContain("can_upload_files");
    expect(capabilitiesMigration).toContain("can_create_submission");
    expect(readersMigration).toContain("get_project_workspace_task");
    expect(readersMigration).toContain("get_project_workspace_files");
    expect(readersMigration).toContain("get_project_workspace_submission");
    expect(taskRoute).toContain("robots: { index: false, follow: false }");
    for (const forbiddenSymbol of [
      "scoreSubmission",
      "createReviewDecision",
      "createPayment",
      "createContract",
      "sendMessageAction",
      "executeCode",
      "invokeLLM",
    ]) {
      expect(actions).not.toContain(forbiddenSymbol);
      expect(delivery).not.toContain(forbiddenSymbol);
    }
  });
});
