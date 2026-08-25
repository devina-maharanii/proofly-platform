/** Proofly Phase 13: server-only onboarding lookup using the verified session and active role context. */
import "server-only";

import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";
import { getRoleContext } from "@/lib/roles/context";

import { normalizeStoredDraft } from "./validation";
import type { OnboardingProgress, OnboardingTarget } from "./types";

type ProgressRow = Readonly<{
  id: string;
  role: string;
  organization_id: string | null;
  state: string;
  draft: unknown;
  skipped_fields: string[];
  completed_at: string | null;
  updated_at: string;
}>;

export type OnboardingContext = Readonly<{
  target: OnboardingTarget;
  progress: OnboardingProgress | null;
  reviewerRequestStatus:
    "pending" | "approved" | "declined" | "withdrawn" | null;
}>;

function toProgress(row: ProgressRow): OnboardingProgress | null {
  if (
    (row.role !== "talent" &&
      row.role !== "company_member" &&
      row.role !== "reviewer") ||
    ![
      "not_started",
      "in_progress",
      "ready_for_workspace",
      "needs_review",
      "completed",
    ].includes(row.state)
  ) {
    return null;
  }

  return {
    id: row.id,
    role: row.role,
    organizationId: row.organization_id,
    state: row.state as OnboardingProgress["state"],
    draft: normalizeStoredDraft(row.draft),
    skippedFields: row.skipped_fields,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

export async function getOnboardingContext(
  requestedRole?: string
): Promise<OnboardingContext | null> {
  const [session, roleContext, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    getRoleContext(),
    createServerSupabaseClient(),
  ]);
  if (!session || !roleContext || !supabase) {
    return null;
  }

  const target: OnboardingTarget | null =
    requestedRole === "reviewer"
      ? {
          role: "reviewer",
          organizationId: null,
          activeRole: roleContext.active?.role ?? null,
        }
      : requestedRole === "company_member"
        ? {
            role: "company_member",
            organizationId:
              roleContext.active?.role === "company_member"
                ? roleContext.active.organizationId
                : null,
            activeRole: roleContext.active?.role ?? null,
          }
        : roleContext.active?.role === "talent"
          ? { role: "talent", organizationId: null, activeRole: "talent" }
          : roleContext.active?.role === "company_member"
            ? {
                role: "company_member",
                organizationId: roleContext.active.organizationId,
                activeRole: "company_member",
              }
            : roleContext.active?.role === "reviewer"
              ? {
                  role: "reviewer",
                  organizationId: null,
                  activeRole: "reviewer",
                }
              : null;

  if (!target) {
    return null;
  }

  if (target.role === "company_member" && !target.organizationId) {
    return {
      target,
      progress: null,
      reviewerRequestStatus: roleContext.reviewerRequestStatus,
    };
  }

  let query = supabase
    .from("onboarding_progress")
    .select(
      "id, role, organization_id, state, draft, skipped_fields, completed_at, updated_at"
    )
    .eq("user_id", session.userId)
    .eq("role", target.role);
  query = target.organizationId
    ? query.eq("organization_id", target.organizationId)
    : query.is("organization_id", null);

  const { data } = await query.maybeSingle();
  const progress = data ? toProgress(data as ProgressRow) : null;

  return {
    target,
    progress,
    reviewerRequestStatus: roleContext.reviewerRequestStatus,
  };
}
