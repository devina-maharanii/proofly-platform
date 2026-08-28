/** Phase 34 Evidence Ledger Editorial page: noindex administrator-only reconciliation and dead-letter queue. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { PaymentReconciliationQueueView } from "@/components/payments/payment-surfaces";
import { getPaymentReconciliationQueue } from "@/lib/payments/context";
import { authorizeActiveContext } from "@/lib/roles/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PaymentReconciliationPage() {
  const [session, authorization] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "administrator" }),
  ]);
  if (!session) redirect("/sign-in?next=%2Fadmin%2Fpayments%2Freconciliation");
  return (
    <AuthShell
      eyebrow="Restricted payment operations"
      title="Reconciliation requires accountable human review"
      description={
        authorization.ok
          ? "Provider payloads are intentionally omitted. This queue cannot approve money movement, resolve a dispute, or mark a record paid."
          : "Administrator context is required for reconciliation review."
      }
    >
      <PaymentReconciliationQueueView
        queue={authorization.ok ? await getPaymentReconciliationQueue() : null}
      />
    </AuthShell>
  );
}
