/** Phase 33 Evidence Ledger Editorial page: noindex administrator-only human dispute queue without automated outcomes. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EngagementDisputeQueue } from "@/components/engagement/engagement-surfaces";
import { getEngagementDisputeQueue } from "@/lib/engagement/context";
import { authorizeActiveContext } from "@/lib/roles/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Engagement dispute review | Proofly",
  robots: { index: false, follow: false },
};

export default async function EngagementDisputesPage() {
  const [session, authorization] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "administrator" }),
  ]);
  if (!session) redirect("/sign-in?next=%2Fadmin%2Fengagements%2Fdisputes");
  if (!authorization.ok) notFound();
  return (
    <EngagementDisputeQueue disputes={await getEngagementDisputeQueue()} />
  );
}
