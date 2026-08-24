export const DEFAULT_GA_MEASUREMENT_ID = "G-CLEJWK7RF3";
export const DEFAULT_ADSENSE_PUBLISHER_ID = "ca-pub-6994120027205290";

export const GA_MEASUREMENT_ID = validGaMeasurementId(process.env.NEXT_PUBLIC_GA_ID)
  ? process.env.NEXT_PUBLIC_GA_ID!.trim()
  : DEFAULT_GA_MEASUREMENT_ID;

export const ADSENSE_PUBLISHER_ID = validAdsensePublisherId(process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID)
  ? process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID!.trim()
  : DEFAULT_ADSENSE_PUBLISHER_ID;

function validGaMeasurementId(value?: string) {
  return /^G-[A-Z0-9]+$/.test(value?.trim() ?? "");
}

function validAdsensePublisherId(value?: string) {
  return /^ca-pub-\d{16}$/.test(value?.trim() ?? "");
}
