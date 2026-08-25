/** Proofly Phase 15: provider-agnostic server-only signature and replay primitives; a future provider route must persist replay receipts before acknowledgement. */
import { createHmac, timingSafeEqual } from "node:crypto";

export type WebhookVerificationInput = Readonly<{
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  now?: number;
  maxAgeSeconds?: number;
}>;

/** Verifies a bounded `sha256=<hex>` HMAC over `<timestamp>.<raw body>` without leaking a signature mismatch reason. */
export function verifyWebhookSignature({
  rawBody,
  signature,
  timestamp,
  secret,
  now = Date.now(),
  maxAgeSeconds = 5 * 60,
}: WebhookVerificationInput) {
  if (!signature || !timestamp || !secret || rawBody.length > 1_000_000)
    return false;
  const timestampMs = Number(timestamp) * 1000;
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(now - timestampMs) > maxAgeSeconds * 1000
  )
    return false;
  const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  const received = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    received.length === expectedBuffer.length &&
    timingSafeEqual(received, expectedBuffer)
  );
}

/** Deterministic replay guard for tests and single-process development; production provider routes must replace this with a durable unique provider-event receipt. */
export function createWebhookReplayGuard(now = () => Date.now()) {
  const receipts = new Map<string, number>();
  return {
    accept(provider: string, eventId: string, ttlMs = 24 * 60 * 60 * 1000) {
      if (!provider || !eventId || eventId.length > 200) return false;
      const key = `${provider}:${eventId}`;
      const existing = receipts.get(key);
      const currentTime = now();
      if (existing && existing > currentTime) return false;
      receipts.set(key, currentTime + ttlMs);
      return true;
    },
  };
}
