/**
 * Phase 19 — GitHub connection entry point.
 * This route retains the authenticated server boundary; the Edge Function owns
 * OAuth state, PKCE verifier, client secret, and provider token lifecycle.
 */
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  getGithubIntegrationFunctionUrl,
  getGithubIntegrationPublishableKey,
} from "@/lib/github/config";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import { getVerifiedAuthAccess } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function settingsRedirect(status: string) {
  const url = new URL(
    "/settings",
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  );
  url.searchParams.set("github", status);
  return NextResponse.redirect(url);
}

export async function GET() {
  const [access, functionUrl, publishableKey] = await Promise.all([
    getVerifiedAuthAccess(),
    Promise.resolve(getGithubIntegrationFunctionUrl()),
    Promise.resolve(getGithubIntegrationPublishableKey()),
  ]);
  if (!access) return settingsRedirect("session-expired");
  if (!functionUrl || !publishableKey)
    return settingsRedirect("configuration-unavailable");
  const requestHeaders = await headers();
  const address =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  const limit = securityRateLimiter.check(
    "sensitive-account",
    access.userId,
    address
  );
  if (!limit.ok) return settingsRedirect("rate-limited");

  try {
    const response = await fetch(`${functionUrl}/begin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access.accessToken}`,
        apikey: publishableKey,
      },
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as {
      authorizationUrl?: unknown;
    } | null;
    if (!response.ok || typeof body?.authorizationUrl !== "string") {
      return settingsRedirect("configuration-unavailable");
    }
    const authorizationUrl = new URL(body.authorizationUrl);
    if (authorizationUrl.origin !== "https://github.com") {
      return settingsRedirect("configuration-unavailable");
    }
    return NextResponse.redirect(authorizationUrl);
  } catch {
    return settingsRedirect("configuration-unavailable");
  }
}
