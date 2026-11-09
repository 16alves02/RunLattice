import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://runlattice-web-production.up.railway.app";
  return [{ url: baseUrl, changeFrequency: "weekly", priority: 1 }];
}