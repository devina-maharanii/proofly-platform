/** Phase 23 public index: server-rendered deterministic discovery with URL-backed filters; private, paused, closed, and expired projects never enter its result reader. */
import type { Metadata } from "next";

import { canonicalUrl, siteConfig } from "@/app/seo";
import { ProjectDiscovery } from "@/components/project/project-discovery";
import {
  getPublicProjectDiscovery,
  getTalentRecentProjectSearches,
  getTalentSavedProjectIds,
} from "@/lib/project/context";
import { parseProjectDiscoverySearchParams } from "@/lib/project/discovery";
import { authorizeActiveContext } from "@/lib/roles/context";

type ProjectsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export async function generateMetadata({
  searchParams,
}: ProjectsPageProps): Promise<Metadata> {
  const filters = parseProjectDiscoverySearchParams(await searchParams);
  const hasQuerySpecificState =
    filters.query !== "" ||
    filters.skill !== "" ||
    filters.skillFamily !== "" ||
    filters.skillLevelContext !== "" ||
    filters.projectType !== "" ||
    filters.timebox !== "" ||
    filters.compensation !== "" ||
    filters.workMode !== "any" ||
    filters.timezone !== "" ||
    filters.deadline !== "any" ||
    filters.companySize !== "" ||
    filters.sort !== "relevance" ||
    filters.savedOnly ||
    filters.cursor !== "";
  const title = "Explore published project context | Proofly";
  const description =
    "Search transparent published software project context by governed skills, timebox, compensation label, and stated company context.";
  return {
    title,
    description,
    alternates: { canonical: "/projects" },
    robots:
      siteConfig.publicUrl && !hasQuerySpecificState
        ? { index: true, follow: true }
        : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: canonicalUrl("/projects"),
      type: "website",
    },
  };
}

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const filters = parseProjectDiscoverySearchParams(await searchParams);
  const talentAuthorization = await authorizeActiveContext({ role: "talent" });
  const canSave = talentAuthorization.ok;
  const [discovery, savedProjectIds, recentSearches] = await Promise.all([
    getPublicProjectDiscovery(filters),
    canSave ? getTalentSavedProjectIds() : Promise.resolve([]),
    canSave ? getTalentRecentProjectSearches() : Promise.resolve([]),
  ]);
  return (
    <ProjectDiscovery
      filters={filters}
      {...discovery}
      savedProjectIds={savedProjectIds}
      recentSearches={recentSearches}
      canSave={canSave}
    />
  );
}
