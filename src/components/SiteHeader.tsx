"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavigation } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-mark" aria-label="Nail Fit Studio ホーム">
          <span>Nail Fit Studio</span>
          <small>2.0</small>
        </Link>
        <nav className="desktop-nav" aria-label="メインナビゲーション">
          {primaryNavigation.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/try-on" className="header-cta">自分の手で試す</Link>
      </div>
    </header>
  );
}
