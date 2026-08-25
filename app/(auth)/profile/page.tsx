import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TalentProfileEditor } from "@/components/profile/talent-profile-editor";
import { getTalentProfileContext } from "@/lib/profile/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Talent profile | Proofly",
  robots: { index: false, follow: false },
};

export default async function TalentProfilePage() {
  const context = await getTalentProfileContext();
  if (!context) redirect("/sign-in?next=/profile&error=session-expired");
  return <TalentProfileEditor context={context} />;
}
