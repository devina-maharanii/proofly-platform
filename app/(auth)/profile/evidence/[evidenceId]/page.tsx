import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { TalentEvidenceEditor } from "@/components/evidence/talent-evidence-editor";
import { getWorkEvidenceEditorContext } from "@/lib/evidence/context";

type EvidenceEditorPageProps = Readonly<{
  params: Promise<{ evidenceId: string }>;
}>;

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit work evidence | Proofly",
  robots: { index: false, follow: false },
};

export default async function WorkEvidenceEditorPage({
  params,
}: EvidenceEditorPageProps) {
  const { evidenceId } = await params;
  const context = await getWorkEvidenceEditorContext(evidenceId);
  if (!context) {
    if (!/^[0-9a-f-]{36}$/i.test(evidenceId)) notFound();
    redirect("/sign-in?next=/profile/evidence&error=session-expired");
  }
  return <TalentEvidenceEditor context={context} />;
}
