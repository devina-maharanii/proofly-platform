/** Evidence Ledger Editorial — Phase 32 company matching is a private source-led review aid and cannot mutate project applications or hiring state. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CompanyMatchingSurface } from "@/components/matching/matching-surfaces";
import { getCompanyMatchingContext } from "@/lib/matching/context";
import { getCompanyProjectContext } from "@/lib/project/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Project evidence matching | Proofly",
  robots: { index: false, follow: false },
};

export default async function CompanyProjectMatchingPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { projectId } = await params;
  const [context, projectContext] = await Promise.all([
    getCompanyMatchingContext(projectId),
    getCompanyProjectContext(projectId),
  ]);
  if (!context || !projectContext || !projectContext.canEdit)
    redirect(
      `/sign-in?next=/company/projects/${projectId}/matching&error=session-expired`
    );
  return (
    <CompanyMatchingSurface
      context={context}
      requiredSkills={projectContext.project.requiredSkills}
    />
  );
}
