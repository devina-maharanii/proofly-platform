import type { MetadataRoute } from "next";

import { publicRouteContract, canonicalUrl, siteConfig } from "./seo";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteConfig.publicUrl) {
    return [];
  }

  return publicRouteContract
    .filter(route => route.indexable)
    .map(route => ({ url: canonicalUrl(route.pathname) }));
}
