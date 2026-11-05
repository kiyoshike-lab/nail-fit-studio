import{pageMetadata}from"@/lib/seo";import{WorkshopStart}from"@/components/workshop/WorkshopStart";
export const metadata=pageMetadata("ネイルデザインを作る","5本の指を個別に編集。色・形・ラメ・ホログラム・立体風パーツを組み合わせ、写真やカメラで無料試着できます。","/create");
export default function CreatePage(){return <main className="tool-page workshop-page"><header className="tool-page-header"><p className="eyebrow">ネイル制作</p><h1>自分のネイルを作る</h1><p>指ごとに色・模様・装飾を組み合わせて、試着しよう。</p></header><WorkshopStart/></main>;}
