import Link from "next/link";

export default function NotFound() {
  return <main className="tool-page"><div className="empty-panel"><span aria-hidden>⌕</span><h1>ページが見つかりません</h1><p>URLが変わったか、ページが削除された可能性があります。</p><div className="hero-actions"><Link className="button primary" href="/">ホームへ</Link><Link className="button ghost" href="/try-on">ネイルを試す</Link><Link className="button ghost" href="/guide">ガイドを見る</Link></div></div></main>;
}
