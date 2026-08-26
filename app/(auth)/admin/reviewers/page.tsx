/** Design: Evidence Ledger Editorial — restricted administrator ledger rows with explicit human decisions and auditable state changes. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { ReviewerAdminQueue } from "@/components/reviewer/reviewer-admin-queue";
import { authorizeActiveContext } from "@/lib/roles/context";
import { getReviewerAdminQueue } from "@/lib/reviewer/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reviewer screening | Proofly",
  robots: { index: false, follow: false },
};

export default async function ReviewerAdminQueuePage() {
  const [session, authorization] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "administrator" }),
  ]);
  if (!session)
    redirect("/sign-in?next=/admin/reviewers&error=session-expired");
  if (!authorization.ok) notFound();
  const items = await getReviewerAdminQueue();
  return (
    <AuthShell
      eyebrow="Private administration"
      title="Reviewer screening ledger"
      description="Each approval, more-evidence request, pause, suspension, or rejection is a human, private, and auditable lifecycle decision."
    >
      <ReviewerAdminQueue items={items} />
    </AuthShell>
  );
}
