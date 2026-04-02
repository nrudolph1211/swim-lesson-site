import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hacswim.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  return [
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 1 },
  ];
}
