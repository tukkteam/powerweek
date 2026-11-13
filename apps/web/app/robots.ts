import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/es", "/en"],
        disallow: ["/es/app", "/en/app", "/api/", "/auth/"],
      },
    ],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
