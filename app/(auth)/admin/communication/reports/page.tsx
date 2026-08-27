/** Evidence Ledger Editorial — Phase 31 moderation is a noindex, least-privilege human review surface; reports and actions retain restricted audit context. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CommunicationModerationQueue } from "@/components/communication/messaging-surfaces";
import { getCommunicationModerationQueue } from "@/lib/communication/context";
import { authorizeActiveContext } from "@/lib/roles/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CommunicationReportsPage() {
  const authorization = await authorizeActiveContext({ role: "administrator" });
  if (!authorization.ok) redirect("/auth/continue");
  return (
    <CommunicationModerationQueue
      reports={await getCommunicationModerationQueue()}
    />
  );
}
