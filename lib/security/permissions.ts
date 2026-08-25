/** Proofly Phase 15: pure resource policies; callers supply verified server facts, never client-selected identity, organization, or privilege. */
import type {
  ActiveContextRole,
  CompanyPermission,
  PlatformRole,
} from "@/lib/roles/types";
import { canPerformCompanyAction } from "@/lib/roles/permissions";

export type ResourceVisibility =
  "private" | "participants" | "organization" | "restricted" | "public";

export type PermissionActor = Readonly<{
  userId: string | null;
  activeRole: ActiveContextRole | null;
  activeOrganizationId: string | null;
  companyPermissions: readonly CompanyPermission[];
  capabilities: readonly PlatformRole[];
}>;

export type ProtectedResource = Readonly<{
  ownerUserId: string | null;
  organizationId: string | null;
  visibility: ResourceVisibility;
  participantUserIds?: readonly string[];
  explicitlyAuthorizedUserIds?: readonly string[];
  workflowState?: string;
}>;

export type ReviewAuthorization = Readonly<{
  submissionOwnerUserId: string;
  assignedReviewerUserId: string | null;
  hasDeclaredConflict: boolean;
  workflowState: "assigned" | "in_progress" | "completed" | "withdrawn";
}>;

function isAuthenticated(
  actor: PermissionActor
): actor is PermissionActor & { userId: string } {
  return Boolean(actor.userId);
}

function ownsResource(actor: PermissionActor, resource: ProtectedResource) {
  return isAuthenticated(actor) && resource.ownerUserId === actor.userId;
}

function hasExplicitAccess(
  actor: PermissionActor,
  resource: ProtectedResource
) {
  return (
    isAuthenticated(actor) &&
    (resource.participantUserIds?.includes(actor.userId) ||
      resource.explicitlyAuthorizedUserIds?.includes(actor.userId))
  );
}

function hasMatchingOrganization(
  actor: PermissionActor,
  resource: ProtectedResource
) {
  return (
    actor.activeRole === "company_member" &&
    actor.activeOrganizationId !== null &&
    actor.activeOrganizationId === resource.organizationId
  );
}

function canManageProjectScope(actor: PermissionActor) {
  return (
    actor.activeRole === "company_member" &&
    canPerformCompanyAction(actor.companyPermissions, "project.manage")
  );
}

/** Allows only public, owner, participant, explicit-grant, or active matching organization access. */
export function canAccessResource(
  actor: PermissionActor,
  resource: ProtectedResource
) {
  if (resource.visibility === "public") return true;
  if (!isAuthenticated(actor)) return false;
  return (
    ownsResource(actor, resource) ||
    hasExplicitAccess(actor, resource) ||
    (resource.visibility === "organization" &&
      hasMatchingOrganization(actor, resource))
  );
}

/** Allows an owner or an exact matching company project-management context to edit a non-public resource. */
export function canEditResource(
  actor: PermissionActor,
  resource: ProtectedResource
) {
  if (!isAuthenticated(actor)) return false;
  return (
    ownsResource(actor, resource) ||
    (hasMatchingOrganization(actor, resource) && canManageProjectScope(actor))
  );
}

/** Allows publication only from the resource owner or authorized matching company project-management context. */
export function canPublishResource(
  actor: PermissionActor,
  resource: ProtectedResource
) {
  return (
    canEditResource(actor, resource) && resource.workflowState !== "revoked"
  );
}

/** Requires approved reviewer context, assignment, non-terminal state, and no self-review or declared conflict. */
export function canReviewSubmission(
  actor: PermissionActor,
  review: ReviewAuthorization
) {
  return (
    isAuthenticated(actor) &&
    actor.activeRole === "reviewer" &&
    actor.capabilities.includes("reviewer") &&
    review.assignedReviewerUserId === actor.userId &&
    review.submissionOwnerUserId !== actor.userId &&
    !review.hasDeclaredConflict &&
    (review.workflowState === "assigned" ||
      review.workflowState === "in_progress")
  );
}

/** Requires the active matching organization context with its explicit owner permission. */
export function canManageOrganization(
  actor: PermissionActor,
  organizationId: string
) {
  return (
    actor.activeRole === "company_member" &&
    actor.activeOrganizationId === organizationId &&
    actor.companyPermissions.includes("owner")
  );
}

/** Requires matching organization context and either owner or billing-member permission. */
export function canManageBilling(
  actor: PermissionActor,
  organizationId: string
) {
  return (
    actor.activeRole === "company_member" &&
    actor.activeOrganizationId === organizationId &&
    (actor.companyPermissions.includes("owner") ||
      actor.companyPermissions.includes("billing_member"))
  );
}

/** Moderation is restricted to an explicitly granted, actively selected administrator context. */
export function canModerateContent(actor: PermissionActor) {
  return (
    actor.activeRole === "administrator" &&
    actor.capabilities.includes("administrator")
  );
}

/** Administrative commands use the same explicit elevated context and must independently append an audit record. */
export function canPerformAdminAction(actor: PermissionActor) {
  return canModerateContent(actor);
}
