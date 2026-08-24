import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Nail Fit Studioについて", description: "Nail Fit Studioの目的、できること、試着結果の考え方をご案内します。", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return <main className="content-page"><header className="content-hero"><p className="eyebrow">ABOUT</p><h1>ネイル選びの「思っていたのと違う」を減らしたい。</h1><p>Nail Fit Studioは、サロンへ行く前やネイルを買う前に、自分の手で色・形・デザインを確かめるための無料Webサービスです。</p></header><div className="prose"><h2>できること</h2><p>手の写真またはカメラ映像に仮想ネイルを重ね、デザイン、カラー、形、長さを変えて比較できます。迷ったときは診断から似合いそうな方向を見つけ、気になる設定をお気に入りや履歴として端末に保存できます。</p><h2>誰のためのサービスか</h2><p>初めてネイルサロンへ行く人、色や形で迷っている人、仕事や学校に合うデザインを探している人、サロンで希望を伝える前にイメージを整理したい人を想定しています。</p><h2>試着結果について</h2><p className="notice">画面上の試着は仕上がりを検討するためのイメージです。照明、端末の表示、爪の状態、使う素材、施術方法によって実際の色や形とは差が出ることがあります。</p><h2>まず試してみる</h2><p><Link href="/try-on">自分の手でネイルを試す</Link>か、<Link href="/diagnosis">1分のネイル診断</Link>から始められます。</p></div></main>;
}
