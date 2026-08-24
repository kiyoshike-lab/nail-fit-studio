"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavigation } from "@/lib/site";

const marks = ["⌂", "✦", "◇", "⌕", "♡"];

export function MobileSiteNavigation() {
  const pathname = usePathname();

  return (
    <nav className="mobile-site-nav" aria-label="スマホ用メインナビゲーション">
      {primaryNavigation.map((item, index) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>
            <span aria-hidden>{marks[index]}</span>
            <small>{item.label}</small>
          </Link>
        );
      })}
    </nav>
  );
}
