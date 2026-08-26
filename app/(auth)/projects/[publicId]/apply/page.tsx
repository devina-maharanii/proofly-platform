/** Phase 24 private Talent route: eligible Project application drafting only; server and database repeat deadline/state checks at every mutation. */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ApplicationEditor } from "@/components/application/application-surfaces";
import { getApplicationEditorContext } from "@/lib/application/context";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProjectApplicationPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const { publicId } = await params;
  const session = await getVerifiedAuthSession();
  if (!session)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/projects/${publicId}/apply`)}`
    );
  const context = await getApplicationEditorContext(publicId);
  if (!context) notFound();
  return <ApplicationEditor context={context} />;
}
