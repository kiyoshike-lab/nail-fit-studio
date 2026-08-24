import type { Metadata } from "next";

export const metadata: Metadata = { title: "利用規約", description: "Nail Fit Studioのサービス利用条件です。", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return <main className="content-page"><header className="content-hero"><p className="eyebrow">TERMS</p><h1>利用規約</h1><p>最終更新日：2026年8月24日</p></header><div className="prose"><h2>サービスの目的</h2><p>Nail Fit Studioは、ネイルの色・形・デザインを検討するための参考情報と仮想試着機能を提供します。試着結果は実際の施術や商品の仕上がりを保証するものではありません。</p><h2>禁止事項</h2><p>法令に反する利用、第三者の権利を侵害する利用、サービスへ過度な負荷を与える行為、不正アクセス、表示素材の無断再配布などを禁止します。</p><h2>免責</h2><p>端末、照明、通信環境、ブラウザ、写真の状態などにより表示結果は変わります。本サービスの利用によって生じた損害について、法令で認められる範囲を超えた責任は負いません。重要な契約や施術内容は、サロンや販売者へ直接確認してください。</p><h2>知的財産</h2><p>本サイトの文章、UI、ロゴ、プログラム、許諾を受けて利用する画像などの権利は、それぞれの権利者に帰属します。</p><h2>サービスの変更</h2><p>品質向上、保守、安全確保などのため、予告なく機能を変更・停止する場合があります。重要な変更がある場合は、可能な範囲でサイト上にお知らせします。</p></div></main>;
}
