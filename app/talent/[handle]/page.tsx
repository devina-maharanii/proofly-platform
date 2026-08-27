/** Phase 20 style: precision-editorial public evidence profile with evidence as the visual center. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { canonicalUrl, siteConfig } from "@/app/seo";
import { PublicTalentProfileView } from "@/components/profile/public-talent-profile";
import { getPublicTalentWorkEvidence } from "@/lib/evidence/context";
import { getPublicGithubContext } from "@/lib/github/context";
import {
  getPublicTalentProfile,
  publicTalentProfilePath,
} from "@/lib/profile/context";
import { getPublicTalentProofGraph } from "@/lib/proof-graph/context";
import { getPublicTalentProofs } from "@/lib/proof/context";

type PublicProfilePageProps = Readonly<{
  params: Promise<{ handle: string }>;
}>;

const getCachedPublicTalentProfile = cache(getPublicTalentProfile);

function profileDescription(profile: {
  headline: string;
  developerFocus: string;
}) {
  const headline = profile.headline.trim();
  const focus = profile.developerFocus.trim();
  if (headline && focus) return `${headline} Focus: ${focus}.`;
  return headline || focus || "A public evidence profile on Proofly.";
}

export async function generateMetadata({
  params,
}: PublicProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getCachedPublicTalentProfile(handle);
  if (!profile) notFound();

  const pathname = publicTalentProfilePath(profile.handle);
  const title = `${profile.displayName} — public evidence profile | Proofly`;
  const description = profileDescription(profile);
  const image = `${canonicalUrl(pathname)}/opengraph-image`;
  return {
    title,
    description,
    alternates: { canonical: pathname },
    robots: siteConfig.publicUrl
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: canonicalUrl(pathname),
      type: "profile",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicTalentProfilePage({
  params,
}: PublicProfilePageProps) {
  const { handle } = await params;
  const profile = await getCachedPublicTalentProfile(handle);
  if (!profile) notFound();

  const [evidence, proofs, github, graph] = await Promise.all([
    getPublicTalentWorkEvidence(profile.handle),
    getPublicTalentProofs(profile.handle),
    getPublicGithubContext(profile.handle),
    getPublicTalentProofGraph(profile.handle),
  ]);

  return (
    <PublicTalentProfileView
      profile={profile}
      evidence={evidence}
      proofs={proofs}
      github={github}
      graph={graph}
      shareUrl={canonicalUrl(publicTalentProfilePath(profile.handle))}
    />
  );
}
