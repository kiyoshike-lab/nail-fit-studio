# Nail Fit Studio 最終候補・安全なPreview検証（2026-11-18）

## 結論

**Previewのみ公開・検証した。Production公開、Productionブランチへのpush、merge、promote、PR作成は一切行っていない。**

|区分|判定|
|---|---|
|コード品質|GO（許可された最小ガードと既存コードの検証範囲）|
|自動テスト|GO|
|Preview検証|CONDITIONAL GO：実写真のファイル選択・端末別実機カメラ追尾は未確認|
|Production公開準備|CONDITIONAL GO：下記の未確認事項・開発依存の監査結果の扱いを確認し、別途明示的な公開承認が必要|
|Production公開操作|未実施・未承認。ここで停止|

新しい最適化・UI再設計・質感変更は行っていない。既存の性能判定 **CONDITIONAL GO** を維持する。今回速度改善を実測したとは報告しない。確認範囲で新規P0/P1は検出していないが、未検証の実機条件まで無不具合とするものではない。

## リポジトリ・コミットと保護

- 元リポジトリ：`C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-next`。元のbranch `codex/nail-tail-latency`、HEAD `03a0bca133de7a05e5c4781954c801e33589f902` は維持。
- 検証と限定変更は独立したローカルcloneで実施。以下を E とする：`C:/Users/nlgid/.codex/visualizations/2026/05/16/019e3149-2c2f-7ce2-a154-da042e23465d/preview-preflight-20261117`。cloneは `E/candidate`。
- 描画候補：`03a0bca`。Preview実行コミット：**`91d01c68fba38bf45dacf1b7009c6a48f6f54336`**。
- Preview branch：`codex/preview-final-03a0bca-20261118`。
- GitHub接続先：`kiyoshike-lab/nail-fit-studio`。元リポジトリのremote、Vercel Git context、dashboard Repositoryリンクを照合した。
- Production branch：**`codex/nail-fit-studio-2`**。dashboardに「このbranchへのpushがProduction更新」と表示されることを読み取り確認。設定変更なし。
- Production稼働SHA：**`6875816544531bedbe9e21c7150723a9bdaf1e9b`**。deployment `dpl_EPQiYDSLxFpRoy9q92vdiWGgmpUd`。Preview公開前後にProduction aliasをAPIで再確認し、同一deployment・SHAを維持。
- Productionから描画候補までは3コミット（`cc39c24`、`29958a9`、`03a0bca`）。そこへ許可された2ガードcommitだけを追加してPreviewにpushした。
- 元の未コミット `next-env.d.ts`、`docs/render-final-20261115.md`、`docs/render-final-metrics-20261115.json` は保護コピーとSHA-256照合。破棄・上書き・stash・reset・rebaseなし。旧レポート2件をPreviewへ無断で混ぜていない。

## 許可された最小変更

|commit|ファイル|変更と影響範囲|
|---|---|---|
|`8312a9d`|`app/layout.tsx`|Vercel PreviewだけGA4とAdSense scriptを描画しない。meta・SEO・本番のscript・子ページ・ネイル描画を維持|
|`91d01c6`|`src/lib/contactConfiguration.ts`、`scripts/check-contact.mjs`|Vercel Previewの問い合わせをfail-closedにする。本番設定が継承されてもready=false。Productionと未指定localは従来の入力検証を維持。正しいprovider設定を持つPreviewのAPIが503となり、外部fetchしない回帰テストを追加|

最初のPreviewブランチ専用env登録は、Vercelが未pushのbranchを受け付けず400で拒否。再取得したenvメタデータで既存3件のID・targetが変わっていないことを確認した。先に危険なPreviewを作ることはせず、利用者の追加承認を受けて問い合わせガードを実装した。**成功したproject env変更は0件。Productionの値・targetは変更していない。**

System Environment Variablesへのアクセスはdashboardで有効を確認した。秘密値の表示・復号・env pullはしていない。Previewの保護は既存のVercel Authenticationを維持し、弱めていない。共有用bypassリンクも作成していない。

## 最終候補での再検証

|検査|結果|証跡（E内）|
|---|---|---|
|ESLint|PASS|`lint-final.log`|
|TypeScript|PASS|`typecheck-final.log`|
|npm test（38 scripts）|PASS|`test-final.log`|
|local Production-mode build|PASS|`build-production-final.log`|
|local Preview-mode build|PASS|`build-preview-final.log`|
|回帰ジョブ|56/56 PASS、失敗0、実機/外部配信など5領域は未実行|`regression-final-20261118/manifest.json`|
|217描画条件|変更channel 0|`pixels-final-20261118.json`|
|写真76組（実画像2枚×38）|変更channel 0|`photo-parity-final-20261118/result.json`|
|移動・拡縮240フレーム|変更channel 0|`motion-final-20261118.json`|
|local Preview隔離|31チェック、外部request 0、page error 0、HTTP不良resource 0、実画像で可視爪5本|`preview-mode-isolation.json`|
|local Production scripts|GA loader/config/AdSense各1、AdSense meta 1、日本語とcanonical維持|`production-mode-tags.json`|

件数にはテスト間の重複があり、合算した独立ケース数とは扱わない。56回帰には保存・再編集・消しゴム・Canvas復旧・写真連続選択・疑似カメラ・モデル配信・SEO・旧データ互換・素材品質等が含まれる。物理カメラ、iPhone、Android、実Formspree/Turnstile到達、実広告/GA配信は別領域である。

検証cloneでのnode_modules junctionはTurbopackのroot制限で初回buildが失敗したため、同じ依存の実体コピーに変更し正規 `npm run build` を成功させた。Windows checkoutの改行で文字列検査が失敗した点は、Gitの正規ソースとハッシュ付きassetの元バイトを区別して復元した。アプリのアルゴリズムを変更して通したものではない。追加の写真テストの待機条件も、写真モードの文言と保存effect完了を待つよう修正した。これらの失敗をPASSに読み替えず、修正後に最終候補で全検証を実行し直した。

## 実際のVercel Preview

- URL：**https://nail-fit-studio-iy97nexbx-kiyoshike-labs-projects.vercel.app/**
- deployment：`dpl_xXJ5WSu6jCaJKJxAjDJuuyLHnGsP`、READY。
- APIのtarget=nullは標準Previewの表現。Productionではなく、Git refとSHAも上記Preview候補と一致。
- push先はGitHubの **`refs/heads/codex/preview-final-03a0bca-20261118` のみ**。証跡 `preview-push.log`。Production ref、PR、alias、promote操作なし。
- 未認証HTTPはVercel認証への302。ログイン済みEdgeではアプリを表示できた。認証後のraw X-Robots-Tag headerは未確認であり、noindex headerを実測済みとはしない。canonicalは本番URLを維持。

### ログイン済みEdgeで確認したもの

トップ、制作、コレクション、試着、問い合わせ、ガイド一覧、ガイド記事を確認した。制作ではマウスで線を描き、パールを追加し、端末内保存→再読み込み→コレクション→再編集を実行。ペン・パールのレイヤーが復元された。`live-preview-editor.jpg` がその画面証跡である。

制作画面を320/375/390/430pxに変更してページの横はみ出し0を確認し、最後にviewport overrideを解除した。これは**desktop Edgeのレスポンシブ確認**であり、iPhone/Android実機ではない。

トップ・試着・ガイド/記事でGA4/AdSense scriptは0。AdSense所有権metaは維持。問い合わせは入力欄がfieldsetによって無効化され、送信buttonもdisabled、GA/広告/Turnstileのservice scriptは0だった。初期計測のinput.disabledだけの集計はfieldset継承を反映しないため不採用とし、live AXのdisabled状態と既存ソースで確認した。取得したconsole errorは0（全ネットワークの完全監査を意味しない）。

サンプル図でBefore/After切替・プレビュー展開・PNG保存を確認。browser toolのdownload eventはtimeoutしたが、操作後にDownloadsへ生成された **900×1100px・86,649 bytesのPNG** を時刻・PNG signature・hashと目視で確認した。描いた線とパールも含まれた。証跡 `preview-download-check.json`。このサンプルは図解の仮配置であり、実画像の爪認識/位置精度の成功例とは扱わない。自動補正では認識できない旨の手動調整ガイドが表示された。

個別写真のchooser.setFilesはEdge拡張のfile URL権限がなく失敗。権限を無断で広げず、別経路で回避もしていない。**公開Previewでの実写真アップロード・実画像認識とライブカメラは未確認。** local production/Preview buildでの実画像5本、疑似VIDEOの成功と明確に区別する。

実サーバーの問い合わせへのPOSTや実メール送信は行っていない。PreviewのUIは送信不可で、server guardの503/no-fetchはunitとlocal実HTTPで確認した。Productionの広告/GA/メール到達も今回実配信テストをしていない。

## セキュリティ・残るリスク

追跡対象テキスト330ファイルの限定的な秘密情報パターン検査は検出0。追跡envはexampleのみ、`.env*`と`.vercel`はignoreを確認。全履歴内容・高エントロピー秘密の完全検出や侵入試験ではない。本文/写真/秘密値を公開ログへ出す変更はない。

2026-11-18のnpm audit：**全依存はhigh 9 / moderate 6 / critical 0、すべてdev依存**。`--omit=dev`は全severity 0。昨日17日の監査結果から更新されたため、古い7件の結果で上書きせず新しい結果を採用した。15件は依存連鎖上の対象package数であり、15個の独立した根本脆弱性という意味ではない。

根本advisoryは主に [picomatch ReDoS](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) と [minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249)。lockfileと `npm ls picomatch` ではESLint系の依存連鎖。現時点でサイト利用者からこの開発ツールへ任意globを渡す経路は確認していないが、build/lintツールのDoSリスクは残る。vendor同梱コードまで含む無脆弱性の保証ではない。

`npm audit fix --force` のNext設定major downgrade等は安全性を確認できず、承認範囲外なので実行していない。lockfile/依存に変更なし。公開前に修正版・実際の到達性・CI入力の扱いを別途確認し、対応/残存リスクの受容を判断する。秘密情報スキャンが0件、runtime auditが0件であることだけで全セキュリティをGOと断定しない。

利用者による「実機7項目確認済み」の申告は保持する。ただし端末/OS/browser/対象URLやcommitの詳細は未記録。当該Preview上で各端末が検証済みと読み替えない。Codex自身はiPhone/Android実機を操作していない。

## 人間が当該Previewで確認する事項

|項目|iPhone Safari|Android Chrome|
|---|---|---|
|機種・OS・browser版・対象URL/commit記録|要記録|要記録|
|写真選択→実画像で5本表示、連続選択|未確認|未確認|
|カメラ許可/拒否、内外切替、停止/再起動|未確認|未確認|
|甲5本、移動/距離/回転、掌非表示・曲げた指、認識復帰|未確認|未確認|
|ラメ/ストーン/パール、手描き/Undo/Redo/パーツ|未確認|未確認|
|プレビュー収納、Before/After、Safe Area/スクロール/ピンチ|未確認|未確認|
|画像保存/共有、保存先への到達、再編集|未確認|未確認|
|10分以上の発熱/FPS/メモリ不足/復帰|未確認|未確認|

PreviewではGA/広告/問い合わせを意図的に停止している。メール到達や本番広告はこのPreviewで有効化して試すのではなく、別途許可された外部サービス確認手順で行う。

## 承認後のProduction手順（今回は実行禁止）

1. 当該Previewで実写真・端末別カメラ・保存の記録を揃え、依存監査結果の対応方針を決める。公開する正確なcode SHAについて利用者の明示的な承認を受ける。
2. 実行直前にProduction branch、alias、稼働SHA、envの対象範囲を再確認する。現在のrollback候補 `dpl_EPQiYDSLxFpRoy9q92vdiWGgmpUd` を記録し、以降に変更があれば停止して比較する。
3. 清潔な専用checkoutで承認SHAとProduction差分・祖先関係を再確認する。現在はfast-forward可能だが、将来も同じとは仮定しない。承認後にだけ確定したProduction branchへ反映する。このbranchへのpushは自動Productionデプロイを起こす。
4. Production envでのbuildを監視し、GA/広告の読み込みが各1回へ戻ること、フォームの従来設定、SEO/所有権ファイル/ads.txt、写真・保存を再確認する。PreviewからのpromoteはProduction envで再buildになるため、Previewの同一バイナリをそのまま本番へ出す操作だと誤認しない。[Vercel公式](https://vercel.com/docs/deployments/promoting-a-deployment)

### 問題発生時のrollback（今回は実行しない）

Vercel project OverviewのRollbackから、直前の正常なProduction deploymentと対象domainを確認して戻す。チームはHobbyであり、Instant Rollbackの候補は直前のProductionに制限される。次回公開までに別の公開があれば、上記IDが適格だと決めつけず再確認する。

rollbackは過去のbuildを戻すもので、最新envでの再buildではない。rollback後はProduction domainの自動割当が停止するため、通常運用への復帰も別途承認して管理する。Git reset/force pushや本番secretのコピーで代用しない。[Vercel公式手順](https://vercel.com/docs/instant-rollback)

## 保存した成果物

本書と `docs/preview-release-20261118.json` は別のレポート専用commitにする。このレポートcommitを追加pushして新しいPreviewを再デプロイすることはしない。**公開Previewのcode SHAは91d01c6のまま**。元リポジトリにはbranch refを読み込み、元の作業branchと保護ファイルを維持する。

詳細な非Git証跡は E 内にある。`live-preview-checks.json`、`verified-release-context.json`、`preview-push.log`、各QAログ/画素比較、監査JSON、スクリーンショットを参照。これらの全raw artifactがGitから他PCへ自動復元されるとは扱わない。秘密のenv値は本書/JSONへ収録していない。
