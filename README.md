# Nail Fit Studio 2.0

自分の手の写真でネイルを試し、診断・お気に入り・履歴・ガイド記事から似合うデザインを探せる、スマートフォン優先のNext.jsアプリです。

## ローカル起動

```bash
npm install
npm run dev
```

同じWi-Fiのスマートフォンから確認する場合：

```bash
npm run dev -- --hostname 0.0.0.0
```

ローカルIPへのアクセスはSecure Contextではないため、スマートフォンのカメラAPIが拒否される場合があります。写真アップロードは利用でき、カメラの最終確認はVercelのHTTPS URLで行います。

## 品質チェック

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

`npm test` はガイド記事数・slug重複・必須項目、試着・診断・保存ページへの広告誤配置、複数カメラ対応、MediaPipe失敗時にカメラを維持する処理を確認します。

## カメラ

初回はスマートフォンで外カメラを優先します。カメラ権限を許可したあと、利用可能なカメラが2台以上ある場合だけ「使用するカメラ」を表示します。PCではUSB Webカメラを選択でき、接続・取り外し時に一覧を自動更新します。

選択したカメラは端末内のlocalStorageへ保存します。次回アクセス時に見つからなければ標準カメラへ戻ります。実機カメラの最終確認は、Secure ContextとなるVercelのHTTPS URLで行ってください。

`devicechange`は500ms待ってカメラ一覧を更新する用途に限定し、動作中trackの停止判断には使いません。カメラ起動中と起動成功後2秒間を保護し、物理切断はMediaStreamTrackの`ended`イベントで判定します。

MediaPipeはGPU初期化に失敗するとCPUへ自動的に切り替わります。両方で自動認識を開始できない場合もカメラ映像、手動調整、撮影、保存は維持され、「自動認識を再試行」からカメラを止めずに再初期化できます。

MediaPipe 1.0.1のWASMとHandLandmarkerモデルは`public/mediapipe`から同一オリジン配信します。実行時に外部CDNのバージョン不一致やCORSへ依存しません。動画検出は20fpsに制限し、検出できない場合はstreamを止めずにvideo直接入力からCanvas入力（元解像度→960px→640px）へ段階的に切り替えます。

## Vercel Deployment

GitHubの `kiyoshike-lab/nail-fit-studio` をVercelへImportします。

- Framework Preset: Next.js
- Root Directory: 空欄（リポジトリ直下）
- Install Command: `npm install`（既定値で可）
- Build Command: `npm run build`（既定値で可）
- Output Directory: 入力しない
- Node.js: Vercel既定の対応バージョン

このリポジトリを別の親リポジトリの `nail-fit-studio-next` 内へ置いた場合だけ、Root Directoryを `nail-fit-studio-next` にします。

## Environment Variables

`.env.example` を参照し、VercelのSettings → Environment Variablesへ設定します。

- `NEXT_PUBLIC_SITE_URL`: 本番Vercel URL。canonical、robots、sitemapに使用
- `NEXT_PUBLIC_GA_ID`: GA4 Measurement ID
- `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID`: `ca-pub-...` 形式。未設定なら広告もAdSense metaも出さない
- `NEXT_PUBLIC_ADSENSE_GUIDE_SLOT`: ガイド用広告slot。未設定なら広告を出さない

環境変数を変更したら再デプロイしてください。

## Google Analytics

画像、ファイル名、個人情報は送信しません。実装イベント：

- `tryon_started`
- `photo_uploaded`
- `nail_design_selected`
- `tryon_saved`
- `tryon_shared`
- `diagnosis_started`
- `diagnosis_completed`
- `favorite_added`
- `guide_read`
- `guide_to_tryon`

## AdSense

広告コンポーネントは `src/components/AdSlot.tsx` に一元化しています。

広告を表示できる場所：

- `/guide`
- `/guide/[slug]`

広告を表示しない場所：

- `/try-on`
- `/diagnosis`
- `/favorites`
- `/history`
- 404、写真アップロード、保存操作

`/ads.txt` はPublisher IDが設定された場合だけ正規のAdSense行を返します。承認前や未設定時にダミーIDは出しません。

## Search Console

Vercel公開後に本番URLのプロパティを確認し、`/sitemap.xml` を送信します。その後 `/`、`/guide`、主要記事をURL検査してください。`NEXT_PUBLIC_SITE_URL` が本番URLと一致していることも確認します。

## ガイド記事の追加

`src/content/guides.ts` の `guideArticles` に記事データを追加します。slug、title、description、category、focus、tips、bestFor、caution、examples、試着条件、公開日・更新日が必要です。追加後は `npm test` と `npm run build` を実行します。

## localStorage

既存キーは変更していません。

- `nail-fit-studio-next.design.v1`
- `nail-fit-studio-next.nails.v1`

2.0で追加したキー：

- `nail-fit-studio-next.favorites.v1`
- `nail-fit-studio-next.history.v1`
- `nail-fit-studio-next.diagnosis.v1`
- `nail-fit-studio-next.camera-device.v1`

お気に入りは最大50件、履歴は最大20件です。画像そのものは保存せず、デザインと爪位置の設定だけを保存します。

## アップロード画像の扱い

JPEG、PNG、WebP、10MB以下に対応します。大きな画像はブラウザ内で長辺2200pxまで縮小し、手・爪認識とCanvas合成も端末内で処理します。Nail Fit Studioのサーバーへ元画像を送信・保存しません。

## Render旧版について

Vercel本番URLでiPhone Safari / Android Chromeの実機確認が終わるまでは、旧Renderサービスと旧HTML版を削除しません。確認後にRenderを停止できます。Renderを削除すると旧URLからのredirectも動かせなくなるため、移行案内期間を設けてください。
