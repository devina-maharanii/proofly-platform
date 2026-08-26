/** Phase 22 route: private company project draft, preview, and lifecycle controls are scoped to a verified active organization membership. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CompanyProjectEditor } from "@/components/project/company-project-editor";
import { getCompanyProjectContext } from "@/lib/project/context";

export const metadata: Metadata = {
  title: "Private project draft — Proofly",
  robots: { index: false, follow: false },
};

export default async function CompanyProjectPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { projectId } = await params;
  const context = await getCompanyProjectContext(projectId);
  if (!context) {
    redirect(
      `/sign-in?next=/company/projects/${encodeURIComponent(projectId)}`
    );
  }
  if (!context.activeCompanyContext) notFound();
  return <CompanyProjectEditor context={context} />;
}
