/** Evidence Ledger Editorial — Phase 31 notification preferences are private, noindex, and transparent about the absence of external delivery providers. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CommunicationNotificationPreferencesView } from "@/components/communication/messaging-surfaces";
import { getCommunicationNotificationPreferences } from "@/lib/communication/context";
import { authorizeActiveContext } from "@/lib/roles/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function NotificationPreferencesPage() {
  const authorization = await authorizeActiveContext();
  if (!authorization.ok) redirect("/auth/continue");
  return (
    <CommunicationNotificationPreferencesView
      preferences={await getCommunicationNotificationPreferences()}
    />
  );
}
