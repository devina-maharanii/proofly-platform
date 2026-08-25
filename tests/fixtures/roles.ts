/** Phase 12 deterministic fixtures: synthetic identifiers only; never application or production data. */
import type { RoleContext } from "@/lib/roles/types";

export const talentContext: RoleContext = {
  userId: "talent-user",
  email: "talent@example.test",
  capabilities: ["talent"],
  memberships: [],
  active: { role: "talent", organizationId: null },
  reviewerRequestStatus: null,
};

export const multiOrganizationContext: RoleContext = {
  userId: "member-user",
  email: "member@example.test",
  capabilities: ["talent"],
  memberships: [
    {
      organizationId: "11111111-1111-4111-8111-111111111111",
      organizationName: "Northline Studio",
      organizationSlug: "northline-studio",
      permissions: ["hiring_member"],
    },
    {
      organizationId: "22222222-2222-4222-8222-222222222222",
      organizationName: "Fieldwork Labs",
      organizationSlug: "fieldwork-labs",
      permissions: ["viewer"],
    },
  ],
  active: {
    role: "company_member",
    organizationId: "11111111-1111-4111-8111-111111111111",
  },
  reviewerRequestStatus: "pending",
};

export const reviewerContext: RoleContext = {
  ...talentContext,
  userId: "reviewer-user",
  capabilities: ["talent", "reviewer"],
  active: { role: "reviewer", organizationId: null },
};

export const administratorContext: RoleContext = {
  ...talentContext,
  userId: "administrator-user",
  capabilities: ["talent", "administrator"],
  active: { role: "administrator", organizationId: null },
};
