import { ADSENSE_ADS_TXT_LINE } from "@/lib/googleConfig";

export function GET() {
  const body = `${ADSENSE_ADS_TXT_LINE}\n`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
