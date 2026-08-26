/** Design: Evidence Ledger Editorial — private reviewer evidence and lifecycle clarity, not public reputation or scoring. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { ReviewerApplicationEditor } from "@/components/reviewer/reviewer-application-editor";
import { getReviewerApplication } from "@/lib/reviewer/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reviewer application | Proofly",
  robots: { index: false, follow: false },
};

export default async function ReviewerApplicationPage() {
  const [session, application] = await Promise.all([
    getVerifiedAuthSession(),
    getReviewerApplication(),
  ]);
  if (!session)
    redirect("/sign-in?next=/reviewer/application&error=session-expired");
  return (
    <AuthShell
      eyebrow="Private reviewer application"
      title="Make review responsibility legible"
      description="Show practical review context, canonical expertise, availability, and conflicts so a human administrator can make an accountable operational decision."
    >
      <ReviewerApplicationEditor application={application} />
    </AuthShell>
  );
}
