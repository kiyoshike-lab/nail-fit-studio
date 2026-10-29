import { pageMetadata } from "@/lib/seo";
import { AdSlot } from "@/components/AdSlot";
import { GuideExplorer } from "@/components/GuideExplorer";
import { guideArticles } from "@/content/guides";

export const metadata = pageMetadata("ネイルの選び方・デザインガイド", "ネイルの形・色・長さの選び方から、オフィスや季節に合うデザイン、サロン前の準備まで。自分の手で試着しながら選べる日本語ネイルガイドです。", "/guide");

export default function GuidePage(){return <main className="guide-page"><header className="guide-header"><div><p className="eyebrow">ネイルガイド</p><h1>選ぶ時間まで、<br />ネイルを楽しもう。</h1></div><p>ネイルの形、色、シーン、ケアまで。迷ったときに必要な情報を、過度に決めつけず分かりやすくまとめました。</p></header><GuideExplorer articles={guideArticles}/><AdSlot label="ガイドページ広告" /></main>}
