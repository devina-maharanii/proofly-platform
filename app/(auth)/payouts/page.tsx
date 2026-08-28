/** Phase 34 Evidence Ledger Editorial page: noindex, Talent-only private provider payout status. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { PayoutStatusView } from "@/components/payments/payment-surfaces";
import { getPrivatePayoutStatus } from "@/lib/payments/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PayoutsPage() {
  if (!(await getVerifiedAuthSession())) redirect("/sign-in?next=%2Fpayouts");
  return (
    <AuthShell
      eyebrow="Private payout record"
      title="Provider-held payout status"
      description="Payout destinations stay in the provider’s hosted flow. Proofly shows only private, provider-verified status and never makes legal, tax, or eligibility decisions."
    >
      <PayoutStatusView status={await getPrivatePayoutStatus()} />
    </AuthShell>
  );
}
