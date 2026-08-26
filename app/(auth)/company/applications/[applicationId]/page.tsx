/** Phase 24 private company receipt: direct authorized read only; no applicant index, scoring, shortlist, invitation, rejection, or other review workflow. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CompanyApplicationReceiptView } from "@/components/application/application-surfaces";
import { getCompanyProjectApplicationReceipt } from "@/lib/application/context";
import { authorizeActiveContext } from "@/lib/roles/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CompanyApplicationReceiptPage({
  params,
}: Readonly<{ params: Promise<{ applicationId: string }> }>) {
  const { applicationId } = await params;
  const authorization = await authorizeActiveContext({
    role: "company_member",
  });
  if (!authorization.ok) redirect("/auth/continue");
  const receipt = await getCompanyProjectApplicationReceipt(applicationId);
  if (!receipt) notFound();
  return <CompanyApplicationReceiptView receipt={receipt} />;
}
