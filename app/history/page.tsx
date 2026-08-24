import type { Metadata } from "next";
import { SavedLooks } from "@/components/SavedLooks";
export const metadata:Metadata={title:"試着履歴",description:"最近試したネイル設定を端末内で見返せます。",robots:{index:false,follow:false}};
export default function HistoryPage(){return <main className="tool-page"><header className="tool-page-header"><p className="eyebrow">TRY-ON HISTORY</p><h1>最近試したネイル</h1><p>保存した試着設定を最大20件まで表示します。</p></header><SavedLooks kind="history" /></main>}
