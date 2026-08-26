/** Phase 26 route: protected task detail; the server reader independently verifies private workspace access and hides unavailable task existence. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { WorkspaceTaskDetailView } from "@/components/workspace/workspace-task-detail";
import { getVerifiedAuthSession } from "@/lib/supabase/server";
import { getWorkspaceTask } from "@/lib/workspace/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function WorkspaceTaskPage({
  params,
}: Readonly<{ params: Promise<{ workspaceId: string; taskId: string }> }>) {
  const { workspaceId, taskId } = await params;
  const session = await getVerifiedAuthSession();
  if (!session) {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/workspaces/${workspaceId}/tasks/${taskId}`)}`
    );
  }
  const task = await getWorkspaceTask(taskId);
  if (!task || task.workspaceId !== workspaceId) notFound();
  return (
    <AuthShell
      eyebrow="Project workspace"
      title="Task detail"
      description="A participant-scoped task record with private work context and auditable state."
    >
      <WorkspaceTaskDetailView task={task} />
    </AuthShell>
  );
}
