/** Evidence Ledger Editorial — Phase 29 administrator route is private, noindex, and limited to appeal assignment plus accountable revocation. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerificationAdminQueue } from "@/components/verification/verification-admin-queue";
import { authorizeActiveContext } from "@/lib/roles/context";
import {
  getAdminVerificationQueue,
  getVerificationReviewerCandidates,
} from "@/lib/verification/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Verification accountability | Proofly",
  robots: { index: false, follow: false },
};

export default async function VerificationAdminPage() {
  const [session, authorization] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "administrator" }),
  ]);
  if (!session) redirect("/sign-in?next=%2Fadmin%2Fverifications");
  if (!authorization.ok) notFound();
  const items = await getAdminVerificationQueue();
  const candidates = await Promise.all(
    items.map(
      async item =>
        [item.id, await getVerificationReviewerCandidates(item.id)] as const
    )
  );
  return (
    <AuthShell
      eyebrow="Administrator"
      title="Verification accountability"
      description="Restricted controls for separately assigning appeal reviewers and revoking a verified record with retained audit evidence."
    >
      <VerificationAdminQueue
        items={items}
        candidatesByVerification={Object.fromEntries(candidates)}
      />
    </AuthShell>
  );
}
