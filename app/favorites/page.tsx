import type { Metadata } from "next";
import { SavedLooks } from "@/components/SavedLooks";
export const metadata:Metadata={title:"お気に入り",description:"保存したネイルデザインを端末内で見返せます。",robots:{index:false,follow:false}};
export default function FavoritesPage(){return <main className="tool-page"><header className="tool-page-header"><p className="eyebrow">FAVORITES</p><h1>お気に入り</h1><p>気になったネイル設定を、サロンへ行く前にもう一度確認。</p></header><SavedLooks kind="favorites" /></main>}
