/**
 * Phase 19 — all GitHub mutations are authenticated server actions. Browser
 * forms never receive provider tokens, OAuth credentials, or raw API errors.
 */
"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  getGithubIntegrationFunctionUrl,
  getGithubIntegrationPublishableKey,
} from "@/lib/github/config";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import { getVerifiedAuthAccess } from "@/lib/supabase/server";
import type { SettingsFormState } from "@/lib/settings/types";

const initialError = "GitHub context is unavailable. Try again later.";

function value(formData: FormData, key: string): string {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

async function requestAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

function errorState(message: string): SettingsFormState {
  return { status: "error", message };
}

async function githubRequest(
  endpoint: string,
  init: RequestInit
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; state: SettingsFormState }
> {
  const access = await getVerifiedAuthAccess();
  const functionUrl = getGithubIntegrationFunctionUrl();
  const publishableKey = getGithubIntegrationPublishableKey();
  if (!access || !functionUrl || !publishableKey) {
    return { ok: false, state: errorState(initialError) };
  }
  const limit = securityRateLimiter.check(
    endpoint === "/disconnect" ? "sensitive-account" : "mutation",
    access.userId,
    await requestAddress()
  );
  if (!limit.ok) {
    return {
      ok: false,
      state: errorState(
        `Too many GitHub requests. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  }
  try {
    const response = await fetch(`${functionUrl}${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${access.accessToken}`,
        apikey: publishableKey,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (response.ok) return { ok: true, data };
    const code = typeof data.error === "string" ? data.error : "";
    if (code === "RATE_LIMITED" || code === "rate_limited") {
      return {
        ok: false,
        state: errorState(
          "GitHub is rate limiting this connection. Wait until the time shown, then refresh manually."
        ),
      };
    }
    if (code === "CONFLICT") {
      return {
        ok: false,
        state: errorState("A GitHub import is already in progress."),
      };
    }
    if (code === "NOT_FOUND_OR_PRIVATE") {
      return {
        ok: false,
        state: errorState("This GitHub context is unavailable."),
      };
    }
    return { ok: false, state: errorState(initialError) };
  } catch {
    return { ok: false, state: errorState(initialError) };
  }
}

function refreshPaths() {
  revalidatePath("/settings");
  revalidatePath("/p/[handle]", "page");
}

export async function refreshGithubAction(
  _previousState: SettingsFormState,
  _formData: FormData
): Promise<SettingsFormState> {
  void _previousState;
  void _formData;
  const result = await githubRequest("/manual-sync", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  if (!result.ok) return result.state;
  refreshPaths();
  return {
    status: "success",
    message:
      "GitHub refresh queued. Existing selected public context remains unchanged until this import finishes.",
  };
}

async function repositoryAction(
  endpoint:
    "/repositories/select" | "/repositories/hide" | "/repositories/remove",
  successMessage: string,
  _previousState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  void _previousState;
  const repositoryId = value(formData, "repositoryId");
  if (!/^[0-9a-f-]{36}$/i.test(repositoryId)) {
    return errorState("That imported repository is unavailable.");
  }
  const result = await githubRequest(endpoint, {
    method: "POST",
    body: JSON.stringify({ repositoryId }),
  });
  if (!result.ok) return result.state;
  refreshPaths();
  return { status: "success", message: successMessage };
}

export async function selectGithubRepositoryAction(
  previousState: SettingsFormState,
  formData: FormData
) {
  return repositoryAction(
    "/repositories/select",
    "Repository selected as public GitHub context. It remains unverified.",
    previousState,
    formData
  );
}

export async function hideGithubRepositoryAction(
  previousState: SettingsFormState,
  formData: FormData
) {
  return repositoryAction(
    "/repositories/hide",
    "Repository hidden from the public profile.",
    previousState,
    formData
  );
}

export async function removeGithubRepositoryAction(
  previousState: SettingsFormState,
  formData: FormData
) {
  return repositoryAction(
    "/repositories/remove",
    "Imported repository data removed. A later sync will not restore it automatically.",
    previousState,
    formData
  );
}

export async function disconnectGithubContextAction(
  _previousState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  void _previousState;
  if (value(formData, "confirmation") !== "DISCONNECT") {
    return errorState(
      "Type DISCONNECT to remove GitHub context and revoke future access."
    );
  }
  const result = await githubRequest("/disconnect", {
    method: "POST",
    body: JSON.stringify({ confirmation: "DISCONNECT" }),
  });
  if (!result.ok) return result.state;
  refreshPaths();
  return {
    status: "success",
    message:
      "GitHub context was disconnected. Stored provider tokens and imported repository data were removed.",
  };
}
