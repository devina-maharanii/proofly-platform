/** Evidence Ledger Editorial — Phase 31 conversation records are noindex, participant-restricted, ordered, and re-authorized by the server reader. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CommunicationConversationView } from "@/components/communication/messaging-surfaces";
import { getCommunicationConversation } from "@/lib/communication/context";
import { authorizeActiveContext } from "@/lib/roles/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ConversationPage({
  params,
}: Readonly<{ params: Promise<{ conversationId: string }> }>) {
  const { conversationId } = await params;
  const authorization = await authorizeActiveContext();
  if (!authorization.ok) redirect("/auth/continue");
  const conversation = await getCommunicationConversation(conversationId);
  if (!conversation) notFound();
  return <CommunicationConversationView conversation={conversation} />;
}
