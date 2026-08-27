/** Phase 33 Evidence Ledger Editorial page: company-only noindex proposal preparation from an eligible private application receipt. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EngagementProposalEditor } from "@/components/engagement/engagement-surfaces";
import { getCompanyProjectApplicationReceipt } from "@/lib/application/context";
import {
  getEngagementList,
  getEngagementMarketOptions,
} from "@/lib/engagement/context";
import { authorizeActiveContext } from "@/lib/roles/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private engagement proposal | Proofly",
  robots: { index: false, follow: false },
};

export default async function CompanyEngagementProposalPage({
  params,
}: Readonly<{ params: Promise<{ applicationId: string }> }>) {
  const { applicationId } = await params;
  const [session, authorization] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "company_member" }),
  ]);
  if (!session)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/company/applications/${applicationId}/proposal`)}`
    );
  if (!authorization.ok) redirect("/auth/continue");
  const [receipt, markets, engagements] = await Promise.all([
    getCompanyProjectApplicationReceipt(applicationId),
    getEngagementMarketOptions(),
    getEngagementList(),
  ]);
  if (!receipt) notFound();
  return (
    <EngagementProposalEditor
      receipt={receipt}
      marketOptions={markets}
      completedTrials={engagements.items}
    />
  );
}
