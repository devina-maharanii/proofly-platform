/** Phase 24 private Talent receipt: RLS-compatible server reader; no public application content, company review actions, messaging, or promises. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ApplicationDetail } from "@/components/application/application-surfaces";
import { getTalentProjectApplication } from "@/lib/application/context";
import { authorizeActiveContext } from "@/lib/roles/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ApplicationDetailPage({
  params,
}: Readonly<{ params: Promise<{ applicationId: string }> }>) {
  const { applicationId } = await params;
  const authorization = await authorizeActiveContext({ role: "talent" });
  if (!authorization.ok) redirect("/auth/continue");
  const application = await getTalentProjectApplication(applicationId);
  if (!application) notFound();
  return <ApplicationDetail application={application} />;
}
