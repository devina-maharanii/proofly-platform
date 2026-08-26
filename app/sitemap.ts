import type { MetadataRoute } from "next";

import {
  getPublicTalentProfileSitemap,
  publicTalentProfilePath,
} from "@/lib/profile/context";

import { publicRouteContract, canonicalUrl, siteConfig } from "./seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteConfig.publicUrl) {
    return [];
  }

  const staticRoutes = publicRouteContract
    .filter(route => route.indexable)
    .map(route => ({ url: canonicalUrl(route.pathname) }));
  const profiles = await getPublicTalentProfileSitemap();
  return [
    ...staticRoutes,
    ...profiles.map(profile => ({
      url: canonicalUrl(publicTalentProfilePath(profile.handle)),
      lastModified: profile.updatedAt || undefined,
    })),
  ];
}
