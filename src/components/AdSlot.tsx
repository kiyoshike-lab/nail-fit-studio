"use client";

import { useEffect } from "react";
import Script from "next/script";
import { ADSENSE_PUBLISHER_ID } from "@/lib/googleConfig";

type Props = { label?: string };

export function AdSlot({ label = "広告" }: Props) {
  const publisher = ADSENSE_PUBLISHER_ID;
  const slot = process.env.NEXT_PUBLIC_ADSENSE_GUIDE_SLOT;

  useEffect(() => {
    if (!publisher || !slot) return;
    try {
      const adsWindow = window as typeof window & { adsbygoogle?: unknown[] };
      (adsWindow.adsbygoogle ||= []).push({});
    } catch {
      // Ad blockers and approval-pending accounts must not break reading.
    }
  }, [publisher, slot]);

  if (!publisher || !slot) return null;

  return (
    <>
      <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`} crossOrigin="anonymous" />
      <aside className="ad-slot" aria-label={label}>
        <small>{label}</small>
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={publisher}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </aside>
    </>
  );
}
