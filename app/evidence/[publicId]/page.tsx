import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PublicWorkEvidenceView } from "@/components/evidence/public-work-evidence";
import { getPublicWorkEvidence } from "@/lib/evidence/context";

const getCachedPublicWorkEvidence = cache(getPublicWorkEvidence);

type PublicEvidencePageProps = Readonly<{
  params: Promise<{ publicId: string }>;
}>;

export async function generateMetadata({
  params,
}: PublicEvidencePageProps): Promise<Metadata> {
  const { publicId } = await params;
  const evidence = await getCachedPublicWorkEvidence(publicId);
  if (!evidence) notFound();
  return {
    title: `${evidence.title} | Proofly work evidence`,
    description: evidence.shortSummary,
  };
}

export default async function PublicEvidencePage({
  params,
}: PublicEvidencePageProps) {
  const { publicId } = await params;
  const evidence = await getCachedPublicWorkEvidence(publicId);
  if (!evidence) notFound();
  return <PublicWorkEvidenceView evidence={evidence} />;
}
