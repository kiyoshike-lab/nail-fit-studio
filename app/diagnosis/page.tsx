import { pageMetadata } from "@/lib/seo";
import { DiagnosisQuiz } from "@/components/DiagnosisQuiz";

export const metadata = pageMetadata("似合うネイル診断｜好み・シーンから無料で提案", "8つの質問で、好みや使う場面に合うネイルの色・形・長さを無料で提案。診断結果から自分の手でネイル試着もできます。", "/diagnosis");
export default function DiagnosisPage(){return <main className="tool-page"><header className="tool-page-header"><p className="eyebrow">似合うネイル診断</p><h1>1分で、似合う方向を見つける。</h1><p>肌色を写真から断定せず、あなたの好みと使う場面から提案します。</p></header><DiagnosisQuiz /></main>}
