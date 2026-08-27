import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  canRecordVerificationDecision,
  canRequestVerificationAppeal,
  canRevokeVerification,
  type PermissionActor,
} from "@/lib/security/permissions";
import { evaluateVerificationEligibility } from "@/lib/verification/types";

const source = (file: string) =>
  readFileSync(resolve(process.cwd(), file), "utf8");
const verificationMigration = source(
  "supabase/migrations/202608270035_phase29_verification_workflow.sql"
);
const integrityMigration = source(
  "supabase/migrations/202608270036_phase29_verification_integrity_hardening.sql"
);
const hardeningMigration = source(
  "supabase/migrations/202608270037_phase29_workflow_privacy_hardening.sql"
);
const proofAuditMigration = source(
  "supabase/migrations/202608270038_phase29_proof_audit_bridge.sql"
);
const submissionMigration = source(
  "supabase/migrations/202608260023_phase26_tasks_files_submissions.sql"
);
const verificationActions = source("lib/verification/actions.ts");
const verificationReader = source("lib/verification/context.ts");
const verificationUi = source(
  "components/verification/verification-workflow.tsx"
);
const publicProofMigration = source(
  "supabase/migrations/202608250012_phase20_public_proof_profiles.sql"
);
const proxy = source("proxy.ts");
const reviewerRoute = source(
  "app/(auth)/reviewer/verifications/[workspaceId]/page.tsx"
);
const adminRoute = source("app/(auth)/admin/verifications/page.tsx");

const reviewer: PermissionActor = {
  userId: "reviewer-user",
  activeRole: "reviewer",
  activeOrganizationId: null,
  companyPermissions: [],
  capabilities: ["reviewer"],
};

const administrator: PermissionActor = {
  userId: "administrator-user",
  activeRole: "administrator",
  activeOrganizationId: null,
  companyPermissions: [],
  capabilities: ["administrator"],
};

describe("Phase 29 human-accountable verification workflow", () => {
  it("requires every eligibility fact before assignment and names each blocker without choosing an outcome", () => {
    const eligible = evaluateVerificationEligibility({
      submissionState: "submitted",
      hasCompleteSubmissionVersion: true,
      hasLockedRubricVersion: true,
      reviewerIsActive: true,
      reviewerHasActiveContext: true,
      reviewerMatchesSkills: true,
      reviewerHasCapacity: true,
      reviewerHasConflict: false,
      reviewerIsTalent: false,
      reviewerBlockedByOrganization: false,
    });
    const blocked = evaluateVerificationEligibility({
      submissionState: "draft",
      hasCompleteSubmissionVersion: false,
      hasLockedRubricVersion: false,
      reviewerIsActive: false,
      reviewerHasActiveContext: false,
      reviewerMatchesSkills: false,
      reviewerHasCapacity: false,
      reviewerHasConflict: true,
      reviewerIsTalent: true,
      reviewerBlockedByOrganization: true,
    });

    expect(eligible).toEqual({ eligible: true, blockers: [] });
    expect(blocked.eligible).toBe(false);
    expect(blocked.blockers).toEqual(
      expect.arrayContaining([
        "submission_not_ready_for_verification",
        "submission_version_is_incomplete",
        "locked_rubric_required",
        "reviewer_access_is_not_active",
        "reviewer_context_not_active",
        "matching_skill_expertise_missing",
        "reviewer_capacity_unavailable",
        "declared_conflict_blocks_review",
        "self_review_prohibited",
        "organization_relationship_blocks_review",
      ])
    );
  });

  it("binds every verification and reviewer observation to exact immutable submission and locked rubric versions without a universal score", () => {
    expect(verificationMigration).toContain(
      "current_submission_version_id uuid not null"
    );
    expect(verificationMigration).toContain("rubric_version_id uuid not null");
    expect(verificationMigration).toContain(
      "submission_version_id uuid not null"
    );
    expect(verificationMigration).toContain(
      "rubric_dimension_id uuid not null"
    );
    expect(hardeningMigration).toContain(
      "expected_dimensions <> jsonb_array_length(requested_observations)"
    );
    expect(hardeningMigration).toContain(
      "dimension.rubric_version_id = review_record.rubric_version_id"
    );
    expect(verificationUi).toContain("Observe every locked rubric dimension");
    expect(verificationMigration).not.toMatch(
      /universal_score|overall_score|automatic_score/i
    );
  });

  it("keeps decisions human-only, bound to the active assigned reviewer, and blocks self, conflict, inactive, wrong-assignment, and terminal-state bypasses", () => {
    expect(
      canRecordVerificationDecision(reviewer, {
        submissionOwnerUserId: "talent-user",
        assignedReviewerUserId: "reviewer-user",
        reviewerIsActiveAndQualified: true,
        hasDeclaredConflict: false,
        verificationState: "under_review",
      })
    ).toBe(true);
    for (const rejected of [
      {
        submissionOwnerUserId: "reviewer-user",
        assignedReviewerUserId: "reviewer-user",
        reviewerIsActiveAndQualified: true,
        hasDeclaredConflict: false,
        verificationState: "under_review" as const,
      },
      {
        submissionOwnerUserId: "talent-user",
        assignedReviewerUserId: "another-reviewer",
        reviewerIsActiveAndQualified: true,
        hasDeclaredConflict: false,
        verificationState: "under_review" as const,
      },
      {
        submissionOwnerUserId: "talent-user",
        assignedReviewerUserId: "reviewer-user",
        reviewerIsActiveAndQualified: false,
        hasDeclaredConflict: false,
        verificationState: "under_review" as const,
      },
      {
        submissionOwnerUserId: "talent-user",
        assignedReviewerUserId: "reviewer-user",
        reviewerIsActiveAndQualified: true,
        hasDeclaredConflict: true,
        verificationState: "under_review" as const,
      },
      {
        submissionOwnerUserId: "talent-user",
        assignedReviewerUserId: "reviewer-user",
        reviewerIsActiveAndQualified: true,
        hasDeclaredConflict: false,
        verificationState: "verified" as const,
      },
    ]) {
      expect(canRecordVerificationDecision(reviewer, rejected)).toBe(false);
    }
    expect(hardeningMigration).toContain(
      "review_record.reviewer_user_id <> actor_id"
    );
    expect(hardeningMigration).toContain(
      "private.reviewer_user_is_eligible_for_workspace(actor_id"
    );
    expect(hardeningMigration).toContain(
      "requested_decision not in ('changes_requested', 'verified', 'not_verified')"
    );
    expect(hardeningMigration).not.toContain(
      "requested_state public.verification_state"
    );
    expect(verificationActions).not.toMatch(
      /formData\.get\("(?:state|verified|isVerified)"\)/
    );
    expect(verificationActions).not.toContain("invokeLLM");
  });

  it("reuses active context, canonical skill, capacity, self-review, and organization-conflict eligibility checks before reviewer material access is granted", () => {
    for (const safeguard of [
      "context.active_role = 'reviewer'",
      "capability.reviewer_approved_at is not null",
      "jsonb_array_elements_text(project.required_skills)",
      "conflict.scope = 'general'",
      "submission.talent_user_id = application.user_id",
      "review_material_granted = true",
      "profile.max_concurrent_reviews",
    ]) {
      expect(integrityMigration + hardeningMigration).toContain(safeguard);
    }
    expect(hardeningMigration).toContain(
      "private.require_company_verification_owner"
    );
    expect(verificationUi).toContain(
      "The company cannot choose the review decision"
    );
  });

  it("keeps changes-requested feedback actionable and preserves the existing immutable revision then resubmission boundary", () => {
    expect(hardeningMigration).toContain(
      "requested_decision = 'changes_requested'"
    );
    expect(hardeningMigration).toContain("actionable_next_steps");
    expect(hardeningMigration).toContain("set state = 'changes_requested'");
    expect(hardeningMigration).toContain(
      "current_submission_version_id = version_record.id"
    );
    expect(verificationUi).toContain(
      "Save a new immutable submission version below, then resubmit it"
    );
    expect(submissionMigration).toContain(
      "unique (submission_id, version_number)"
    );
  });

  it("keeps not-verified private, makes appeal Talent-owned and separate, and requires a separately eligible appeal reviewer", () => {
    expect(
      canRequestVerificationAppeal(
        {
          ...reviewer,
          userId: "talent-user",
          activeRole: "talent",
          capabilities: ["talent"],
        },
        {
          talentUserId: "talent-user",
          verificationState: "not_verified",
          hasExistingAppeal: false,
        }
      )
    ).toBe(true);
    expect(
      canRequestVerificationAppeal(reviewer, {
        talentUserId: "talent-user",
        verificationState: "not_verified",
        hasExistingAppeal: false,
      })
    ).toBe(false);
    expect(
      canRequestVerificationAppeal(
        {
          ...reviewer,
          userId: "talent-user",
          activeRole: "talent",
          capabilities: ["talent"],
        },
        {
          talentUserId: "talent-user",
          verificationState: "appealed",
          hasExistingAppeal: true,
        }
      )
    ).toBe(false);
    expect(verificationMigration).toContain("project_verification_appeals");
    expect(verificationMigration).toContain(
      "requested_reviewer_user_id = original_reviewer"
    );
    expect(verificationMigration).toContain("state = 'appealed'");
    expect(verificationActions).toContain(
      "Only the Talent owner of a not-verified record may request one"
    );
  });

  it("creates a verified proof privately, allows public visibility only through a Talent-owned guarded action, and excludes not-verified or revoked records from the public reader", () => {
    expect(verificationMigration).toContain(
      "state public.verification_proof_state not null default 'private'"
    );
    expect(verificationMigration).toContain(
      "verification_record.talent_user_id <> actor_id"
    );
    expect(verificationMigration).toContain("proof_record.state <> 'private'");
    expect(verificationMigration).toContain("evidence.state = 'published'");
    expect(verificationUi).toContain(
      "This verified record is private by default."
    );
    expect(verificationUi).toContain("Choose public Proof visibility");
    expect(verificationActions).toContain("publish_verified_proof");
    expect(publicProofMigration).toContain("proof.status = 'verified'");
    expect(publicProofMigration).toContain("proof.revoked_at is null");
    expect(verificationReader).not.toContain("get_public_talent_proofs");
  });

  it("limits private notes to the assigned reviewer or administrator and protects all verification tables and internal helpers from direct authenticated access", () => {
    expect(hardeningMigration).toContain(
      "private_note', case when is_admin or (access_role = 'reviewer' and review.reviewer_user_id = actor_id) then observation.private_note else '' end"
    );
    for (const table of [
      "project_verifications",
      "project_verification_reviews",
      "project_verification_observations",
      "project_verification_appeals",
      "verification_proofs",
      "project_verification_events",
    ]) {
      expect(verificationMigration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(verificationMigration).toContain(
      "revoke all on table public.project_verifications"
    );
    expect(integrityMigration).toContain(
      "revoke all on function private.reviewer_user_is_eligible_for_workspace"
    );
    expect(verificationReader).toContain('import "server-only"');
  });

  it("makes revocation administrator-only, removes linked public Proof, and retains a restricted accountable audit event", () => {
    expect(canRevokeVerification(administrator, "verified")).toBe(true);
    expect(canRevokeVerification(reviewer, "verified")).toBe(false);
    expect(canRevokeVerification(administrator, "not_verified")).toBe(false);
    expect(hardeningMigration).toContain(
      "not private.verification_actor_is_admin()"
    );
    expect(hardeningMigration).toContain("set status = 'revoked'");
    expect(hardeningMigration).toContain(
      "jsonb_build_object('reason', requested_reason, 'note', trim(requested_note))"
    );
    expect(hardeningMigration).toContain("'verification.revoked'");
    expect(proofAuditMigration).toContain(
      "talent_public_proofs_verification_audit"
    );
    expect(proofAuditMigration).toContain("'proof.verified'");
    expect(proofAuditMigration).toContain("'proof.revoked'");
  });

  it("keeps reviewer and administrator verification routes private, noindex, and outside excluded AI, payout, reputation, hiring, or payment scope", () => {
    expect(proxy).toContain('pathname.startsWith("/reviewer/")');
    expect(proxy).toContain('pathname.startsWith("/admin/verifications")');
    expect(proxy).toContain('"/admin/verifications/:path*"');
    for (const route of [reviewerRoute, adminRoute]) {
      expect(route).toContain("robots: { index: false, follow: false }");
    }
    for (const forbidden of [
      "invokeLLM",
      "payout",
      "reputation",
      "ranking",
      "payment",
      "hiring analytics",
    ]) {
      expect(
        verificationActions + verificationReader + verificationUi
      ).not.toContain(forbidden);
    }
  });
});
