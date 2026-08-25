/** Proofly Phase 15: server-only authorization adapter that transforms verified role context into pure resource-policy inputs and stable private denials. */
import "server-only";

import { getRoleContext } from "@/lib/roles/context";

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
  type ReviewAuthorization,
} from "./permissions";

export type ServerAuthorizationResult =
  | Readonly<{ ok: true; actor: PermissionActor }>
  | Readonly<{ ok: false; code: "UNAUTHENTICATED" | "NOT_FOUND_OR_PRIVATE" }>;

/** Converts only server-derived active context and membership facts into the pure policy actor. */
export async function getVerifiedPermissionActor(): Promise<PermissionActor | null> {
  const context = await getRoleContext();
  if (!context) return null;
  const activeMembership = context.memberships.find(
    membership => membership.organizationId === context.active?.organizationId
  );
  return {
    userId: context.userId,
    activeRole: context.active?.role ?? null,
    activeOrganizationId: context.active?.organizationId ?? null,
    companyPermissions: activeMembership?.permissions ?? [],
    capabilities: context.capabilities,
  };
}

async function decide(
  predicate: (actor: PermissionActor) => boolean
): Promise<ServerAuthorizationResult> {
  const actor = await getVerifiedPermissionActor();
  if (!actor) return { ok: false, code: "UNAUTHENTICATED" };
  return predicate(actor)
    ? { ok: true, actor }
    : { ok: false, code: "NOT_FOUND_OR_PRIVATE" };
}

export async function authorizeResourceAccess(resource: ProtectedResource) {
  return decide(actor => canAccessResource(actor, resource));
}

export async function authorizeResourceEdit(resource: ProtectedResource) {
  return decide(actor => canEditResource(actor, resource));
}

export async function authorizeResourcePublish(resource: ProtectedResource) {
  return decide(actor => canPublishResource(actor, resource));
}

export async function authorizeSubmissionReview(review: ReviewAuthorization) {
  return decide(actor => canReviewSubmission(actor, review));
}

export async function authorizeOrganizationManagement(organizationId: string) {
  return decide(actor => canManageOrganization(actor, organizationId));
}

export async function authorizeBillingManagement(organizationId: string) {
  return decide(actor => canManageBilling(actor, organizationId));
}

export async function authorizeAdminAction() {
  return decide(actor => canPerformAdminAction(actor));
}
