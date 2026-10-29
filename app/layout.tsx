import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { MobileSiteNavigation } from "@/components/MobileSiteNavigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { HOME_TITLE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { socialMetadata } from "@/lib/seo";
import { ADSENSE_PUBLISHER_ID } from "@/lib/googleConfig";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: `%s｜${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  ...socialMetadata,
  openGraph: { ...socialMetadata.openGraph, url: "/" },
  icons: {
    icon: [{ url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" }, { url: "/icons/nail-fit-studio.svg", sizes: "any", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: { "google-adsense-account": ADSENSE_PUBLISHER_ID },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <MobileSiteNavigation />
        <GoogleAnalytics />
        <Script
          id="google-adsense"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
