import type { MetadataRoute } from "next";
import { guideArticles } from "@/content/guides";
import { SITE_URL } from "@/lib/site";
export default function sitemap():MetadataRoute.Sitemap{const updated=new Date("2026-08-24");const pages=["","/try-on","/diagnosis","/guide","/about","/editorial-policy","/privacy","/terms","/contact"];return[...pages.map((path,index)=>({url:`${SITE_URL}${path}`,lastModified:updated,changeFrequency:(index===0?"weekly":"monthly") as "weekly"|"monthly",priority:index===0?1:(path==="/try-on"||path==="/guide") ? 0.9 : 0.6})),...guideArticles.map((article)=>({url:`${SITE_URL}/guide/${article.slug}`,lastModified:new Date(article.updatedAt),changeFrequency:"monthly" as const,priority:.75}))]}
