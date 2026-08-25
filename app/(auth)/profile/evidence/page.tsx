import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TalentEvidenceList } from "@/components/evidence/talent-evidence-list";
import { getTalentWorkEvidenceList } from "@/lib/evidence/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Work evidence | Proofly",
  robots: { index: false, follow: false },
};

export default async function TalentEvidenceListPage() {
  const evidence = await getTalentWorkEvidenceList();
  if (!evidence) redirect("/auth/continue");
  return <TalentEvidenceList evidence={evidence} />;
}
