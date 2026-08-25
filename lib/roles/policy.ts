/** Proofly Phase 12 pure policy: evaluates already server-derived contexts without performing browser, database, or session work. */
import type {
  ActiveContextRole,
  AuthorizationResult,
  CompanyPermission,
  OrganizationMembershipContext,
  PlatformRole,
  RoleContext,
} from "./types";

export function isActiveContextValid(
  role: ActiveContextRole,
  organizationId: string | null,
  capabilities: readonly PlatformRole[],
  memberships: readonly OrganizationMembershipContext[]
) {
  if (role === "talent") {
    return organizationId === null;
  }
  if (role === "company_member") {
    return (
      organizationId !== null &&
      memberships.some(
        membership => membership.organizationId === organizationId
      )
    );
  }
  if (role === "reviewer") {
    return organizationId === null && capabilities.includes("reviewer");
  }
  return organizationId === null && capabilities.includes("administrator");
}

export type AuthorizationRequirement = Readonly<{
  role?: ActiveContextRole;
  organizationId?: string;
  companyPermission?: CompanyPermission;
}>;

export function evaluateActiveContextAuthorization(
  context: RoleContext | null,
  requirement: AuthorizationRequirement = {}
): AuthorizationResult {
  if (!context) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }
  if (!context.active) {
    return { ok: false, code: "NO_ACTIVE_CONTEXT" };
  }
  if (
    !isActiveContextValid(
      context.active.role,
      context.active.organizationId,
      context.capabilities,
      context.memberships
    )
  ) {
    return { ok: false, code: "NOT_FOUND_OR_PRIVATE" };
  }
  if (requirement.role && context.active.role !== requirement.role) {
    return { ok: false, code: "NOT_FOUND_OR_PRIVATE" };
  }
  if (
    requirement.organizationId &&
    context.active.organizationId !== requirement.organizationId
  ) {
    return { ok: false, code: "NOT_FOUND_OR_PRIVATE" };
  }
  if (requirement.companyPermission) {
    const membership = context.memberships.find(
      candidate => candidate.organizationId === context.active?.organizationId
    );
    if (
      context.active.role !== "company_member" ||
      !membership ||
      !(
        membership.permissions.includes("owner") ||
        membership.permissions.includes(requirement.companyPermission)
      )
    ) {
      return { ok: false, code: "NOT_FOUND_OR_PRIVATE" };
    }
  }
  return { ok: true, context };
}

export function canReviewerEvaluateSubmission(
  reviewerUserId: string,
  submissionOwnerUserId: string,
  hasDeclaredConflict: boolean
) {
  return reviewerUserId !== submissionOwnerUserId && !hasDeclaredConflict;
}
