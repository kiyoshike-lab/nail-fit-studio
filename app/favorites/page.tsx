import { pageMetadata } from "@/lib/seo";
import { SavedLooks } from "@/components/SavedLooks";
export const metadata = pageMetadata("お気に入り", "保存したネイルデザインを端末内で見返せます。", "/favorites", false);
export default function FavoritesPage(){return <main className="tool-page"><header className="tool-page-header"><p className="eyebrow">お気に入り</p><h1>お気に入り</h1><p>気になったネイル設定を、サロンへ行く前にもう一度確認。</p></header><SavedLooks kind="favorites" /></main>}
