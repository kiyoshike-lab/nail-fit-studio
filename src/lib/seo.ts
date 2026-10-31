import type { Metadata } from "next";
import { SHARE_DESCRIPTION, SHARE_TITLE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";

// One home-page graph, not a second global WebSite declaration. Case changes
// and the hostname slug are search variants, not invented alternate brands.
export function buildWebsiteJsonLd(siteUrl = SITE_URL) {
  const home = new URL("/", siteUrl).href;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${home}#website`, name: SITE_NAME, url: home,
        description: SITE_DESCRIPTION, inLanguage: "ja", publisher: { "@id": `${home}#organization` } },
      { "@type": "Organization", "@id": `${home}#organization`, name: SITE_NAME, url: home,
        description: "ネイル選びの失敗を減らすためのバーチャル試着・診断・情報サービス" },
    ],
  };
}

export const socialImage = {
  url: "/og/nail-fit-studio-ja-20261029.png",
  width: 1200,
  height: 630,
  alt: "無料・アプリ不要。自分の手の写真やカメラで、ネイルの色・形・長さを試せるNail Fit Studio",
};

export const socialMetadata = {
  openGraph: {
    type: "website" as const,
    locale: "ja_JP",
    siteName: SITE_NAME,
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image" as const,
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [socialImage],
  },
};

// Open Graph is shallow-merged by Next.js: include the complete shared image /
// locale block when setting a route URL, otherwise it may inherit the HOME URL.
export function pageMetadata(title: string, description: string, path: string, index = true): Metadata {
  return {
    title: title.includes(SITE_NAME) ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { ...socialMetadata.openGraph, url: path },
    twitter: socialMetadata.twitter,
    ...(!index ? { robots: { index: false, follow: false } } : {}),
  };
}
