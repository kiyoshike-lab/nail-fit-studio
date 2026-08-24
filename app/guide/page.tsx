import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { GuideExplorer } from "@/components/GuideExplorer";
import { guideArticles } from "@/content/guides";

export const metadata: Metadata = { title: "ネイルガイド", description: "ネイル選び・形・色・シーン別の疑問を、試着につなげながら分かりやすく解説します。", alternates: { canonical: "/guide" } };

export default function GuidePage(){return <main className="guide-page"><header className="guide-header"><div><p className="eyebrow">NAIL GUIDE</p><h1>選ぶ時間まで、<br />ネイルを楽しもう。</h1></div><p>ネイルの形、色、シーン、ケアまで。迷ったときに必要な情報を、過度に決めつけず分かりやすくまとめました。</p></header><GuideExplorer articles={guideArticles}/><AdSlot label="ガイドページ広告" /></main>}
