import type { MetadataRoute } from "next";

import { siteConfig } from "./seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/sign-in", "/get-started"],
      },
    ],
    sitemap: siteConfig.publicUrl
      ? `${siteConfig.publicUrl}/sitemap.xml`
      : undefined,
  };
}
