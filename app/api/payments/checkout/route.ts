/** Phase 34 checkout route: verified billing session → restricted context reader → provider-hosted sandbox checkout. */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createPaymentAdminSupabaseClient } from "@/lib/payments/admin";
import { getSandboxStripeConfig } from "@/lib/payments/config";
import { createStripeCheckout } from "@/lib/payments/stripe";
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
  const url = new URL("/engagements", getTrustedAppUrl());
  url.searchParams.set("payment", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const paymentIntentId = request.nextUrl.searchParams.get("paymentIntentId");
  if (!paymentIntentId || !uuid.test(paymentIntentId))
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
  const { data, error } = await supabase.rpc("get_payment_checkout_context", {
    requested_payment_intent_id: paymentIntentId,
  });
  const context =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const amountMinor =
    typeof context?.amount_minor === "number" ? context.amount_minor : null;
  const currency =
    typeof context?.currency === "string" ? context.currency : null;
  if (error || !context || amountMinor === null || !currency)
    return redirect("unavailable");
  try {
    const checkout = await createStripeCheckout(providerConfig, {
      paymentIntentId,
      amountMinor,
      currency,
    });
    const { error: recordError } = await admin.rpc(
      "record_payment_checkout_created",
      {
        requested_payment_intent_id: paymentIntentId,
        requested_provider_payment_reference: checkout.providerPaymentReference,
        requested_provider_checkout_reference:
          checkout.providerCheckoutReference,
        requested_checkout_expires_at: checkout.expiresAt,
      }
    );
    if (recordError) return redirect("provider-record-unavailable");
    const url = new URL(checkout.checkoutUrl);
    if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
      return redirect("configuration-unavailable");
    return NextResponse.redirect(url);
  } catch {
    return redirect("provider-unavailable");
  }
}
