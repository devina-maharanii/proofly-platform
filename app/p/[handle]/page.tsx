import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicTalentProfileView } from "@/components/profile/public-talent-profile";
import { getPublicTalentWorkEvidence } from "@/lib/evidence/context";
import { getPublicTalentProfile } from "@/lib/profile/context";

type PublicProfilePageProps = Readonly<{ params: Promise<{ handle: string }> }>;

export async function generateMetadata({
  params,
}: PublicProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getPublicTalentProfile(handle);
  return profile
    ? {
        title: `${profile.displayName} | Proofly`,
        description: profile.headline,
      }
    : {
        title: "Profile not found | Proofly",
        robots: { index: false, follow: false },
      };
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const { handle } = await params;
  const [profile, evidence] = await Promise.all([
    getPublicTalentProfile(handle),
    getPublicTalentWorkEvidence(handle),
  ]);
  if (!profile) notFound();
  return <PublicTalentProfileView profile={profile} evidence={evidence} />;
}
