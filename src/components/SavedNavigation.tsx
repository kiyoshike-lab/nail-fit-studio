import Link from "next/link";

const destinations = [
  { href: "/collections", label: "自作デザイン" },
  { href: "/favorites", label: "お気に入り" },
  { href: "/history", label: "試着履歴" },
] as const;

export function SavedNavigation({ current }: { current: string }) {
  return <nav className="saved-navigation" aria-label="保存データの種類">
    {destinations.map(item => <Link key={item.href} href={item.href} aria-current={current === item.href ? "page" : undefined}>{item.label}</Link>)}
  </nav>;
}
