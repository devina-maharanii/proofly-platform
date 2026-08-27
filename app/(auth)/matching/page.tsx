/** Evidence Ledger Editorial — Phase 32 is a private, consented Talent recommendation view with source-linked explanations and no score. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TalentMatchingSurface } from "@/components/matching/matching-surfaces";
import { getTalentMatchingContext } from "@/lib/matching/context";
import { getTalentSavedProjectIds } from "@/lib/project/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My matching view | Proofly",
  robots: { index: false, follow: false },
};

export default async function TalentMatchingPage() {
  const [context, savedProjectIds] = await Promise.all([
    getTalentMatchingContext(),
    getTalentSavedProjectIds(),
  ]);
  if (!context) redirect("/sign-in?next=/matching&error=session-expired");
  return (
    <TalentMatchingSurface
      context={context}
      savedProjectIds={savedProjectIds}
    />
  );
}
