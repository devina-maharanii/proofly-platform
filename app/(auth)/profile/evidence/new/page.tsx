import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TalentEvidenceEditor } from "@/components/evidence/talent-evidence-editor";
import { getWorkEvidenceEditorContext } from "@/lib/evidence/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add work evidence | Proofly",
  robots: { index: false, follow: false },
};

export default async function NewWorkEvidencePage() {
  const context = await getWorkEvidenceEditorContext();
  if (!context)
    redirect("/sign-in?next=/profile/evidence/new&error=session-expired");
  return <TalentEvidenceEditor context={context} />;
}
