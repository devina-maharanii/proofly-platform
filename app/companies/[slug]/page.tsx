/** Phase 21 style: stable, public company context with clear human and trust boundaries; no directory, messaging, or hiring workflow. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { canonicalUrl, siteConfig } from "@/app/seo";
import { PublicCompanyProfileView } from "@/components/company/public-company-profile";
import {
  getPublicCompanyProfile,
  publicCompanyProfilePath,
} from "@/lib/company/context";

type PublicCompanyPageProps = Readonly<{ params: Promise<{ slug: string }> }>;
const getCachedPublicCompanyProfile = cache(getPublicCompanyProfile);

export async function generateMetadata({
  params,
}: PublicCompanyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getCachedPublicCompanyProfile(slug);
  if (!profile) notFound();
  const pathname = publicCompanyProfilePath(profile.slug);
  const title = `${profile.name} — company context | Proofly`;
  const description =
    profile.shortDescription ||
    profile.whatWeBuild ||
    "A public company context record on Proofly.";
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
      type: "website",
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

export default async function PublicCompanyProfilePage({
  params,
}: PublicCompanyPageProps) {
  const { slug } = await params;
  const profile = await getCachedPublicCompanyProfile(slug);
  if (!profile) notFound();
  return (
    <PublicCompanyProfileView
      profile={profile}
      shareUrl={canonicalUrl(publicCompanyProfilePath(profile.slug))}
    />
  );
}
