/** Evidence Ledger Editorial — Phase 31 inbox is a private, context-bound communication ledger; no public feed or discovery behavior exists here. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CommunicationInbox } from "@/components/communication/messaging-surfaces";
import {
  getCommunicationInbox,
  getCommunicationNotificationPreferences,
  getCommunicationNotifications,
} from "@/lib/communication/context";
import { authorizeActiveContext } from "@/lib/roles/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MessagesPage() {
  const authorization = await authorizeActiveContext();
  if (!authorization.ok) redirect("/auth/continue");
  const [inbox, notifications, preferences] = await Promise.all([
    getCommunicationInbox(),
    getCommunicationNotifications(),
    getCommunicationNotificationPreferences(),
  ]);
  return (
    <CommunicationInbox
      inbox={inbox}
      notifications={notifications}
      preferences={preferences}
    />
  );
}
