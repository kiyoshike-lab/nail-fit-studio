import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
// Personal settings exist only on-device. Let crawlers READ their noindex meta;
// a Disallow would prevent reading it and can leave a URL-only search listing.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
