/** Proofly Phase 14: protected personal account settings, private by default and deliberately separated from organization configuration. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountSettings } from "@/components/settings/account-settings";
import { getAccountSettingsContext } from "@/lib/settings/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Account settings — Proofly",
  robots: { index: false, follow: false },
};

export default async function SettingsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ github?: string }> }>) {
  const context = await getAccountSettingsContext();
  if (!context) redirect("/sign-in?next=/settings&error=session-expired");
  const { github } = await searchParams;
  return <AccountSettings context={context} githubOAuthStatus={github ?? ""} />;
}
