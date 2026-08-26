/** Phase 25 route: protected, noindex workspace page; the private database reader is the authoritative participant/organization/reviewer access decision. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ProjectWorkspaceView } from "@/components/workspace/project-workspace";
import { getVerifiedAuthSession } from "@/lib/supabase/server";
import { getProjectWorkspace } from "@/lib/workspace/context";

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
  const workspace = await getProjectWorkspace(workspaceId);
  if (!workspace) notFound();
  return <ProjectWorkspaceView workspace={workspace} />;
}
