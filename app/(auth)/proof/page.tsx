/** Evidence Ledger Editorial — Phase 30 private Talent audit; no public score or ranking surface. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PrivateProofGraphAudit } from "@/components/proof-graph/private-proof-graph-audit";
import { getTalentProofGraphAudit } from "@/lib/proof-graph/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Proof audit | Proofly",
  robots: { index: false, follow: false },
};

export default async function TalentProofAuditPage() {
  const audit = await getTalentProofGraphAudit();
  if (!audit) redirect("/sign-in?next=/proof&error=session-expired");
  return <PrivateProofGraphAudit audit={audit} />;
}
