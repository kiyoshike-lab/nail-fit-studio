import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { MobileSiteNavigation } from "@/components/MobileSiteNavigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} 2.0 | 自分の手でネイル試着`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: SITE_NAME,
    title: `${SITE_NAME} 2.0 | 自分の手でネイル試着`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: ["/assets/preset-previews/design_005.jpg"],
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} 2.0`, description: SITE_DESCRIPTION, images: ["/assets/preset-previews/design_005.jpg"] },
  other: process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID
    ? { "google-adsense-account": process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID }
    : undefined,
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
      </body>
    </html>
  );
}
