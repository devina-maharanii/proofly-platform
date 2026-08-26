/** Design: Evidence Ledger Editorial — an explicit reviewer eligibility boundary, never a fabricated opportunity feed. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ReviewerOpportunityGuard } from "@/components/reviewer/reviewer-opportunity-guard";
import { getReviewerOpportunityGuard } from "@/lib/reviewer/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reviewer opportunities | Proofly",
  robots: { index: false, follow: false },
};

export default async function ReviewerOpportunitiesPage() {
  const [session, guard] = await Promise.all([
    getVerifiedAuthSession(),
    getReviewerOpportunityGuard(),
  ]);
  if (!session)
    redirect("/sign-in?next=/reviewer/opportunities&error=session-expired");
  return <ReviewerOpportunityGuard guard={guard} />;
}
