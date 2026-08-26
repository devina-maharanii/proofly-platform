import type { MetadataRoute } from "next";

import {
  getPublicTalentProfileSitemap,
  publicTalentProfilePath,
} from "@/lib/profile/context";
import {
  getPublicCompanyProfileSitemap,
  publicCompanyProfilePath,
} from "@/lib/company/context";

import { publicRouteContract, canonicalUrl, siteConfig } from "./seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteConfig.publicUrl) {
    return [];
  }

  const staticRoutes = publicRouteContract
    .filter(route => route.indexable)
    .map(route => ({ url: canonicalUrl(route.pathname) }));
  const [profiles, companies] = await Promise.all([
    getPublicTalentProfileSitemap(),
    getPublicCompanyProfileSitemap(),
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
  ];
}
