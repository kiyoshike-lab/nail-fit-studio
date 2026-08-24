import Image from "next/image";
import Link from "next/link";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export default function Home() {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: SITE_NAME, url: SITE_URL, description: SITE_DESCRIPTION, inLanguage: "ja" },
      { "@type": "Organization", name: SITE_NAME, url: SITE_URL, description: "ネイル選びの失敗を減らすためのバーチャル試着・診断・情報サービス" },
    ],
  };

  return (
    <main className="home-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />

      <section className="home-hero page-width">
        <div className="hero-copy">
          <p className="eyebrow">VIRTUAL NAIL TRY-ON · 2.0</p>
          <h1>自分の手で、<br />似合うネイルを試そう。</h1>
          <p className="lead">写真をアップロードして、気になるカラーやデザインをその場でチェック。サロンへ行く前に、自分に似合うネイルを見つけられます。</p>
          <div className="hero-actions">
            <Link href="/try-on" className="button primary">自分の手で試す</Link>
            <Link href="/diagnosis" className="button ghost">似合うネイルを診断</Link>
          </div>
          <p className="privacy-note">写真はブラウザ内で処理。サーバーには保存しません。</p>
        </div>
        <div className="hero-visual" aria-label="ネイルデザインのイメージ">
          <div className="hero-photo hero-photo-main"><Image src="/assets/preset-previews/design_005.jpg" alt="上品なネイルデザイン" fill sizes="(max-width: 720px) 76vw, 420px" priority /></div>
          <div className="hero-photo hero-photo-sub"><Image src="/assets/preset-previews/design_024.jpg" alt="華やかなネイルデザイン" fill sizes="180px" /></div>
          <span className="hero-sticker">試着は<br />無料</span>
        </div>
      </section>

      <section className="steps-section page-width" aria-labelledby="steps-title">
        <div className="section-heading"><p className="eyebrow">HOW IT WORKS</p><h2 id="steps-title">3ステップで、仕上がりをイメージ</h2></div>
        <ol className="steps-list">
          <li><span>01</span><div><strong>写真をアップロード</strong><p>明るい場所で、指を少し開いて撮影します。</p></div></li>
          <li><span>02</span><div><strong>デザインを選ぶ</strong><p>色・形・長さ・質感を好きに組み合わせます。</p></div></li>
          <li><span>03</span><div><strong>自分の手で確認</strong><p>Before/Afterで比べて、気に入ったら保存。</p></div></li>
        </ol>
      </section>

      <section className="popular-section page-width" aria-labelledby="popular-title">
        <div className="section-heading row"><div><p className="eyebrow">POPULAR DESIGNS</p><h2 id="popular-title">今、試したいネイル</h2></div><Link href="/try-on">すべて試す →</Link></div>
        <div className="design-showcase">
          {[
            ["design_001.jpg", "透明感ピンク", "オフィス"],
            ["design_016.jpg", "きらめきブルー", "季節"],
            ["design_030.jpg", "ニュアンス", "大人"],
            ["design_043.jpg", "アートデザイン", "華やか"],
          ].map(([file, name, tag]) => (
            <Link href="/try-on" className="design-tile" key={file}>
              <div><Image src={`/assets/preset-previews/${file}`} alt={`${name}のネイル見本`} fill sizes="(max-width: 720px) 46vw, 260px" /></div>
              <span>{tag}</span><strong>{name}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="diagnosis-banner page-width">
        <div><p className="eyebrow">1 MINUTE DIAGNOSIS</p><h2>迷ったら、似合う方向から見つけよう。</h2><p>服装・シーン・好きな色から、あなたに合いそうな形とカラーを提案します。</p><Link href="/diagnosis" className="button light">1分で診断する</Link></div>
        <div className="diagnosis-orb" aria-hidden><span>Oval</span><span>Pink Beige</span><span>French</span></div>
      </section>

      <section className="discover-grid page-width">
        <article><p className="eyebrow">BY SCENE</p><h2>シーンに合わせる</h2><div className="chip-links">{["オフィス", "デート", "結婚式", "成人式", "就活", "パーティー"].map((item) => <Link key={item} href={`/guide?scene=${encodeURIComponent(item)}`}>{item}</Link>)}</div></article>
        <article><p className="eyebrow">BY TONE</p><h2>肌なじみから選ぶ</h2><p>黄み・青みを断定せず、自分が心地よく感じる色から探せます。</p><div className="tone-swatches" aria-label="おすすめカラーファミリー"><span /><span /><span /><span /><span /></div><Link href="/guide/hand-beautiful-nail-colors">カラーの選び方 →</Link></article>
      </section>

      <section className="feature-section page-width">
        <div className="section-heading"><p className="eyebrow">WHY NAIL FIT STUDIO</p><h2>試して、比べて、あとで見返せる。</h2></div>
        <div className="feature-list">
          <article><span>01</span><h3>自分の手で試着</h3><p>写真やカメラにネイルを重ね、指ごとに位置まで調整できます。</p></article>
          <article><span>02</span><h3>似合う方向を診断</h3><p>好みと使う場面から、色・形・長さの組み合わせを提案します。</p></article>
          <article><span>03</span><h3>お気に入りと履歴</h3><p>気になった設定を端末に保存し、サロン前にもう一度確認できます。</p></article>
        </div>
      </section>

      <section className="guide-teaser page-width">
        <div className="section-heading row"><div><p className="eyebrow">NAIL GUIDE</p><h2>ネイル選びを、もっと分かりやすく。</h2></div><Link href="/guide">ガイドをすべて見る →</Link></div>
        <div className="article-teasers">
          <Link href="/guide/how-to-choose-nail-shape"><span>形</span><h3>自分に似合うネイルの形の選び方</h3><p>指の見え方と暮らしやすさ、両方から選ぶ方法。</p></Link>
          <Link href="/guide/short-nail-design"><span>基本</span><h3>短い爪でも似合うネイルデザイン</h3><p>余白と色の置き方で、すっきり見せるコツ。</p></Link>
          <Link href="/guide/office-nail"><span>シーン</span><h3>オフィスで使いやすいネイル</h3><p>清潔感を保ちながら、自分らしさも楽しむ。</p></Link>
        </div>
      </section>

      <section className="faq-section page-width">
        <div className="section-heading"><p className="eyebrow">FAQ</p><h2>よくある質問</h2></div>
        <details><summary>写真はどこかに送信されますか？</summary><p>現在の試着処理はブラウザ内で行い、手の写真をNail Fit Studioのサーバーへ保存しません。画像保存を選んだ場合も端末へダウンロードします。</p></details>
        <details><summary>試着結果と実際の仕上がりは同じですか？</summary><p>試着結果は色や形を検討するためのイメージです。照明、爪の状態、サロンで使う素材によって実際の色や質感は異なる場合があります。</p></details>
        <details><summary>スマートフォンでも使えますか？</summary><p>iPhone SafariとAndroid Chromeを中心に設計しています。カメラが使えない場合は、撮影済みの写真を選んで試せます。</p></details>
      </section>
    </main>
  );
}
