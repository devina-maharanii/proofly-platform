/** Phase 22 public route: only a published direct Project/Challenge snapshot may resolve; unavailable or restricted records remain non-disclosing. */
import type { Metadata } from "next";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { canonicalUrl, siteConfig } from "@/app/seo";
import { PublicProjectView } from "@/components/project/public-project";
import {
  getPublicProject,
  getTalentSavedProjectIds,
} from "@/lib/project/context";
import { publicProjectPath } from "@/lib/project/types";
import { authorizeActiveContext } from "@/lib/roles/context";
import { projectApplicationPath } from "@/lib/application/types";

type PublicProjectPageProps = Readonly<{
  params: Promise<{ publicId: string }>;
}>;

const getCachedPublicProject = cache(getPublicProject);

export async function generateMetadata({
  params,
}: PublicProjectPageProps): Promise<Metadata> {
  const { publicId } = await params;
  const project = await getCachedPublicProject(publicId);
  if (!project) notFound();
  const pathname = publicProjectPath(project.publicId);
  const title = `${project.title} — project context | Proofly`;
  const description =
    project.oneSentenceGoal || "A published project context record on Proofly.";
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

export default async function PublicProjectPage({
  params,
}: PublicProjectPageProps) {
  const { publicId } = await params;
  const [project, talentAuthorization] = await Promise.all([
    getCachedPublicProject(publicId),
    authorizeActiveContext({ role: "talent" }),
  ]);
  if (!project) notFound();
  const savedProjectIds = talentAuthorization.ok
    ? await getTalentSavedProjectIds()
    : [];
  return (
    <PublicProjectView
      project={project}
      canSave={talentAuthorization.ok}
      saved={savedProjectIds.includes(project.publicId)}
      canApply={talentAuthorization.ok}
      applicationPath={projectApplicationPath(project.publicId) as Route}
    />
  );
}
