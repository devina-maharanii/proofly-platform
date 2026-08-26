"use server";

/** Phase 25 command boundary: workspace state can change only through an owner-authorized database command; task, file, submission, review, contract, payment, messaging, and AI commands remain absent. */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  initialWorkspaceActionState,
  workspacePath,
  workspaceStateLabel,
  workspaceStates,
  type WorkspaceActionState,
  type WorkspaceState,
} from "./types";

const failure = (message: string): WorkspaceActionState => ({
  status: "error",
  message,
});

async function requestAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

export async function transitionProjectWorkspaceAction(
  _previousState: WorkspaceActionState = initialWorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  void _previousState;
  const workspaceId = formData.get("workspaceId");
  const requestedState = formData.get("requestedState");
  if (
    typeof workspaceId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(workspaceId) ||
    typeof requestedState !== "string" ||
    !workspaceStates.includes(requestedState as WorkspaceState)
  ) {
    return failure("Choose a valid workspace state.");
  }

  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "company_member" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) {
    return failure("Your session has expired. Sign in again to continue.");
  }
  if (!authorization.ok) {
    return failure(
      "Switch to the authorized company context before changing this private workspace state."
    );
  }
  const limit = securityRateLimiter.check(
    "mutation",
    session.userId,
    await requestAddress()
  );
  if (!limit.ok) {
    return failure(
      `Too many workspace changes. Try again in about ${limit.retryAfterSeconds} seconds.`
    );
  }

  const { data, error } = await supabase.rpc("transition_project_workspace", {
    requested_workspace_id: workspaceId,
    requested_state: requestedState as WorkspaceState,
  });
  if (error || !data || typeof data !== "object") {
    return failure(
      "This workspace state could not be changed safely. Check the active company context and the allowed next state."
    );
  }
  revalidatePath(workspacePath(workspaceId));
  return {
    status: "success",
    message: `Workspace state recorded as ${workspaceStateLabel(requestedState as WorkspaceState)}.`,
  };
}
