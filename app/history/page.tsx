import { pageMetadata } from "@/lib/seo";
import { SavedLooks } from "@/components/SavedLooks";
import { SavedNavigation } from "@/components/SavedNavigation";
export const metadata = pageMetadata("試着履歴", "最近試したネイル設定を端末内で見返せます。", "/history", false);
export default function HistoryPage(){return <main className="tool-page"><header className="tool-page-header"><p className="eyebrow">試着履歴</p><h1>最近試したネイル</h1><p>画像を保存したときの試着設定を、最大20件まで表示します。手の写真そのものは保存しません。</p></header><SavedNavigation current="/history"/><SavedLooks kind="history" /></main>}
