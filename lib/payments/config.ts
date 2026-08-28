/** Phase 34 configuration: payment credentials remain server-only and sandbox-only until a separately approved production launch. */
import "server-only";

import { getTrustedAppUrl } from "@/lib/supabase/config";

export type SandboxStripeConfig = Readonly<{
  secretKey: string;
  webhookSecret: string;
  platformAccountReference: string;
  appUrl: string;
}>;

const safeReference = (value: string | undefined) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{6,180}$/.test(value)
    ? value
    : null;

export function getSandboxStripeConfig(): SandboxStripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const platformAccountReference = safeReference(
    process.env.STRIPE_PLATFORM_ACCOUNT_REFERENCE
  );
  const appUrl = getTrustedAppUrl();
  if (
    !secretKey?.startsWith("sk_test_") ||
    !webhookSecret?.startsWith("whsec_") ||
    !platformAccountReference ||
    !appUrl.startsWith("http")
  ) {
    return null;
  }
  return { secretKey, webhookSecret, platformAccountReference, appUrl };
}
