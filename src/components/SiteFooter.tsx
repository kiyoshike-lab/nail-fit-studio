import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Link href="/" aria-label={`${SITE_NAME} ホーム`}><strong>{SITE_NAME}</strong></Link>
        <p>サロンへ行く前に、自分の手で似合うネイルを確かめる。</p>
      </div>
      <nav aria-label="フッターナビゲーション">
        <Link href="/about">このサイトについて</Link>
        <Link href="/editorial-policy">編集方針</Link>
        <Link href="/privacy">プライバシー</Link>
        <Link href="/terms">利用規約</Link>
        <Link href="/contact">お問い合わせ</Link>
      </nav>
      <small>© {new Date().getFullYear()} {SITE_NAME}</small>
    </footer>
  );
}
