import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["es", "en"].map((lang) => ({
    url: `${publicEnv.siteUrl}/${lang}`,
    changeFrequency: "weekly",
    priority: 1,
    alternates: { languages: { es: `${publicEnv.siteUrl}/es`, en: `${publicEnv.siteUrl}/en` } },
  }));
}
