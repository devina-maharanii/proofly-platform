/** Phase 34 webhook: raw signed Stripe event → normalized/redacted facts → durable service-role receipt. */
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createPaymentAdminSupabaseClient } from "@/lib/payments/admin";
import { getSandboxStripeConfig } from "@/lib/payments/config";
import { verifyAndNormalizeStripeEvent } from "@/lib/payments/stripe";
import { securityRateLimiter } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

function clientAddress(requestHeaders: Headers) {
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const requestHeaders = await headers();
  const limit = securityRateLimiter.check(
    "webhook",
    "stripe",
    clientAddress(requestHeaders)
  );
  if (!limit.ok)
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  const config = getSandboxStripeConfig();
  if (!config) return new NextResponse(null, { status: 503 });
  const rawBody = await request.text();
  const event = verifyAndNormalizeStripeEvent(
    rawBody,
    requestHeaders.get("stripe-signature"),
    config
  );
  if (!event) return new NextResponse(null, { status: 400 });
  const admin = createPaymentAdminSupabaseClient();
  if (!admin) return new NextResponse(null, { status: 503 });
  const { data: configuration, error: configurationError } = await admin
    .from("payment_provider_configurations")
    .select("id")
    .eq("provider", "stripe")
    .eq("mode", "sandbox")
    .eq("state", "sandbox_ready")
    .eq("provider_account_reference", config.platformAccountReference)
    .maybeSingle();
  if (configurationError || typeof configuration?.id !== "string") {
    return new NextResponse(null, { status: 503 });
  }
  const rpcInput = {
    requested_provider_configuration_id: configuration.id,
    requested_provider_event_id: event.providerEventId,
    requested_provider_event_type: event.providerEventType,
    requested_provider_object_reference: event.providerObjectReference,
    requested_provider_account_reference: event.providerAccountReference,
    requested_normalized_event_type: event.normalizedEventType,
    requested_occurred_at: event.occurredAt,
    requested_redacted_payload: event.redactedPayload,
    requested_raw_body_sha256: event.rawBodySha256,
  };
  const { data, error } = await admin.rpc(
    "record_verified_payment_provider_event",
    rpcInput as never
  );
  const state =
    data && typeof data === "object"
      ? (data as { state?: unknown }).state
      : null;
  if (
    !error &&
    (state === "processed" || state === "ignored" || state === "dead_letter")
  )
    return new NextResponse(null, { status: 204 });
  if (error) {
    await admin.rpc("record_payment_provider_event_failure", {
      ...rpcInput,
      requested_failure_code: "PROCESSING_RETRY_REQUIRED",
      requested_permanent_failure: false,
    } as never);
  }
  return new NextResponse(null, { status: 503 });
}
