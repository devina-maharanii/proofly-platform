/** Phase 34 Evidence Ledger Editorial page: noindex, billing-authority-only private company money record. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { CompanyBillingOverviewView } from "@/components/payments/payment-surfaces";
import { getCompanyBillingOverview } from "@/lib/payments/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CompanyBillingPage() {
  if (!(await getVerifiedAuthSession()))
    redirect("/sign-in?next=%2Fcompany%2Fbilling");
  return (
    <AuthShell
      eyebrow="Private company finance"
      title="Billing records, not public payment claims"
      description="Only an active company billing context can access this private sandbox coordination record. Provider verification—not browser callbacks—controls financial states."
    >
      <CompanyBillingOverviewView
        overview={await getCompanyBillingOverview()}
      />
    </AuthShell>
  );
}
