/** Evidence Ledger Editorial — private reviewer page for one assigned Phase 29 verification, not a discovery queue or automated scoring surface. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { ReviewerVerificationDetail } from "@/components/verification/verification-workflow";
import { authorizeActiveContext } from "@/lib/roles/context";
import { getWorkspaceVerification } from "@/lib/verification/context";
import { getProjectWorkspace } from "@/lib/workspace/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Assigned verification | Proofly",
  robots: { index: false, follow: false },
};

export default async function ReviewerVerificationPage({
  params,
}: Readonly<{ params: Promise<{ workspaceId: string }> }>) {
  const { workspaceId } = await params;
  const [session, authorization, workspace, verification] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "reviewer" }),
    getProjectWorkspace(workspaceId),
    getWorkspaceVerification(workspaceId),
  ]);
  if (!session)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/reviewer/verifications/${workspaceId}`)}`
    );
  if (
    !authorization.ok ||
    !workspace ||
    !verification ||
    workspace.accessRole !== "reviewer"
  )
    notFound();
  return (
    <AuthShell
      eyebrow="Assigned verification"
      title={workspace.project.title}
      description="A restricted human-review record for one exact submission version and its locked rubric."
    >
      <ReviewerVerificationDetail
        workspaceId={workspaceId}
        verification={verification}
        lockedRubric={workspace.reviewContext.lockedRubric}
      />
    </AuthShell>
  );
}
