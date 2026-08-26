import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CompanyProfileEditor } from "@/components/company/company-profile-editor";
import { getCompanyProfileContext } from "@/lib/company/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Company profile | Proofly",
  robots: { index: false, follow: false },
};

export default async function CompanyProfilePage() {
  const context = await getCompanyProfileContext();
  if (!context)
    redirect("/sign-in?next=/company/profile&error=session-expired");
  return <CompanyProfileEditor context={context} />;
}
