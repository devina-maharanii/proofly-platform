import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608250010_phase18_work_evidence.sql"
  ),
  "utf8"
);
const actions = readFileSync(
  resolve(process.cwd(), "lib/evidence/actions.ts"),
  "utf8"
);
const context = readFileSync(
  resolve(process.cwd(), "lib/evidence/context.ts"),
  "utf8"
);
const publicView = readFileSync(
  resolve(process.cwd(), "components/evidence/public-work-evidence.tsx"),
  "utf8"
);
const publicNotFound = readFileSync(
  resolve(process.cwd(), "app/evidence/[publicId]/not-found.tsx"),
  "utf8"
);
const editor = readFileSync(
  resolve(process.cwd(), "components/evidence/talent-evidence-editor.tsx"),
  "utf8"
);
const proxy = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");

describe("Phase 18 work-evidence privacy and lifecycle contract", () => {
  it("enables RLS with owner-only direct reads and no direct client write policy", () => {
    for (const table of [
      "work_evidence_items",
      "work_evidence_skills",
      "work_evidence_links",
      "work_evidence_attributions",
      "work_evidence_versions",
      "work_evidence_publications",
      "work_evidence_events",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(migration).toContain("using ((select auth.uid()) = user_id)");
    expect(migration).toContain("using ((select auth.uid()) = actor_user_id)");
    expect(migration).not.toMatch(
      /create policy[^;]+for\s+(insert|update|delete)/i
    );
    expect(migration).toContain(
      "revoke all on table public.work_evidence_items, public.work_evidence_skills, public.work_evidence_links, public.work_evidence_attributions, public.work_evidence_versions, public.work_evidence_publications, public.work_evidence_events from anon, authenticated"
    );
  });

  it("derives the acting owner and Talent capability on the server and in the database", () => {
    expect(migration).toContain(
      "public.require_active_talent_evidence_actor()"
    );
    expect(migration).toContain("active_role = 'talent'");
    expect(actions).toContain('authorizeActiveContext({ role: "talent" })');
    expect(actions).not.toMatch(/formData\.get\("userId"\)/);
    expect(actions).not.toMatch(/formData\.get\("role"\)/);
    expect(actions).not.toMatch(/formData\.get\("organizationId"\)/);
  });

  it("keeps lifecycle mutations authenticated-only and reserves verification states without a verification workflow", () => {
    for (const signature of [
      "save_work_evidence(uuid, jsonb, jsonb, jsonb, jsonb)",
      "mark_work_evidence_ready(uuid)",
      "publish_work_evidence(uuid, public.work_evidence_state, boolean)",
      "hide_work_evidence(uuid)",
      "archive_work_evidence(uuid)",
    ]) {
      expect(migration).toContain(
        `revoke all on function public.${signature} from public, anon`
      );
      expect(migration).toContain(
        `grant execute on function public.${signature} to authenticated`
      );
    }
    expect(migration).toContain("'under_review'");
    expect(migration).toContain("'verified'");
    expect(migration).not.toContain("verify_work_evidence");
    expect(actions).toContain('formData.get("confirmPublicEvidence")');
    expect(actions).toContain("acknowledged_public_fields: true");
  });

  it("preserves ownership, attribution, snapshot privacy, and public visibility boundaries", () => {
    const publishFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.publish_work_evidence("
      ),
      migration.indexOf("create or replace function public.hide_work_evidence(")
    );
    const publicSnapshotBuilder = publishFunction.slice(
      publishFunction.indexOf("public_snapshot := jsonb_build_object("),
      publishFunction.indexOf("insert into public.work_evidence_publications")
    );
    expect(publishFunction).toContain("item.ownership_status = 'restricted'");
    expect(publishFunction).toContain(
      "char_length(trim(item.permission_note)) < 10"
    );
    expect(publishFunction).toContain("and attribution.is_public");
    expect(publishFunction).toContain("and is_public");
    expect(publishFunction).toContain("verification_status', 'not_verified'");
    expect(publicSnapshotBuilder).not.toContain("permission_note");
    expect(migration).toContain(
      "where public_id = requested_public_id and state in ('published', 'unlisted')"
    );
    expect(migration).toContain("and evidence.state = 'published'");
    expect(context).toContain("get_public_work_evidence");
    expect(context).toContain('verificationStatus: "not_verified"');
    expect(publicView).toMatch(/not verified/i);
    expect(publicNotFound).toContain("This work record is unavailable");
    expect(publicNotFound).toContain("does not reveal private work records");
  });

  it("models version-aware drafts while public snapshots remain stable until the next publication", () => {
    expect(migration).toContain("version = excluded.version");
    expect(migration).toContain("source_version = excluded.source_version");
    expect(migration).toContain("state = 'draft'");
    expect(migration).toContain("state = requested_visibility");
    expect(editor).toContain("Public snapshot uses v");
    expect(editor).toMatch(/Current\s+draft is v/);
  });

  it("keeps private evidence routes protected while public detail stays outside the protected matcher", () => {
    expect(proxy).toContain(
      'protectedPaths.has(pathname) ||\n  pathname.startsWith("/profile/")'
    );
    expect(proxy).toContain('"/profile/:path*"');
    expect(proxy).toContain('"/applications/:path*"');
    expect(proxy).not.toContain('"/evidence/:path*"');
  });

  it("contains none of the excluded Phase 18 automation or reputation features", () => {
    const implementationSurface = [migration, actions, context].join("\n");
    expect(implementationSurface).not.toMatch(/github\s+sync/i);
    expect(implementationSurface).not.toMatch(/plagiarism/i);
    expect(implementationSurface).not.toMatch(/reviewer\s+rubric/i);
    expect(implementationSurface).not.toMatch(/AI extraction/i);
  });
});
