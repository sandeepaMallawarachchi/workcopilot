import type { MetadataRoute } from "next";

const siteUrl = "https://workcopilotai.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/login",
        "/setup",
        "/activity",
        "/contacts",
        "/conversations",
        "/dashboard",
        "/integrations",
        "/settings",
        "/api",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
