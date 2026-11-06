# 公開前QA 第1回：機能・データ保護

- 対象：`dc7517a`（実装：`613041d`）。QAブランチ：`codex/release-qa-three-pass`。
- 日時・各ジョブの開始/終了：`release-qa-20261106/round1/manifest.json` のUTC/JST記録を使用する。未コミットの追加はQA用スクリプトのみで、アプリ本体は開始時点から変更していない。
- 目的：機能が動き、保存/失敗/離脱時にデータを失わず、主要な統合フローで例外がないかを確認する。
- 条件：ローカルproduction build、desktop Chrome、レスポンシブ/CDP入力、自己ホスト実MediaPipe＋ローカル写真由来captureStream。物理カメラ・iPhone/Android実機ではない。

## 件数と結果

集計単位は「実行ジョブ」。36本のunit/integrationスクリプトと14本のブラウザ/HTTPスクリプトで**50実行・50成功・0失敗**。各スクリプト内の複数assertや画面幅を別々に足して件数を水増ししない。

追加の未実施領域は5件：物理カメラの連続動作、iPhone Safari、Android Chrome、実Formspree到達/Turnstile、実広告・GA配信。未実施は成功数に含めない。したがって予定55、実行50、未実施5。

|確認した領域|証拠|
|---|---|
|既存コンテンツ、広告除外ルール、認識/追尾/可視性/爪フィット/距離、SEO/Google設定、保存パーサー、接続拒否・GPU/CPU等の状態統合|`unit-01-*`〜`unit-36-*` ログ|
|13ページ×6画面条件、Before/After、診断完了/再訪、壊れたお気に入り、保存/削除失敗、画像エラー|`site-quality.json` / `.log`|
|5本個別制作、旧形式・未来形式、保存失敗、Canvasの再試行、実モデルPHOTO/疑似VIDEO、編集/収納中の同じストリーム維持|`workshop.json` / `paint.json`|
|38素材の実配置、選択/変形/ロック/コピー、19質感の実ピクセル、各パラメーター、PNGと再編集|`materials.json` / `styles.json`|
|短い320px画面で爪先/根元へ描画、1接触パン、2接触ピンチ、局所座標、DPR/回転、誤描画なし|`navigation.json`|
|未保存退避→離脱→復元→正式保存、quota、未来スキーマ、破棄確認|`recovery.json`|
|収納/展開、準備中フォーム、入力エラー、モックCAPTCHA/モック受付成功・失敗・制限、二重送信防止|`preview-contact.json`|
|連続画像選択/離脱時Object URL解放|`photo-race.json`|
|疑似動画の距離・XY・回転、喪失から復帰、自然な長さモード、capture/保存/解放|`distance.log`|
|曲げた指、開いた手のひら0本、甲へ戻して5本、PNG|`curled.json`|
|モバイル診断UI、再試行、権限拒否、秘密文字列を表示しない処理|`mobile-diagnostics.json`|
|主要HTML、OGP/JSON-LD、canonical/robots/sitemap、モデルgzip/identity/q=0、Search Consoleの完全一致|`seo.json` / `model-delivery.log`|

## 判断と第1回の修正

今回の機能試験で新規の再現可能なP0/P1不具合は見つからなかった。**アプリ本体の修正0件**。既知の重い消しゴム処理・メモリ増加・実機未確認は、第3回の性能/公開判断で再評価する。

第1回だけで公開可能とはしない。第2回は表示・操作・案内の別基準、第3回は最終コードを再buildしてfresh browserで回帰/性能/セキュリティを再確認する。

証拠の絶対ルート：`C:\Users\nlgid\.codex\visualizations\2026\05\16\019e3149-2c2f-7ce2-a154-da042e23465d\release-qa-20261106\round1`。これらは今回新しく実行したログで、前回レポートの結果を流用していない。

## 第2回中の追加発見（第1回のカバレッジ不足）

第1回の50ジョブが通ったことは、すべての壊れた設定が安全という意味ではなかった。追加の実ブラウザ試験で、現在のデザイン設定/爪位置がJSONの`null`だと試着画面が例外停止し、診断結果が`{}`等だと診断画面も停止することを確認した（P1、2画面）。不正URLのshape/patternの保存、壊れたJSONの自動上書きも確認した（P2）。

根本原因は、`JSON.parse()`後の型アサーションを実行時検証と見なしていたこと。読み取り時の検証、安全な初期値、読み取りだけでは書き戻さない処理、写真切替時の同じ検証を追加した。診断データも検証し、元データを保持したまま再診断できる。回帰用のunitスクリプトとブラウザ9ケースを追加した。

証拠：同じ証拠ルート直下の`settings-before-expanded/result.json`（実際の例外）、`settings-after/result.json`（9ケース正常、例外0、元データ保持）。第1回の結果を後から成功件数で書き換えず、第3回で新しい回帰テストを含めて再実行する。
