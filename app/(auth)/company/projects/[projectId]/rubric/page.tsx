/** Design: Evidence Ledger Editorial — a private, organization-bound rubric authoring record with explicit version provenance and human ownership. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { RubricEditor } from "@/components/rubric/rubric-editor";
import {
  emptyProjectRubric,
  getCompanyProjectRubric,
} from "@/lib/rubric/context";
import { getCompanyProjectContext } from "@/lib/project/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Project rubric | Proofly",
  robots: { index: false, follow: false },
};

export default async function ProjectRubricPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { projectId } = await params;
  const [session, projectContext] = await Promise.all([
    getVerifiedAuthSession(),
    getCompanyProjectContext(projectId),
  ]);
  if (!session)
    redirect(
      `/sign-in?next=/company/projects/${encodeURIComponent(projectId)}/rubric&error=session-expired`
    );
  if (!projectContext || !projectContext.canEdit) notFound();
  const rubric =
    (await getCompanyProjectRubric(projectId, projectContext)) ??
    emptyProjectRubric(
      projectId,
      projectContext.project.organizationId,
      projectContext
    );
  return (
    <AuthShell
      eyebrow="Private project rubric"
      title="Make project evaluation explainable"
      description="Author a scoped, versioned rubric with observable criteria, contextual descriptors, visibility boundaries, and calibration guidance. It does not assign reviewers, calculate scores, or make a decision."
    >
      <RubricEditor
        projectId={projectId}
        projectTitle={projectContext.project.title}
        rubric={rubric}
      />
    </AuthShell>
  );
}
