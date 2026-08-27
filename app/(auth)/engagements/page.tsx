/** Phase 33 Evidence Ledger Editorial page: a private noindex engagement index with calm, non-public record language. */
import type { Metadata } from "next";

import { EngagementListView } from "@/components/engagement/engagement-surfaces";
import { getEngagementList } from "@/lib/engagement/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private engagements | Proofly",
  robots: { index: false, follow: false },
};

export default async function EngagementsPage() {
  const context = await getEngagementList();
  return (
    <EngagementListView
      activeRole={context.activeRole}
      engagements={context.items}
    />
  );
}
