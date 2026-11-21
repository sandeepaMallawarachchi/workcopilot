import type { MetadataRoute } from "next";

const siteUrl = "https://workcopilotai.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/terms", "/data-deletion", "/support"].map((path) => ({
    url: `${siteUrl}${path}`,
  }));
}
