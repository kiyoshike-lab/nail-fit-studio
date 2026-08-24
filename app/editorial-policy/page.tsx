import type { Metadata } from "next";

export const metadata: Metadata = { title: "編集方針", description: "Nail Fit Studioのガイド記事の制作・更新方針です。", alternates: { canonical: "/editorial-policy" } };

export default function EditorialPolicyPage() {
  return <main className="content-page"><header className="content-hero"><p className="eyebrow">EDITORIAL POLICY</p><h1>編集方針</h1><p>ネイル選びに役立つ情報を、分かりやすく、過度に断定せず届けます。</p></header><div className="prose"><h2>実用性を優先します</h2><p>流行だけを追うのではなく、形の特徴、生活での扱いやすさ、シーンとの相性など、読んだあとに選びやすくなる情報を中心に構成します。</p><h2>断定しすぎません</h2><p>「この肌色にはこの色だけ」といった決めつけを避けます。似合うという感覚には好み、服装、照明、文化、気分も関係するため、複数の選び方を示します。</p><h2>誤りは修正します</h2><p>内容に誤りや古い情報が見つかった場合は確認し、必要に応じて修正日を更新します。ご指摘はお問い合わせ窓口からお知らせください。</p><h2>医療判断は提供しません</h2><p>本サイトは美容・ファッション情報を提供するもので、病気の診断や治療の助言は行いません。爪や皮膚に痛み、腫れ、変色などの不安がある場合は、医療機関など適切な専門家へ相談してください。</p></div></main>;
}
