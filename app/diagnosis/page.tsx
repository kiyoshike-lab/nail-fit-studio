import type { Metadata } from "next";
import { DiagnosisQuiz } from "@/components/DiagnosisQuiz";

export const metadata: Metadata = { title: "似合うネイル診断", description: "8つの質問で、好みとシーンに合うネイルの形・色・長さを無料診断。", alternates: { canonical: "/diagnosis" } };
export default function DiagnosisPage(){return <main className="tool-page"><header className="tool-page-header"><p className="eyebrow">NAIL DIAGNOSIS</p><h1>1分で、似合う方向を見つける。</h1><p>肌色を写真から断定せず、あなたの好みと使う場面から提案します。</p></header><DiagnosisQuiz /></main>}
