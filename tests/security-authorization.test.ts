import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  canAccessResource,
  canEditResource,
  canManageBilling,
  canManageOrganization,
  canPerformAdminAction,
  canPublishResource,
  canReviewSubmission,
  type PermissionActor,
  type ProtectedResource,
} from "@/lib/security/permissions";

const owner: PermissionActor = {
  userId: "owner-user",
  activeRole: "talent",
  activeOrganizationId: null,
  companyPermissions: [],
  capabilities: ["talent"],
};

const companyOwner: PermissionActor = {
  userId: "company-owner",
  activeRole: "company_member",
  activeOrganizationId: "organization-a",
  companyPermissions: ["owner"],
  capabilities: ["talent"],
};

const privateResource: ProtectedResource = {
  ownerUserId: "owner-user",
  organizationId: null,
  visibility: "private",
  workflowState: "draft",
};

describe("Phase 15 defense-in-depth authorization", () => {
  it("denies a changed client user or organization identifier instead of trusting the request claim", () => {
    const changedUser: PermissionActor = { ...owner, userId: "attacker-user" };
    const changedOrganization: PermissionActor = {
      ...companyOwner,
      activeOrganizationId: "organization-b",
    };
    const organizationResource: ProtectedResource = {
      ownerUserId: "another-user",
      organizationId: "organization-a",
      visibility: "organization",
    };

    expect(canAccessResource(changedUser, privateResource)).toBe(false);
    expect(canEditResource(changedUser, privateResource)).toBe(false);
    expect(canAccessResource(changedOrganization, organizationResource)).toBe(
      false
    );
  });

  it("requires the active matching organization membership for edit, organization, and billing commands", () => {
    const removedMember: PermissionActor = {
      ...companyOwner,
      activeOrganizationId: null,
      companyPermissions: [],
    };
    const billingMember: PermissionActor = {
      ...companyOwner,
      companyPermissions: ["billing_member"],
    };
    const organizationResource: ProtectedResource = {
      ownerUserId: "another-user",
      organizationId: "organization-a",
      visibility: "organization",
      workflowState: "ready",
    };

    expect(canEditResource(companyOwner, organizationResource)).toBe(true);
    expect(canPublishResource(companyOwner, organizationResource)).toBe(true);
    expect(canManageOrganization(companyOwner, "organization-a")).toBe(true);
    expect(canManageBilling(billingMember, "organization-a")).toBe(true);
    expect(canManageOrganization(billingMember, "organization-a")).toBe(false);
    expect(canEditResource(removedMember, organizationResource)).toBe(false);
    expect(canManageBilling(removedMember, "organization-a")).toBe(false);
  });

  it("rejects client-created administrator claims and reviewer self, conflict, assignment, and terminal-state bypasses", () => {
    const unverifiedAdmin: PermissionActor = {
      ...owner,
      activeRole: "administrator",
      capabilities: ["talent"],
    };
    const reviewer: PermissionActor = {
      userId: "reviewer-user",
      activeRole: "reviewer",
      activeOrganizationId: null,
      companyPermissions: [],
      capabilities: ["reviewer"],
    };

    expect(canPerformAdminAction(unverifiedAdmin)).toBe(false);
    expect(
      canReviewSubmission(reviewer, {
        submissionOwnerUserId: "reviewer-user",
        assignedReviewerUserId: "reviewer-user",
        hasDeclaredConflict: false,
        workflowState: "assigned",
      })
    ).toBe(false);
    expect(
      canReviewSubmission(reviewer, {
        submissionOwnerUserId: "talent-user",
        assignedReviewerUserId: "reviewer-user",
        hasDeclaredConflict: true,
        workflowState: "assigned",
      })
    ).toBe(false);
    expect(
      canReviewSubmission(reviewer, {
        submissionOwnerUserId: "talent-user",
        assignedReviewerUserId: "reviewer-user",
        hasDeclaredConflict: false,
        workflowState: "completed",
      })
    ).toBe(false);
  });

  it("keeps the authorization adapter server-only and returns stable private-denial vocabulary", () => {
    const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
    const source = readFileSync(
      join(repositoryRoot, "lib/security/authorize.ts"),
      "utf8"
    );
    expect(source).toContain('import "server-only"');
    expect(source).toContain("getRoleContext");
    expect(source).toContain('"NOT_FOUND_OR_PRIVATE"');
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
