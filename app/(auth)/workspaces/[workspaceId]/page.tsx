/** Phase 25 route: protected, noindex workspace page; the private database reader is the authoritative participant/organization/reviewer access decision. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ProjectWorkspaceView } from "@/components/workspace/project-workspace";
import { getVerifiedAuthSession } from "@/lib/supabase/server";
import {
  getVerificationReviewerCandidates,
  getTalentEvidencePublicationChoices,
  getWorkspaceVerification,
} from "@/lib/verification/context";
import {
  getProjectWorkspace,
  getWorkspaceFiles,
  getWorkspaceSubmission,
} from "@/lib/workspace/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function WorkspacePage({
  params,
}: Readonly<{ params: Promise<{ workspaceId: string }> }>) {
  const { workspaceId } = await params;
  const session = await getVerifiedAuthSession();
  if (!session) {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/workspaces/${workspaceId}`)}`
    );
  }
  const [workspace, files, submission, verification] = await Promise.all([
    getProjectWorkspace(workspaceId),
    getWorkspaceFiles(workspaceId),
    getWorkspaceSubmission(workspaceId),
    getWorkspaceVerification(workspaceId),
  ]);
  if (!workspace) notFound();
  const [reviewerCandidates, evidenceChoices] = await Promise.all([
    verification && workspace.accessRole === "company_participant"
      ? getVerificationReviewerCandidates(verification.id)
      : [],
    workspace.accessRole === "talent_participant"
      ? getTalentEvidencePublicationChoices()
      : [],
  ]);
  return (
    <ProjectWorkspaceView
      workspace={workspace}
      files={files}
      submission={submission}
      verification={verification}
      reviewerCandidates={reviewerCandidates}
      evidenceChoices={evidenceChoices}
    />
  );
}
