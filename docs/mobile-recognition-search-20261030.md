# スマホ手認識・検索公開チェック（2026-10-30）

## 1. スマホで手を認識しなかった原因

**ユーザーのiPhone実機での根本原因は未確定。復旧確認済みとは報告しない。** カメラ映像が出るためAの起動失敗ではない、というユーザーの観測を前提にした。

コードで確認した問題は次の3点。

- フレーム通知をFPS計測にしか使わず、推論を `currentTime` の変化だけで開始していた。新しいフレームが届いても時計が変化しない再現ケースでは、旧条件は推論を開始できない。
- 入力方式の名前がvideo/native Canvasでも、実際には常に縮小Canvasを渡していた。方式切替の比較・復旧が実際には行われていなかった。
- 初期化Promiseに時間制限がなかった。resolve/rejectしないケースで「準備中」が終了しない。

これらがiPhone本番の症状を引き起こしたとまでは断定できない。B初期化、Cフレーム、D推論/手0件、E幾何計算、F可視性、G描画を診断で分け、実機の結果を取得する必要がある。

## 2. 原因を裏付けるログ・テスト

`check-mobile-tracking.mjs` では時計を止めた動画に新しいフレーム通知を10回送り、推論継続と同一フレームの重複防止を確認。実際のトラッキングループ、幾何計算、可視性判定を通し、SDK出力だけをモックして5本表示候補を検証した。

元解像度Canvas、960、640、videoの実入力をそれぞれ確認。タイムアウト、遅れて成功したインスタンスの解放、GPU初期化失敗→CPU、GPU推論5連続エラー→CPU、両方失敗→手動再試行、認識0件での一度だけのCPU復旧、停止・再試行時のループ数と解放回数も検証した。

別途、実際のSDKとモデルで、GPU/CPU × 4入力方式 × 各3回のVIDEO推論を実ブラウザで実行し、**24回すべて21ランドマークを取得**。この比較は同じ実写画像をcaptureStreamへ流したChromeソフトウェアWebGL環境であり、iPhoneの測定ではない。

### 入力比較の計測値（参考）

| delegate | 起動時間 | video | native Canvas | Canvas 960 | Canvas 640 |
|---|---:|---:|---:|---:|---:|
| GPU（software WebGL） | 512.7ms | 755.1ms | 169.9ms | 164.9ms | 162.4ms |
| CPU | 405.0ms | 121.3ms | 41.3ms | 36.0ms | 32.8ms |

推論時間は各3回の平均。videoが常に最初の入力で、GPUの初回1922.6msを含むため、方式間の公平な速度比較ではない。温まった後のGPU videoは172.2/170.6msだった。スマホFPSや改善率へ換算しない。描画時間・描画FPS・推論間隔・JSヒープ量はアプリの診断スナップショットにも記録。Safariで取得できないメモリ量は「取得不可」とする。

## 3. 実際に修正した処理

| 処理 | 変更 |
|---|---|
| フレーム | requestVideoFrameCallback / presentedFramesを優先。未対応・通知停止時は再生フレームカウンタまたはcurrentTimeへフォールバック。通知直後の時計変化を二重消費しない |
| 入力 | 初期値は従来と同じ最大960 Canvas。未認識2.5秒で本当のvideo、5秒でnative Canvas、8秒で640 Canvas。縦横比は維持し、カメラstreamは再起動しない |
| 負荷 | 既存の50ms間隔と重い場合の66〜100ms/640制御を維持。新しいフレームのみ処理し、推論・描画を並列多重実行しない |
| 起動 | WASM解決とdelegate初期化に各15秒の上限。GPU失敗時はCPUへ1回。待機中エンジンは最大2個。遅延成功はclose、rejectキャッシュは破棄 |
| 実行時復旧 | GPU推論の5連続エラーでCPUへ一度だけ切替。スマホで最初の10秒以上/12回以上手0件でも一度だけCPUを試す。CPU失敗は認識だけ停止しカメラ維持 |
| 案内 | フレーム待ち3秒、手0件6秒で再試行・写真アップロード案内。手0件だけではtrackerを停止しない。動画がpauseされた場合も前面では案内し、再試行タップで同じstreamをplayして再開を試す |
| 診断 | A〜G、GPU/CPU、入力、件数、寸法、時間、FPS、メモリ（対応ブラウザのみ）、描画本数を取得。500msごとに診断パネルだけ更新 |

15秒タイマーは非同期の待機を制限するもので、メインスレッドを同期的に占有するWASM処理を途中で強制中断する機能ではない。WASM解決→GPU→CPUの順で各段階がタイムアウトする場合、合計約45秒＋同期処理時間がかかり得る。重い端末のWorker化は今回していない。

## 4. スマホ診断モードの使い方

新しいコードで `/try-on?diagnostics=1` を開く → カメラを起動 → 明るい場所で手の甲を5〜10秒映す →「診断結果をコピー」。コピー不可の場合はテキスト欄を表示し、長押し・選択コピーできる。

**まだpushも本番公開もしていないため、現在の公開サイトには今回の診断機能は未反映。** ローカルまたは承認後のデプロイで使う。

診断には、画像、座標配列、手の写真、カメラ名/deviceId、完全なUser-Agent、URL、認証情報を含めない。生のSDKエラーメッセージ/stackも出力せず、実際のエラー名と固定の段階・理由をコピーする。自動送信、GAへの送信、localStorage保存はしない。URL指定がない通常利用者には表示しない。通常へ戻す際はqueryを外して再読み込みする。

「描画呼出本数」はCanvas描画ルーチンを通った数であり、実際に見えるピクセル数や位置精度を保証しない。Before中は0になる。推論結果と描画は別タイミングなので、直前の描画と最新の検出件数が一時的に異なることがある。

## 5. PC版への影響

爪位置、親指、小指、根元ロック、長い自爪、画像境界補正、One Euro Filter、可視性、手動補正、座標変換は変更していない。初期入力も実際の旧経路と同じ縮小Canvas。PCに10秒未認識によるCPU切替は適用しないが、GPU初期化/推論エラー時のCPU復旧は適用する。

実モデルを使う写真→5本、疑似VIDEO→5本、距離変化、横移動、鏡像、カメラ切替と古いstream解放、認識喪失/再取得、撮影、PNG保存のブラウザ回帰テストを実行。手のひら非表示、横向き、曲げた爪、長い自爪、Before/Afterは既存の回帰テストも維持。

## 6. iPhone・Androidでの対応状況

コード対応・モック再現テスト・Chromeモバイル幅での確認まで。**iPhone Safari / Android Chromeの実機ライブ映像、熱、バッテリー、メモリ圧迫、バックグラウンド復帰は未検証。** Chromeの幅320/390/430をiPhone実機テストと呼ばない。

ブラウザ比較では最大辺960/640で縦横比を維持。GPU/CPU・全入力方式で認識できたが、入力順序が固定で初回ウォームアップも含むため、これをスマホの最適方式・FPSの証明には使わない。測定生データは評価JSON参照。

補足：全WebGLを無効にしてCPUを強制する実験は画像転送も壊すため、有効なCPU復旧テストにならなかった。その実験は合格の根拠に使わず、クリーンなブラウザでCPU delegateを明示した実推論で比較した。UIのGPU→CPU復旧はモックテストで検証している。

## 7. Google・Yahoo!検索に出ない問題の調査結果

作業開始時の環境：

| 項目 | 確認結果 |
|---|---|
| 作業repo | `new-chat/nail-fit-studio-next`（親repoとは別） |
| branch | `codex/nail-fit-studio-2` |
| local HEAD | `5df9ffed96d90a5a81ca2bf449b72a027de59b17` |
| push済みbranch | `2f6d86683b97201ee9271afa36ae776d2cc3ca8b` |
| GitHub最新Production成功記録 | `2f6d866`、2026-10-29 18:27:08 UTC |
| localとの差 | `5df9ffe`「show supported curled nail fragments safely」が1コミット未push。今回の修正はさらにその上 |
| origin/main | `f12feda`（別履歴）。切替/マージしない |
| installed | Next.js 16.3.0 / React 19.2.8 / tasks-vision 1.0.1 / Node 24.16.0 |

Production成功記録はGitHubの公開Deployments APIで確認。個別deployment URLは非認証で302→Vercelログインになった。本番aliasは非認証で200。**aliasとcommitの厳密な対応・Vercel内のProduction Branch/環境変数/Protection設定は非公開管理画面で未確認**。ステータス記録と実際のaliasは区別している。

本番 `https://nail-fit-studio.vercel.app/` に読み取り専用HTTP監査を実行：

- sitemap内39ページ（ガイド30記事を含む）すべて200。意図しないリダイレクト・noindex・X-Robots-Tagなし。
- robotsは `Allow: /`、正しいsitemap。sitemapはcanonical originと一致し、重複なし。favorites/historyは含まない。
- html lang=ja、指定の日本語title/description、各ページcanonical、OGP、JavaScript実行前の本文・内部リンク、JSON-LDが存在。ホームのWebSiteは@graph内にあり、正しく検証。
- favorites/historyは意図的なnoindexを維持。存在しないページは404/noindex。
- favicon・日本語OG画像・ads.txt・モデル・6つのWASM/JSは200。wasmのContent-Typeも正常。公開WASM/JSのSHA256はインストール済みSDKと6件すべて一致。
- GooglebotというUser-Agentを付けた通常リクエストも200。ただしGoogleの実クローラが到達した証拠ではない。
- aliasにサイト全体を塞ぐ認証画面は観測しなかった。ただし個別deploymentは認証保護されており、「Vercel ProtectionはすべてOFF」とは断定しない。

**明らかな技術的な登録阻害は見つからず、SEOタグは重複変更していない。** 検索で見つからないことだけで「未登録」とは断定できない。Search Consoleの権限にアクセスできないため、登録状況・Googleが選んだcanonical・最終クロール・手動対策は未確認。Yahooへの掲載・順位も未確認。まずGoogleの登録状態を確認する。登録・順位・即時反映は保証しない。

### 維持した検索文言

title：無料ネイル試着｜写真・カメラで似合うネイルをお試し - Nail Fit Studio

description：ネイルをする前に、自分の手で似合うデザインをチェック。Nail Fit Studioは、写真やカメラでネイルの色・形・長さを無料で試せるサイトです。アプリのインストール不要で、スマホから気軽にお試しできます。

## 8. Search Consoleで必要な手動操作

1. [Google Search Console](https://search.google.com/search-console/)で、サイト管理用Googleアカウントにログイン。左上のプロパティ一覧→「プロパティを追加」。
2. **URLプレフィックス**へ `https://nail-fit-studio.vercel.app/` を入力。既にある場合は同じプロパティを選ぶ。GitHub PagesやRenderの旧URLではない。
3. 所有権確認を行う。既存の確認方法が使えるなら維持。HTMLタグ方式を選ぶ場合はGoogleが発行した `google-site-verification` の値が必要。AdSenseのpublisher IDとは別物。値を捏造せず、発行された値を配置・公開してから「確認」。今回はトークン不明なので追加していない。
4. 上部のURL検査へトップURLを貼る。「Googleに登録されているか」「ページのインデックス登録」の理由、前回クロール、Googleが選んだcanonicalを確認。
5. 「公開URLをテスト」で取得可能か確認。取得失敗/noindex/別canonicalの場合はその詳細を先に解決。登録可能なら「インデックス登録をリクエスト」。
6. 左メニュー「サイトマップ」→ `sitemap.xml` を送信。最終的な送信URLが `https://nail-fit-studio.vercel.app/sitemap.xml` か確認。送信済みなら成功/取得失敗と最終読込日を確認。
7. URL検査で `https://nail-fit-studio.vercel.app/try-on` も同様に調べ、必要なら公開URLテスト→登録リクエスト。
8. 「ページのインデックス登録」で、登録済み/未登録の件数と理由を見る。クロール済み未登録・検出済み未登録・重複・noindex・サーバーエラーを区別。favorites/historyのnoindexは意図的なので解除しない。

登録済みなら「検索パフォーマンス」の表示回数/検索語で掲載と順位を分けて確認。サイトマップ送信・登録リクエストは掲載や順位向上の保証ではない。短期間に同じURLを何度も再リクエストしない。

公式資料：[URL検査](https://support.google.com/webmasters/answer/9012289?hl=ja)、[サイトマップ](https://support.google.com/webmasters/answer/7451001?hl=ja)、[検索の技術要件](https://developers.google.com/search/docs/essentials/technical?hl=ja)、[動画フレーム通知](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)。

## 9. 変更ファイル

- `src/lib/handTracking.ts` / `handDetectionInput.ts` / `trackingFallback.ts`：フレーム/入力/上限付き起動と復旧
- `src/lib/videoFrameGate.ts` / `trackingDiagnostics.ts`：フレーム消費と安全な診断値
- `src/components/NailStudio.tsx` / `NailPreview.tsx` / `TrackingDiagnosticsPanel.tsx`：案内・再試行・opt-in診断
- `src/lib/nailRenderer.ts`：既存描画を変えず、実際の描画ルーチン通過本数を報告
- `app/globals.css`：診断パネルに限定した小画面対応
- `scripts/check-mobile-tracking.mjs`：追加の自動回帰テスト
- `scripts/check-hand-detection.mjs` / `check-tracking-runtime.mjs`：本当の入力切替とCPU復旧の期待値
- `scripts/check-mobile-diagnostics-browser.mjs` / `check-mediapipe-inputs-browser.mjs`：任意実行の実ブラウザQA
- `scripts/audit-public-site.mjs`：読み取り専用の本番SEO/アセット監査
- `package.json`：新テストをnpm testへ追加（依存ライブラリ変更なし）
- 本レポートと `docs/evaluations/mobile-recognition-search-20261030.json`

日本語SEO・AdSense・GA4・ads.txt・記事・各ポリシーページは変更なし。作業前から存在した `next-env.d.ts` のローカル変更は保持し、コミット対象から除く。

## 10. テスト結果

lint / typecheck / npm test（20スクリプト）/ build成功。47静的ページの生成完了。既存のカメラ停止/devicechange、爪フィット、距離追尾、可視性、全消失防止、曲げた爪、Before/After、広告・GA・SEO回帰を含む。

本番buildを起動したChromeで診断の明示表示/通常非表示、コピー、320/390/430/1280幅、手0件→再試行、動画pause→同じstreamで再開、権限拒否も確認。SEOブラウザQAは41ルート・15レイアウト条件でエラー0。実ブラウザQAの詳細・計測値は評価JSONに記録。実写由来の写真と疑似動画、実際のCanvasを使い、実機カメラとは区別。

## 11. 残る課題

iPhone/Android実機の診断取得とHTTPS環境での最終確認が必要。実機の熱・遅延・復帰時間・精度改善は未測定。今回、爪境界/姿勢/可視性のしきい値を下げて5本を無理に出す修正はしていない。

ブラウザ制限や完全に壊れたWebGLをCPU fallbackが必ず回避できるわけではない。タイムアウト中の内部SDK処理をキャンセルするAPIはないため、遅れて返ったモデルは閉じ、待機数上限を超えた再試行は失敗案内へ進む。

Search Consoleの所有権とインデックス状態、Vercel aliasの正確なcommit対応は管理画面で要確認。コード修正だけで検索掲載は完成しない。

## 12. ローカル確認URL

`http://localhost:4210/try-on?diagnostics=1`（PCで `npm run dev -- --port 4210` などにより起動後）。通常画面はqueryを外す。

スマホ自身のlocalhostはPCを指さない。同一LANでもPCのHTTP IPアドレスは通常Secure Contextにならず、カメラが使えないことがある。実機確認には、承認後のHTTPSデプロイ、または端末側でも信頼できる開発用証明書が必要。Nextの開発用HTTPSコマンドは `npm run dev -- --hostname 0.0.0.0 --port 4210 --experimental-https`。自己署名証明書を生成するだけで全スマホが自動的に信頼するわけではない。証明書・秘密鍵は公開/コミットしない。

## 13. Gitコミット

`codex/nail-fit-studio-2` 上で本レポートを含めてコミット。IDは最終応答および `git log -1 --oneline` 参照。**push・Vercel本番公開は行わない。** 現在の本番サイトに今回の変更はまだ反映されない。
