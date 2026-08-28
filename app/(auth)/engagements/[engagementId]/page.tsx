/** Phase 33 Evidence Ledger Editorial page: participant-only noindex terms, milestone, safety, and audit detail. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EngagementDetailView } from "@/components/engagement/engagement-surfaces";
import { EngagementPaymentPanel } from "@/components/payments/payment-surfaces";
import { getParticipantEngagement } from "@/lib/engagement/context";
import { getEngagementPaymentStatus } from "@/lib/payments/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function EngagementPage({
  params,
}: Readonly<{ params: Promise<{ engagementId: string }> }>) {
  const { engagementId } = await params;
  if (!(await getVerifiedAuthSession()))
    redirect(
      `/sign-in?next=${encodeURIComponent(`/engagements/${engagementId}`)}`
    );
  const [engagement, paymentStatus] = await Promise.all([
    getParticipantEngagement(engagementId),
    getEngagementPaymentStatus(engagementId),
  ]);
  if (!engagement) notFound();
  return (
    <>
      <EngagementDetailView engagement={engagement} />
      <EngagementPaymentPanel engagement={engagement} status={paymentStatus} />
    </>
  );
}
