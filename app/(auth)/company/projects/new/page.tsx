/** Phase 22 route: private authorized company Project/Challenge drafting only; no discovery, application, reviewer, payment, or workspace surface. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewCompanyProjectEditor } from "@/components/project/company-project-editor";
import { getNewCompanyProjectContext } from "@/lib/project/context";

export const metadata: Metadata = {
  title: "Create a project — Proofly",
  robots: { index: false, follow: false },
};

export default async function NewCompanyProjectPage() {
  const context = await getNewCompanyProjectContext();
  if (!context.activeCompanyContext) {
    redirect("/sign-in?next=/company/projects/new");
  }
  return <NewCompanyProjectEditor {...context} />;
}
