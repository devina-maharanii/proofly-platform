/** Evidence Ledger Editorial — Phase 31 notification centre is a noindex, recipient-scoped record that hides notices when their source context is no longer authorized. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CommunicationNotificationCenter } from "@/components/communication/messaging-surfaces";
import {
  getCommunicationNotificationPreferences,
  getCommunicationNotifications,
} from "@/lib/communication/context";
import { authorizeActiveContext } from "@/lib/roles/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function NotificationsPage() {
  const authorization = await authorizeActiveContext();
  if (!authorization.ok) redirect("/auth/continue");
  const [notifications, preferences] = await Promise.all([
    getCommunicationNotifications(),
    getCommunicationNotificationPreferences(),
  ]);
  return (
    <CommunicationNotificationCenter
      notifications={notifications}
      preferences={preferences}
    />
  );
}
