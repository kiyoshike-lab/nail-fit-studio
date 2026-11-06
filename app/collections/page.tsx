import{pageMetadata}from"@/lib/seo";import{WorkshopCollection}from"@/components/workshop/WorkshopCollection";
import{LocalDataControls}from"@/components/LocalDataControls";
export const metadata=pageMetadata("マイネイルコレクション","端末内に保存した自作デザインを再編集・再試着できます。","/collections",false);
export default function CollectionsPage(){return <main className="tool-page workshop-page"><header className="tool-page-header"><p className="eyebrow">端末内の保存</p><h1>マイネイルコレクション</h1></header><WorkshopCollection/><LocalDataControls/></main>;}
