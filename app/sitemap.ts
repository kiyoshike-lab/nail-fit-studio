import type { MetadataRoute } from "next";
import { guideArticles } from "@/content/guides";
import { SEO_UPDATED_AT, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/try-on", "/diagnosis", "/guide", "/about", "/editorial-policy", "/privacy", "/terms", "/contact"];
  return [
    ...pages.map((path, index) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(SEO_UPDATED_AT),
      changeFrequency: (index === 0 ? "weekly" : "monthly") as "weekly" | "monthly",
      priority: index === 0 ? 1 : path === "/try-on" || path === "/guide" ? 0.9 : 0.6,
    })),
    ...guideArticles.map((article) => ({
      url: `${SITE_URL}/guide/${article.slug}`,
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];
}
