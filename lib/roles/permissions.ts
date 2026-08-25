/** Proofly Phase 12 permission matrix: capability and membership scope are checked server-side; browser claims are never authority. */
import type { CompanyPermission, ActiveContextRole } from "./types";

export const companyPermissionMatrix = {
  owner: [
    "organization.manage",
    "member.manage",
    "project.manage",
    "billing.manage",
    "organization.deletion.request",
  ],
  hiring_member: [
    "project.create",
    "talent.review",
    "shortlist.manage",
    "hiring.manage",
  ],
  reviewer_member: ["company.review.participate"],
  billing_member: ["billing.manage"],
  viewer: ["organization.read"],
} as const;

export type CompanyAction =
  (typeof companyPermissionMatrix)[CompanyPermission][number];

export const contextActions = {
  talent: ["talent.onboarding.handoff"],
  company_member: ["organization.context.select"],
  reviewer: ["reviewer.context.select"],
  administrator: ["administrator.context.select"],
} as const satisfies Record<ActiveContextRole, readonly string[]>;

export function canPerformCompanyAction(
  permissions: readonly CompanyPermission[],
  action: CompanyAction
) {
  return permissions.some(permission =>
    (companyPermissionMatrix[permission] as readonly string[]).includes(action)
  );
}

export function canUseCompanyPermission(
  permissions: readonly CompanyPermission[],
  requiredPermission: CompanyPermission
) {
  return (
    permissions.includes("owner") || permissions.includes(requiredPermission)
  );
}
