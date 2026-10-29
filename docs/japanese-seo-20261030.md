# 日本語SEO・検索表示・SNS共有（2026-10-30）

## 作業範囲と調査結果

既存のNext.js App Router / Metadata APIを維持。試着の推定・追尾・Canvas・手動補正・写真処理・保存処理には変更を加えていない。既存のAdSense、GA4、ads.txtと広告配置も維持。画面のCSSや主要レイアウトは変更せず、日本語テキストと見出しの単語単位の折り返しを調整した。

変更前には以下を確認した。

- `app/layout.tsx` に日本語description、`lang="ja"`、canonical、OGP/Twitter、AdSense metaが既にあった。トップのWebSite/Organization JSON-LDも存在。二重に追加する必要はなかった。
- 公開中のトップHTMLを2026-10-29に取得すると、タイトルは `Nail Fit Studio 2.0 | 自分の手でネイル試着`、説明文は下記の旧文面だった。公開HTML自体に旧設定が存在し、単に検索キャッシュだけの問題とは言えない。
- トップの英語eyebrow、ブランド先頭のタイトル、SNS画像がサービス説明のないネイル写真である点が、日本語で用途を即座に伝えるうえで改善対象だった。
- 子ページでcanonicalは指定されていても、ルートから継承する `og:url` がホームのままになり得た。Aboutはブランドを含むtitleに共通テンプレートが付いて、ブランドが重複する構成だった。
- ガイド記事30件には固有の日本語タイトル・description・Article/BreadcrumbList構造化データがあり、維持する方針とした。
- お気に入りと履歴には既にnoindexがあったが、robots.txtでもクロールを禁止していた。noindexを読ませる方針に統一する。
- favicon/Apple用アイコン/manifest用アイコンの指定・実体がなかった。専用の静的アイコンを追加した。

検索ツールの `site:` 検索だけでは、このサイトの実際のGoogle検索表示・インデックス状態を確定できなかった。Search Consoleは操作していない。

## トップの変更前後

### タイトル

前：**Nail Fit Studio 2.0 | 自分の手でネイル試着**

後：**無料ネイル試着｜写真・カメラで似合うネイルをお試し - Nail Fit Studio**

ご指定どおりの文字列。ホームでは `title.absolute` を使い、共通テンプレートによるブランドの二重付与を防いだ。バージョン番号は検索タイトル・共有情報・manifestから外し、ヘッダーの同じ小バッジは「無料」に変更。

### Meta description

前：自分の手の写真でネイルを試し、似合う色・形・デザインを見つけられる無料のバーチャルネイルサービス。

後：ネイルをする前に、自分の手で似合うデザインをチェック。Nail Fit Studioは、写真やカメラでネイルの色・形・長さを無料で試せるサイトです。アプリのインストール不要で、スマホから気軽にお試しできます。

`SITE_DESCRIPTION`、トップページ、ルートmetadata、WebSite JSON-LD、manifestは同じ定数を参照する。重複するdescriptionタグは出力しない。

## ページ別タイトルと共有

| ページ | 最終HTMLのtitle |
|---|---|
| `/` | 無料ネイル試着｜写真・カメラで似合うネイルをお試し - Nail Fit Studio |
| `/try-on` | ネイルシミュレーター｜写真・カメラで無料試着｜Nail Fit Studio |
| `/diagnosis` | 似合うネイル診断｜好み・シーンから無料で提案｜Nail Fit Studio |
| `/guide` | ネイルの選び方・デザインガイド｜Nail Fit Studio |
| `/about` | Nail Fit Studioとは｜無料ネイル試着サイト |

各ページの説明文も用途別に設定した。30ガイド記事は既存の固有タイトル・説明を維持する。個人用ページにも自己canonicalを設定し、ホームcanonicalの継承を避ける。

汎用ページの共有タイトル：

**無料でネイル試着！自分の手で似合うデザインを探そう｜Nail Fit Studio**

共有説明：

写真やカメラでネイルをお試し。色・形・長さを自由に変えて、自分に似合うデザインを見つけよう。無料・アプリ不要。

`src/lib/seo.ts` で共通化。Next.jsのOGオブジェクトは浅くマージされるため、ページごとのURLを設定するときにも画像・言語・サイト名などを含む完全な共通ブロックを展開する。ガイド記事では固有の記事タイトル・説明と `og:type=article` を優先し、共通の日本語画像を使用する。Twitter Cardは `summary_large_image`。

### 日本語OG画像・favicon

- 共有画像：`public/og/nail-fit-studio-ja-20261029.png`、1200×630、約84KB。
- 日本語で「無料・アプリ不要」「自分の手で、ネイルを試着。」「写真・カメラ」「色・形・長さ」を表示。
- 図はネイルカラーのイメージ。実際には存在しない機能や、実際の認識結果を装う画面は描いていない。写真・個人情報は使用していない。
- SVG原稿も保存。`scripts/generate-seo-assets.mjs` は保守者がローカルで再生成する任意ツール。VercelのbuildにPlaywright・日本語フォント・外部画像サービスは不要。既に生成したPNGをそのまま配信する。
- 48px PNG favicon、SVGアイコン、180px Appleアイコン、192/512px manifestアイコンを追加し、各URLの200応答を確認。

Instagramを含む各アプリの、すべての共有面でカードが表示されることは保証しない。LINE/X等のキャッシュも今回ローカルで更新したわけではない。

## 日本語表示・クロール・構造化データ

- トップ冒頭で無料、写真/カメラ、アプリ不要の3点を説明。従来のCTA、写真、レイアウトは維持。
- HOW IT WORKS、POPULAR DESIGNS、WHY NAIL FIT STUDIO、NAIL GUIDE、FAQなどは自然な日本語に変更。診断、関連ガイド、法務ページの補助ラベルも日本語化。サービス名・コード識別子・ライブラリ名は翻訳していない。
- WebSite JSON-LDは既存の1件を維持し、日本語descriptionを共通定数へ合わせた。架空の星、レビュー、利用者数、受賞歴、未実装SearchActionを追加していない。
- 公開対象のトップ・試着・診断・ガイド等はindexを妨げない。canonical/og:urlはそれぞれのパスを本番originへ解決し、試着パラメータ付きURLは `/try-on` を正規URLとする。
- `/favorites` と `/history` は既存noindex/nofollowを維持し、サイトマップから除外。robots.txtでのDisallowは外して、クローラーがnoindexを読めるようにした。これらの個人データは端末内にあり、noindexは認証やアクセス制限の代わりではない。
- sitemapは39件（固定9ページ＋30記事）、重複・個人用ページ・クエリ文字列なし。固定ページのSEO更新日は完成時の **2026-10-30**。ビルドのたびに更新日を捏造しない。内容が変わっていないガイド記事の公開・編集更新日と、法務文面の政策改定日は維持した。
- `.env.example` の `NEXT_PUBLIC_SITE_URL` は正式URL `https://nail-fit-studio.vercel.app` にした。実際のVercel環境変数に別のURL/仮URLが設定されていればそちらが優先されるため、公開時の確認が必要。

Googleはtitleだけでなく見出しやページ内容などを使ってタイトルリンクを決め、説明文も本文から選ぶ場合がある。今回の設定どおりの表示、検索順位、CTR上昇、再クロール時期は保証しない。

参考：[Googleのタイトルリンク説明](https://developers.google.com/search/docs/appearance/title-link?hl=ja)、[スニペットとdescription](https://developers.google.com/search/docs/appearance/snippet?hl=ja)、[robots.txtとnoindexの違い](https://developers.google.com/search/docs/crawling-indexing/robots/intro?hl=ja)、[サイトマップ](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=ja)。

## 検証結果

| 検証 | 結果 |
|---|---|
| `npm run lint` | 成功 |
| `npm run typecheck` | 成功 |
| `npm test` | 既存15スクリプト＋SEOスクリプトの16件が成功 |
| `npm run build` | 成功、Next.js 16.3.0、47ページ生成 |
| 本番HTML | 41ページでtitle/description各1件、ブランド重複なし、日本語を確認 |
| canonical/OG/Twitter | ページ別URL、日本語共有文、自己ホストPNGとaltを確認 |
| JSON-LD | WebSite / Organization / Article / BreadcrumbListをJSONとして解析し、主要な値・重複・架空評価がないことを検証 |
| sitemap/robots | XML構文、39URL、lastmod、個人ページ除外、noindexを読めるクロール設定を確認 |
| 404 | HTTP 404とNext.jsのnoindexを確認 |
| 日本語画像/アイコン | PNG寸法・HTTP 200・content-typeを確認、日本語OG画像を目視確認 |
| PC/スマホ幅 | 主要5ページ×320/390/1280pxの15条件で横はみ出し・h1欠けなし |
| トップ導線 | 390pxで3つの特徴が初画面に入り、CTAから試着画面へ移動可能 |
| 試着回帰 | 写真、手動調整、自動補正、Before/After、保存、サンプルのブラウザテストが成功 |
| 広告/分析 | AdSense/GA4 loader各1、ads.txtの既存値と広告配置テストを維持 |

試着回帰テストは今回のSEO変更の前後で同じ既存のテストを利用し、新たに追尾精度が上がったという評価ではない。物理カメラ・iPhone Safari・Android Chromeの実機テストは今回行っていない。Chromeの画面幅変更は実機確認の代用ではない。GoogleのRich Results TestやSearch Console、実際のLINE/X/Instagramの共有キャッシュ確認は未実施。

再実行：本番ビルドをローカル起動し、`node scripts/check-seo-browser.mjs --playwright-module <QA用Playwright/index.mjs> --base-url http://127.0.0.1:4193 --output <report.json>`。QAでは外部広告/解析通信を遮断しており、広告の実配信・GA4サーバー側の受信を試験したものではない。

詳細のメタデータ出力と画面幅チェックは `docs/evaluations/seo-production-20261030.json`。試着回帰結果は `docs/evaluations/seo-tryon-regression-20261030.json`。

## 変更ファイル

- 共通SEO：`src/lib/site.ts`、新規 `src/lib/seo.ts`、`app/layout.tsx`、`.env.example`。
- ページ：`app/page.tsx`、`app/try-on/page.tsx`、`app/diagnosis/page.tsx`、`app/guide/page.tsx`、`app/guide/[slug]/page.tsx`、`app/about/page.tsx`。
- 補助・個人用・法務：`app/contact/page.tsx`、`app/editorial-policy/page.tsx`、`app/favorites/page.tsx`、`app/history/page.tsx`、`app/privacy/page.tsx`、`app/terms/page.tsx`。
- メタファイル：`app/robots.ts`、`app/sitemap.ts`、`app/manifest.ts`。
- 表示ラベルのみ：`src/components/SiteHeader.tsx`、`src/components/PhotoUploader.tsx`、`src/components/DiagnosisQuiz.tsx`。
- 静的画像：`public/og/` のSVG/PNG、`public/icons/` のSVG/PNG。
- 検証と保守：`package.json`、新規 `scripts/check-seo.mjs`、`scripts/check-seo-browser.mjs`、`scripts/generate-seo-assets.mjs`、本報告と評価JSON。

## 公開後に必要なこと

今回はコミットのみで、push・Vercel公開・Search Console操作はしない。公開後は本番の `NEXT_PUBLIC_SITE_URL`、本番HTML、OG画像/アイコンの200応答を確認してから、Search ConsoleのURL検査でトップ・試着ページのインデックス登録をリクエストし、sitemap.xmlを送信/再確認する。Google反映後に日本語クエリの表示回数・CTRを比較する。

旧GitHub Pages/RenderのURLが別に検索結果へ残っている場合、その公開先は今回のローカル変更だけでは更新されない。必要な移転対応は別途確認する。旧版の削除やリダイレクト変更は行っていない。
