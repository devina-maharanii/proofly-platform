/** Evidence Ledger Editorial — Phase 32 administrator surface is restricted to rule provenance and aggregate safety/evaluation audit information. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MatchingAdministrationSurface } from "@/components/matching/matching-surfaces";
import { getMatchingAdministrationSummary } from "@/lib/matching/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Matching audit | Proofly",
  robots: { index: false, follow: false },
};

export default async function MatchingAdministrationPage() {
  const summary = await getMatchingAdministrationSummary();
  if (!summary) redirect("/sign-in?next=/admin/matching&error=session-expired");
  return <MatchingAdministrationSurface summary={summary} />;
}
