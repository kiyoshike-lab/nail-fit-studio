# 爪位置合わせ改善・検証記録（2026-10-25）

比較対象の既存コミット: `b15811c`。構成はNext.js / MediaPipe / Canvasのまま。
新しい学習済みモデルやアプリ用依存ライブラリは追加していない。

## 原因調査

| 確認項目 | 結果 |
| --- | --- |
| 指先→爪床の計算 | 指先・DIP・PIP・手の大きさから長さと幅を推定している。画像中の実際の爪境界は参照していなかった |
| 中心・根元・先端 | `NailPose.x/y`は根元。中心は根元＋爪先方向の高さの半分。描画とデバッグが同じ計算を使うよう共通化した |
| 親指・小指 | 専用の幾何係数は存在。今回、親指の画像探索は横方向を広げた。小指は細い爪を巨大化させず、画素が不足すれば推定を維持 |
| 左右反転 | 検出入力は反転しない。表示座標を使う画像探索時だけ画素のxを戻す。回帰試験で1px単位のサンプリングも修正 |
| object-fitとアスペクト比 | 既存のcontain変換を維持。映像・描画・ドラッグに同じ領域変換を使用。画像に非標準のEXIF回転がないことも評価セットで確認 |
| 手動補正 | 同じ補正の二重適用は確認していない。新しい画像補正の後、追尾を通してから手動補正を一度だけ適用する |
| 過去の保存補正 | 古い幾何推定へ合わせた補正が新しい画像合わせを相殺しないよう、保存キーをv2へ分離した。v1データは削除していない。新方式では必要に応じて再調整する |
| One Euro Filter | 移動中の遅れはあり得るが、静止中の爪境界の誤推定は解決しない。今回は平滑化設定を変えていない |
| 静止画と動画 | 写真はIMAGE用モデル、動画はVIDEO用モデルを維持。動画は元映像をCanvasへ一度固定し、ランドマークと画像補正が同じ未加工フレームを参照する |

添付スクリーンショットは仮想ネイルが既に重なった低解像度の切り抜きなので、実際の爪境界や保存補正値を確定できない。スクリーンショットだけから全指の修正量を断定していない。

## 実装

1. 指ごとに48×64の向きをそろえた探索領域を作り、色の連続性・境界・形状・位置・面積から爪候補を提案する。
2. 画像中で十分な境界があり、異なる色しきい値でも大きさと位置が一致する場合だけ、根元・中心・幅・長さへ反映する。低解像度・曖昧な境界・画素を読めない場合は元の推定を維持する。
3. 動画の画素探索は最大長辺640px。150ms以内の小さな移動では、前回の相対補正だけを指の向き・サイズに追従させる。大きな移動・回転・拡縮では読み直す。
4. 画像PCAによる角度変更も試したが、実画像の平均角度誤差が悪化したため採用していない。角度は既存の指先軸の推定を使用する。
5. 学習済み爪モデルは新規導入していない。手元の旧実装のONNX参照だけでは、今回利用する重み・ライセンス・スマホ速度・実写精度を確認できなかったため。

これは爪セグメンテーションAIではなく、画像に基づく限定的な補正。手を認識したことと、爪輪郭を正確に認識したことは区別する。

## 開発用デバッグ表示

`npm run dev -- --port 4190`で起動し、試着プレビュー左下の「爪位置デバッグ」を有効にする。

- ピンク: MediaPipeの指先ランドマーク
- 橙: 幾何推定による爪床・中心・根元・先端
- 水色: 採用できた画像補正と境界の画素。確信できない爪は水色を表示しない
- 緑: One Euro Filterを通した追尾位置
- 白: 手動補正後の位置。描画と同じ形・長さ・根元の計算を使う

デバッグの描画更新は約10Hzで、処理段階の位置を比較するためのもの。高速度の遅延測定器ではない。製品ビルドの画面には表示しない。

## 実画像評価

データは既存ローカルの[vpapenko/nails-segmentation-dataset](https://github.com/vpapenko/nails-segmentation-dataset)の画像・爪マスク28組。公開元のライセンスはCC0-1.0。
画像とマスク自体はpublic配下や今回のGit変更へコピーしていない。比較用の元画像は長辺最大640pxにそろえた。
現行の自己ホストMediaPipeをChromeのCPU delegateで実行し、IMAGE/VIDEOとも28/28枚で手を検出した。

VIDEO評価は各静止画像を3フレーム連続で入力したもの。実際に指を曲げる録画やライブの位置誤差測定とは異なる。
結果の詳細は `evaluations/nail-alignment-image.json` と `evaluations/nail-alignment-video.json`。

| 指標 | IMAGE: 補正前→後 | VIDEO入力: 補正前→後 |
| --- | --- | --- |
| 対応づけできた爪 | 137 | 135 |
| 画像補正を採用した爪 | 26/137 | 23/135 |
| 中心誤差平均（640px以下の画像上、px） | 14.01 → 12.45 | 14.10 → 12.80 |
| 中心誤差／正解爪幅 | 0.676 → 0.614 | 0.690 → 0.639 |
| 楕円近似IoU平均 | 0.239 → 0.310 | 0.243 → 0.311 |
| 角度誤差平均（度） | 9.32 → 9.32 | 9.48 → 9.48 |

比較方法: 同じMediaPipeランドマークを使い、幾何推定のみと画素補正後を比較。爪マスクの連結成分を幾何推定の中心に近い順で一意に対応づけ、対応は補正前に固定した。
中心は正解マスクの重心、角度は細長いマスクの主軸を用いた。IoUは爪床を楕円に近似したもので、レンダリングされた全デザインのIoUではない。
人物ごとの独立テストセットではなく、探索的な開発用評価。手動確認済みの指ラベルや根元の正解点はないため、対応づけの誤りも入り得る。

平均の改善だけで全爪が改善したとは判断しない。採用例でも、IMAGEは1爪、VIDEOは2爪でIoUが低下した。親指は両モードとも1爪しか画像補正を採用できておらず、引き続き課題。
不採用の爪は既存推定のままであり、完全密着・プロ品質・実機精度向上は主張しない。

## 再実行

通常の `npm test` は外部データ・Python・ブラウザを使わず、合成画素で根元・中心・幅・長さ・反転・曖昧時fallback・短期キャッシュ・Canvas失敗を検証する。
実画像評価は手元の既存データとPython/Pillowを使う任意のQA手順。Playwrightは別の一時フォルダへインストールし、アプリの依存関係は変更しない。

PowerShell例（Next.jsプロジェクト直下）:

```powershell
$qaDir = Join-Path $env:TEMP 'nail-fit-studio-qa'
npm install --prefix $qaDir --no-save --package-lock=false playwright
python scripts/prepare-alignment-evaluation.py --output "$qaDir/alignment-data.json"
# 別のターミナルで npm run dev -- --port 4190 を起動してから実行
node scripts/collect-alignment-landmarks.mjs --input "$qaDir/alignment-data.json" --output-prefix "$qaDir/current" --playwright-module "$qaDir/node_modules/playwright/index.mjs"
node scripts/evaluate-nail-alignment.mjs --input "$qaDir/current-image.json" --refine --output "$qaDir/image-report.json"
node scripts/evaluate-nail-alignment.mjs --input "$qaDir/current-video.json" --refine --output "$qaDir/video-report.json"
```

## ブラウザ確認と残る課題

Chromeで320px・390px・1280px幅の横はみ出しなし、実写真アップロード・デバッグ描画・PNG保存・模擬動画の認識・v2手動補正保存・認識喪失からの復帰・撮影を確認。未処理のJavaScript例外なし。
模擬動画は既存画像をCanvasで左右へ動かしてcaptureStreamへ渡したもの。iPhone Safari、Android Chrome、実USBカメラ、指が曲がる実録画、OS共有シートは未確認。
テスト中のみ広告・GAの外部通信を遮断した。AdSense、GA4、ads.txtのアプリコードは変更していない。

残る課題は、皮膚と爪の境界が弱い自然爪・反射・多色アート・遮蔽・横向きの親指。次は実際のクリーンなカメラフレームと手動の爪境界を対応づけて評価し、必要なら検証済みの爪専用セグメンテーションへ進む。
速度改善は今回の主張に含めない。低性能端末での画素補正の負荷とキャッシュの追従精度は別途実機評価する。

## 変更ファイル・最終チェック

| 役割 | ファイル |
| --- | --- |
| 位置合わせ | `src/lib/nailImageRefinement.ts`, `src/lib/nailFrameRefiner.ts`, `src/lib/handTracking.ts` |
| 描画との共通基準 | `src/lib/nailPoseMetrics.ts`, `src/lib/nailRenderer.ts` |
| 開発用表示 | `src/lib/nailAlignmentDebug.ts`, `src/components/NailAlignmentDebug.tsx`, `src/components/NailPreview.tsx` |
| 補正保存・接続 | `src/components/NailStudio.tsx` |
| 回帰試験 | `scripts/check-nail-alignment.mjs`, `scripts/check-hand-detection.mjs`, `scripts/check-nail-fit.mjs`, `scripts/check-tracking-runtime.mjs`, `package.json` |
| 実画像評価 | `scripts/prepare-alignment-evaluation.py`, `scripts/collect-alignment-landmarks.mjs`, `scripts/evaluate-nail-alignment.mjs`, この記録と評価JSON2件 |

`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`はいずれも成功。Next.jsの47ページ生成も成功した。
既存のカメラ、GPU→CPU fallback、MediaPipe自己ホスト、Before/After、保存・共有、下部メニューを維持し、広告・GA・ads.txtの回帰試験も成功した。
本番サーバーでも写真認識とPNG保存を確認。デバッグ用チェックボックス・Canvasは表示されず、AdSenseスクリプトは1件、metaとads.txtも所定の値だった。未処理例外はなかった。
