import { pageMetadata } from "@/lib/seo";
import { SavedLooks } from "@/components/SavedLooks";
import { SavedNavigation } from "@/components/SavedNavigation";
export const metadata = pageMetadata("お気に入り", "保存したネイルデザインを端末内で見返せます。", "/favorites", false);
export default function FavoritesPage(){return <main className="tool-page"><header className="tool-page-header"><p className="eyebrow">お気に入り</p><h1>お気に入り</h1><p>気になった試着設定を見返せます。制作画面で保存した作品は「自作デザイン」から再編集できます。</p></header><SavedNavigation current="/favorites"/><SavedLooks kind="favorites" /></main>}
