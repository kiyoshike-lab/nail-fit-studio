"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function GuideAnalytics({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/guide/")) trackEvent("guide_read", { slug: pathname.slice("/guide/".length) });
  }, [pathname]);

  return <div onClickCapture={(event) => {
    const target = event.target as HTMLElement;
    const link = target.closest("a");
    if (link?.getAttribute("href")?.startsWith("/try-on")) trackEvent("guide_to_tryon");
  }}>{children}</div>;
}
