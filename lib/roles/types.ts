/** Proofly Phase 12 role model: a person may hold multiple capabilities, but each request has one explicit server-derived context. */
export const companyPermissions = [
  "owner",
  "hiring_member",
  "reviewer_member",
  "billing_member",
  "viewer",
] as const;

export const activeContextRoles = [
  "talent",
  "company_member",
  "reviewer",
  "administrator",
] as const;

export const platformRoles = ["talent", "reviewer", "administrator"] as const;

export type CompanyPermission = (typeof companyPermissions)[number];
export type ActiveContextRole = (typeof activeContextRoles)[number];
export type PlatformRole = (typeof platformRoles)[number];

export type OrganizationMembershipContext = Readonly<{
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  permissions: readonly CompanyPermission[];
}>;

export type ActiveRoleContext = Readonly<{
  role: ActiveContextRole;
  organizationId: string | null;
}>;

export type RoleContext = Readonly<{
  userId: string;
  email: string | null;
  capabilities: readonly PlatformRole[];
  memberships: readonly OrganizationMembershipContext[];
  active: ActiveRoleContext | null;
  reviewerApplicationState:
    | "requested"
    | "in_screening"
    | "needs_more_evidence"
    | "approved"
    | "active"
    | "paused"
    | "suspended"
    | "rejected"
    | null;
  reviewerRequestStatus:
    "pending" | "approved" | "declined" | "withdrawn" | null;
}>;

export type AuthorizationFailureCode =
  | "UNAUTHENTICATED"
  | "NO_ACTIVE_CONTEXT"
  | "NOT_FOUND_OR_PRIVATE"
  | "FORBIDDEN";

export type AuthorizationResult =
  | Readonly<{ ok: true; context: RoleContext }>
  | Readonly<{ ok: false; code: AuthorizationFailureCode }>;
