import type { MetadataRoute } from "next";

import { siteConfig } from "./seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/auth/",
          "/sign-in",
          "/sign-up",
          "/verify-email",
          "/forgot-password",
          "/reset-password",
          "/get-started",
        ],
      },
    ],
    sitemap: siteConfig.publicUrl
      ? `${siteConfig.publicUrl}/sitemap.xml`
      : undefined,
  };
}
