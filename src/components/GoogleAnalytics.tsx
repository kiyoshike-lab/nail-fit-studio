import Script from "next/script";
import { GA_MEASUREMENT_ID } from "@/lib/googleConfig";

export function GoogleAnalytics() {
  return (
    <>
      <Script id="google-analytics-loader" src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{anonymize_ip:true});`}
      </Script>
    </>
  );
}
