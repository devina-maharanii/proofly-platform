/** Phase 24 private Talent route: application status is owner-only, noindex, and never a public opportunity or applicant directory. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ApplicationsList } from "@/components/application/application-surfaces";
import { getTalentProjectApplications } from "@/lib/application/context";
import { authorizeActiveContext } from "@/lib/roles/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ApplicationsPage() {
  const authorization = await authorizeActiveContext({ role: "talent" });
  if (!authorization.ok) redirect("/auth/continue");
  return (
    <ApplicationsList applications={await getTalentProjectApplications()} />
  );
}
