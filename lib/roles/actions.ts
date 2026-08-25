"use server";

/** Proofly Phase 12 role actions: validate a requested context, then delegate authority to RLS-aware server RPC functions. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import { activeContextRoles, type ActiveContextRole } from "./types";

export type RoleActionState = Readonly<{
  status: "idle" | "success" | "error";
  message?: string;
}>;

export const initialRoleActionState: RoleActionState = { status: "idle" };

const contextSchema = z
  .object({
    role: z.enum(activeContextRoles),
    organizationId: z.string().uuid().optional(),
  })
  .superRefine((value, context) => {
    if (value.role === "company_member" && !value.organizationId) {
      context.addIssue({
        code: "custom",
        path: ["organizationId"],
        message: "Choose one of your approved organizations to continue.",
      });
    }
    if (value.role !== "company_member" && value.organizationId) {
      context.addIssue({
        code: "custom",
        path: ["organizationId"],
        message: "This role cannot use an organization context.",
      });
    }
  });

function safeActionMessage() {
  return "That context is not available to this account. Choose another available context or request the needed access.";
}

function redirectTo(url: string): never {
  return redirect(url as never);
}

export async function setActiveContextAction(
  _previousState: RoleActionState = initialRoleActionState,
  formData: FormData
): Promise<RoleActionState> {
  void _previousState;
  const parsed = contextSchema.safeParse({
    role: formData.get("role"),
    organizationId:
      typeof formData.get("organizationId") === "string"
        ? formData.get("organizationId")
        : undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const session = await getVerifiedAuthSession();
  const supabase = await createServerSupabaseClient();
  if (!session || !supabase) {
    return {
      status: "error",
      message:
        "Your session is no longer available. Sign in again to continue.",
    };
  }

  const { error } = await supabase.rpc("set_active_context", {
    requested_role: parsed.data.role as ActiveContextRole,
    requested_organization_id: parsed.data.organizationId ?? null,
  });
  if (error) {
    return { status: "error", message: safeActionMessage() };
  }
  revalidatePath("/auth/continue");
  redirectTo("/auth/continue?status=context-updated");
}

export async function requestReviewerCapabilityAction(
  _previousState: RoleActionState = initialRoleActionState
): Promise<RoleActionState> {
  void _previousState;
  const session = await getVerifiedAuthSession();
  const supabase = await createServerSupabaseClient();
  if (!session || !supabase) {
    return {
      status: "error",
      message:
        "Your session is no longer available. Sign in again to continue.",
    };
  }

  const { error } = await supabase.rpc("request_reviewer_capability");
  if (error) {
    return {
      status: "error",
      message: "We could not record that request safely. Try again later.",
    };
  }
  revalidatePath("/auth/continue");
  redirectTo("/auth/continue?status=reviewer-requested");
}
