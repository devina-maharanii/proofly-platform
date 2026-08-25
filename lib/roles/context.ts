/** Proofly Phase 12 server authorization context: derives active role, memberships, and capabilities from authenticated Supabase data only. */
import "server-only";

import {
  getVerifiedAuthSession,
  createServerSupabaseClient,
} from "@/lib/supabase/server";

import {
  activeContextRoles,
  companyPermissions,
  platformRoles,
  type CompanyPermission,
  type PlatformRole,
  type RoleContext,
} from "./types";
import {
  evaluateActiveContextAuthorization,
  isActiveContextValid,
  type AuthorizationRequirement,
} from "./policy";

function includesValue<T extends readonly string[]>(
  values: T,
  value: unknown
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function toPermissions(value: unknown): CompanyPermission[] {
  return Array.isArray(value)
    ? value.filter(permission => includesValue(companyPermissions, permission))
    : [];
}

function toCapabilities(value: unknown): PlatformRole[] {
  return Array.isArray(value)
    ? value.filter(capability => includesValue(platformRoles, capability))
    : [];
}

export async function getRoleContext(): Promise<RoleContext | null> {
  const session = await getVerifiedAuthSession();
  const supabase = await createServerSupabaseClient();
  if (!session || !supabase) {
    return null;
  }

  const [
    capabilitiesResult,
    membershipsResult,
    activeResult,
    reviewerRequestResult,
  ] = await Promise.all([
    supabase
      .from("role_capabilities")
      .select("capabilities")
      .eq("user_id", session.userId)
      .maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("organization_id, permissions, organizations(id, name, slug)")
      .eq("user_id", session.userId)
      .eq("status", "active"),
    supabase
      .from("active_contexts")
      .select("active_role, active_organization_id")
      .eq("user_id", session.userId)
      .maybeSingle(),
    supabase
      .from("capability_requests")
      .select("status")
      .eq("user_id", session.userId)
      .eq("requested_role", "reviewer")
      .maybeSingle(),
  ]);

  const capabilities = toCapabilities(capabilitiesResult.data?.capabilities);
  const memberships = (membershipsResult.data ?? []).flatMap(row => {
    const organization = Array.isArray(row.organizations)
      ? row.organizations[0]
      : row.organizations;
    if (
      !organization ||
      typeof organization.id !== "string" ||
      typeof organization.name !== "string" ||
      typeof organization.slug !== "string"
    ) {
      return [];
    }
    return [
      {
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        permissions: toPermissions(row.permissions),
      },
    ];
  });

  const requestedRole = activeResult.data?.active_role;
  const requestedOrganizationId =
    activeResult.data?.active_organization_id ?? null;
  const active =
    includesValue(activeContextRoles, requestedRole) &&
    isActiveContextValid(
      requestedRole,
      requestedOrganizationId,
      capabilities,
      memberships
    )
      ? { role: requestedRole, organizationId: requestedOrganizationId }
      : null;

  const reviewerRequestStatus = reviewerRequestResult.data?.status;
  return {
    userId: session.userId,
    email: session.email,
    capabilities,
    memberships,
    active,
    reviewerRequestStatus:
      reviewerRequestStatus === "pending" ||
      reviewerRequestStatus === "approved" ||
      reviewerRequestStatus === "declined" ||
      reviewerRequestStatus === "withdrawn"
        ? reviewerRequestStatus
        : null,
  };
}

export async function authorizeActiveContext(
  requirement: AuthorizationRequirement = {}
) {
  return evaluateActiveContextAuthorization(
    await getRoleContext(),
    requirement
  );
}
