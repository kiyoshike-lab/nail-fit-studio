import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
export default function manifest(): MetadataRoute.Manifest {
  return { name: SITE_NAME, short_name: "Nail Fit", description: SITE_DESCRIPTION, start_url: "/", display: "standalone", background_color: "#fcfaf8", theme_color: "#6f3442", lang: "ja",
    icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }] };
}
