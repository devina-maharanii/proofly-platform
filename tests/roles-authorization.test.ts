/** Phase 12 authorization tests: the same person may have contexts, but server policy denies unapproved or cross-tenant actions. */
import { describe, expect, it } from "vitest";

import {
  canReviewerEvaluateSubmission,
  evaluateActiveContextAuthorization,
  isActiveContextValid,
} from "@/lib/roles/policy";
import {
  canPerformCompanyAction,
  canUseCompanyPermission,
} from "@/lib/roles/permissions";

import {
  administratorContext,
  multiOrganizationContext,
  reviewerContext,
  talentContext,
} from "./fixtures/roles";

describe("Phase 12 role and organization authorization", () => {
  it("keeps company permissions organization-scoped when switching between memberships", () => {
    const activeOrganization = multiOrganizationContext.active?.organizationId;
    const firstMembership = multiOrganizationContext.memberships.find(
      membership => membership.organizationId === activeOrganization
    );
    const secondMembership = multiOrganizationContext.memberships.find(
      membership => membership.organizationId !== activeOrganization
    );

    expect(firstMembership?.permissions).toEqual(["hiring_member"]);
    expect(
      canPerformCompanyAction(
        firstMembership?.permissions ?? [],
        "project.create"
      )
    ).toBe(true);
    expect(
      canPerformCompanyAction(
        secondMembership?.permissions ?? [],
        "project.create"
      )
    ).toBe(false);
    expect(
      evaluateActiveContextAuthorization(multiOrganizationContext, {
        role: "company_member",
        organizationId: "22222222-2222-4222-8222-222222222222",
      })
    ).toEqual({ ok: false, code: "NOT_FOUND_OR_PRIVATE" });
  });

  it("allows only organization owners to satisfy an owner-only permission requirement", () => {
    expect(canUseCompanyPermission(["viewer"], "billing_member")).toBe(false);
    expect(canUseCompanyPermission(["owner"], "billing_member")).toBe(true);
    expect(
      evaluateActiveContextAuthorization(multiOrganizationContext, {
        companyPermission: "billing_member",
      })
    ).toEqual({ ok: false, code: "NOT_FOUND_OR_PRIVATE" });
  });

  it("does not let a viewer edit a project or a billing member review a private talent submission", () => {
    expect(canPerformCompanyAction(["viewer"], "project.manage")).toBe(false);
    expect(canPerformCompanyAction(["billing_member"], "talent.review")).toBe(
      false
    );
  });

  it("denies a removed membership because it is absent from the server-derived active memberships", () => {
    const removedMembershipContext = {
      ...multiOrganizationContext,
      memberships: [],
    };

    expect(
      evaluateActiveContextAuthorization(removedMembershipContext, {
        role: "company_member",
        organizationId:
          multiOrganizationContext.active?.organizationId ?? undefined,
      })
    ).toEqual({ ok: false, code: "NOT_FOUND_OR_PRIVATE" });
  });

  it("requires an explicit server-derived active context", () => {
    expect(evaluateActiveContextAuthorization(null)).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(
      evaluateActiveContextAuthorization({ ...talentContext, active: null })
    ).toEqual({ ok: false, code: "NO_ACTIVE_CONTEXT" });
  });

  it("does not treat a client-created reviewer or administrator claim as an approved capability", () => {
    expect(isActiveContextValid("reviewer", null, ["talent"], [])).toBe(false);
    expect(isActiveContextValid("administrator", null, ["talent"], [])).toBe(
      false
    );
    expect(
      evaluateActiveContextAuthorization(reviewerContext, { role: "reviewer" })
    ).toEqual({ ok: true, context: reviewerContext });
    expect(
      evaluateActiveContextAuthorization(administratorContext, {
        role: "administrator",
      })
    ).toEqual({ ok: true, context: administratorContext });
  });

  it("blocks a reviewer from reviewing their own work or conflicted work", () => {
    expect(
      canReviewerEvaluateSubmission("reviewer-user", "reviewer-user", false)
    ).toBe(false);
    expect(
      canReviewerEvaluateSubmission("reviewer-user", "talent-user", true)
    ).toBe(false);
    expect(
      canReviewerEvaluateSubmission("reviewer-user", "talent-user", false)
    ).toBe(true);
  });
});
