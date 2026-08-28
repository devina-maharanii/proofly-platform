/** Phase 34 payout route: verified Talent session → restricted context reader → provider-hosted sandbox onboarding. */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createPaymentAdminSupabaseClient } from "@/lib/payments/admin";
import { getSandboxStripeConfig } from "@/lib/payments/config";
import { createStripePayoutOnboarding } from "@/lib/payments/stripe";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import { getTrustedAppUrl } from "@/lib/supabase/config";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function redirect(status: string) {
  const url = new URL("/payouts", getTrustedAppUrl());
  url.searchParams.set("payment", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const payoutAccountId = request.nextUrl.searchParams.get("payoutAccountId");
  if (!payoutAccountId || !uuid.test(payoutAccountId))
    return redirect("invalid-request");
  const [session, supabase, providerConfig, admin] = await Promise.all([
    getVerifiedAuthSession(),
    createServerSupabaseClient(),
    Promise.resolve(getSandboxStripeConfig()),
    Promise.resolve(createPaymentAdminSupabaseClient()),
  ]);
  if (!session || !supabase) return redirect("session-expired");
  const requestHeaders = await headers();
  const address =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  if (
    !securityRateLimiter.check("sensitive-account", session.userId, address).ok
  )
    return redirect("rate-limited");
  if (!providerConfig || !admin) return redirect("configuration-unavailable");
  const { data, error } = await supabase.rpc("get_payout_onboarding_context", {
    requested_payout_account_id: payoutAccountId,
  });
  const context =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const providerAccountReference =
    typeof context?.provider_account_reference === "string"
      ? context.provider_account_reference
      : null;
  if (error || !context) return redirect("unavailable");
  try {
    const onboarding = await createStripePayoutOnboarding(providerConfig, {
      payoutAccountId,
      providerAccountReference,
    });
    const { error: recordError } = await admin.rpc(
      "record_payout_onboarding_started",
      {
        requested_payout_account_id: payoutAccountId,
        requested_provider_account_reference:
          onboarding.providerAccountReference,
      }
    );
    if (recordError) return redirect("provider-record-unavailable");
    const url = new URL(onboarding.onboardingUrl);
    if (url.protocol !== "https:" || url.hostname !== "connect.stripe.com")
      return redirect("configuration-unavailable");
    return NextResponse.redirect(url);
  } catch {
    return redirect("provider-unavailable");
  }
}
