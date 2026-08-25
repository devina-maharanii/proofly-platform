/** Proofly Phase 11: callback destinations are a small fixed allowlist, never user-controlled URLs. */
import { getTrustedAppUrl } from "@/lib/supabase/config";

const allowedAuthDestinations = new Set([
  "/",
  "/sign-in",
  "/sign-up",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/auth/continue",
  "/get-started",
]);

export function safeAuthRedirect(
  candidate: string | null | undefined,
  fallback = "/auth/continue"
) {
  if (!candidate || !candidate.startsWith("/")) {
    return fallback;
  }

  const parsed = new URL(candidate, "https://proofly.invalid");
  if (parsed.origin !== "https://proofly.invalid") {
    return fallback;
  }

  return allowedAuthDestinations.has(parsed.pathname)
    ? parsed.pathname
    : fallback;
}

export function authCallbackUrl(nextPath: string) {
  const callbackUrl = new URL("/auth/callback", getTrustedAppUrl());
  callbackUrl.searchParams.set("next", safeAuthRedirect(nextPath, "/"));
  return callbackUrl.toString();
}
