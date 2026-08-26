import type { MetadataRoute } from "next";

import {
  getPublicTalentProfileSitemap,
  publicTalentProfilePath,
} from "@/lib/profile/context";
import {
  getPublicCompanyProfileSitemap,
  publicCompanyProfilePath,
} from "@/lib/company/context";
import { getPublicProjectSitemap } from "@/lib/project/context";
import { publicProjectPath } from "@/lib/project/types";

import { publicRouteContract, canonicalUrl, siteConfig } from "./seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteConfig.publicUrl) {
    return [];
  }

  const staticRoutes = publicRouteContract
    .filter(route => route.indexable)
    .map(route => ({ url: canonicalUrl(route.pathname) }));
  const [profiles, companies, projects] = await Promise.all([
    getPublicTalentProfileSitemap(),
    getPublicCompanyProfileSitemap(),
    getPublicProjectSitemap(),
  ]);
  return [
    ...staticRoutes,
    ...profiles.map(profile => ({
      url: canonicalUrl(publicTalentProfilePath(profile.handle)),
      lastModified: profile.updatedAt || undefined,
    })),
    ...companies.map(company => ({
      url: canonicalUrl(publicCompanyProfilePath(company.slug)),
      lastModified: company.updatedAt || undefined,
    })),
    ...projects.map(project => ({
      url: canonicalUrl(publicProjectPath(project.publicId)),
      lastModified: project.updatedAt || undefined,
    })),
  ];
}
