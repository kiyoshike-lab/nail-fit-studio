# 似合うネイル診断と写真フィット — 開発・検証（2026-11-19 JST）

## 作業開始と保護

- リポジトリは `kiyoshike-lab/nail-fit-studio`。開始時の作業コピーは `C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux`、`codex/ux-ui-improvements` / `60011ce`、未コミット変更なし。そこから `codex/diagnosis-photo-fit` を作成。元のブランチの先端は変えていない。
- 別作業コピーの `codex/nail-tail-latency` / `03a0bca` と、既存未コミットの next-env.d.ts・レポート2件を保護。保護コピーとのSHA-256一致を再確認した。
- GitリモートとVercelを読み取り確認。Productionは `codex/nail-fit-studio-2` / `6875816`、既存Previewは `codex/preview-final-03a0bca-20261118` / `91d01c6`。両デプロイはREADY。push・PR・Preview／Productionデプロイなし。

## 診断

既存の8問を維持し、韓国風・シンプル・大人っぽい、成人式・推し活、形／色のおまかせを追加。好みの色系統は自己申告の肌なじみより優先し、仕事・学校などの制限時は同系色の淡色・短め・控えめな質感を提案する。結果に色見本、形・長さ、質感、柄、選んだ場面・華やかさの理由を示す。これらはルールベースの提案で、「似合う」ことを判定する学習モデルではない。

- `/diagnosis` の「この条件で試着する」から既存の `/try-on` へ。色・形・長さ・柄・質感・爪先色を許可リストで受け渡す。以前の試着素材や模様が結果に紛れないよう、診断経由のみ既定値を土台にする。
- 写真は任意。手の甲が十分に正面を向くときだけ、明るさが極端でない3領域から写真上の色傾向を推定。中指長／手首から付け根までの見かけの比、複数の根拠が明瞭な爪の縦横比も表示できる。縦横比の比較候補はオーバル／スクオバル。爪型の分類器や肌のパーソナルカラー判定ではなく、光やポーズで不確かなら保留する。
- 写真からの比較候補は端末内に一時表示し、通常の結果を変更しない。写真・比較結果は保存せず、試着画面では写真を選び直す。過去の診断結果は既存キーのまま読める。新しい質感等は任意の追加フィールドで、読み取りだけで移行や書き換えはしない。
- MediaPipe使用状況・処理性能の計測通信をChromeで観測。画像や映像は端末内処理だが、通信自体がないわけではない。新規の任意写真分析は利用前に説明し、了承後に選択できる。プライバシー頁にも追記した。[公式のMediaPipeプライバシー説明](https://github.com/google-ai-edge/mediapipe/blob/master/README.md#privacy-notice)。既存カメラのSDK初期化やGA4・広告設定は変更していない。公開前に既存試着も含む計測の同意方針は別途確認する。

## 写真フィット

カメラ経路の推論、信頼度、姿勢判定、時間平滑化、Canvas rendererは変更しない。写真のみ、既存のMediaPipe IMAGE＋指先／関節からの爪推定＋画像境界補正で根元・幅・長さ・角度を求める。各指のデザインを同じCanvas内の別座標へ拡縮・回転し、元写真からの照明推定と既存ジェルの透明感・光沢・影で合成する。新しい自由形状メッシュ、生成AI、外部有料APIは使用しない。

写真で「はみ出しが気になるとき」→「自爪の輪郭内に収める」をオンにすると、閉じた色境界だけを追加採用。既存の可視判定が許可した指に限り、複数しきい値の支持、爪の座標での幅・長さ・面積、中心の内包と点数制限を確認。背景を含む候補、弱い境界、小さすぎる爪は従来のフィットで描く。手のひらの非表示や既存の部分可視マスクを上書きしない。後からカメラを起動した場合、写真にだけ結び付く追加マスクを引き継がない。比較評価で被覆が減った例があるので、通常はオフ（診断経由でも自動でオンにしない）。切替は爪位置を再推定し、既存の手動調整と自爪長さ設定を利用できる。

「試すデザインを選ぶ」は写真を開いたまま利用できる。

|指定方法|動作|
|---|---|
|テンプレート|既存プリセットと同じ素材・適用処理。新規外部素材なし|
|保存済み|コレクション、お気に入り、試着履歴のデザインを現在の写真に適用。元の保存データや別写真の爪位置は適用しない|
|自作|制作中の下書きを選択、または試着内の5本エディターで作成／再編集|
|テキスト|160文字まで。色、透明感・ちゅるん、フレンチ、グラデ、ラメ、パール等の対応語を解釈。「黒フレンチにシルバーラメ」は黒の爪先＋明るいラメの近似。認識できないときは変更しない|

テンプレート・テキストで土台を変えても、装飾・手描きは既存仕様どおり維持。Before/After、PNG保存・共有、お気に入り・履歴、作品保存と再編集を再利用。PNGは既存の写真準備後の解像度で、入力が長辺2200pxを超える場合は既存処理で縮小する。写真そのものを作品に永続化しない。今後の参考画像入力は、検証済みのデザイン設定を返す別アダプターとして追加できるが、今回の実装には含めない。

## 効果と限界

既存の開発用実写真28枚をChromeのIMAGEモードで確認。表示対象120本（既存の部分表示29本を含む）に対し、追加の全体マスクは**通常可視91本のうち2本**（どちらも人差し指）。明瞭な輪郭の採用を優先しており、採用率や推定精度の汎化を示す値ではない。

|採用例|正解輪郭の外への描画画素（オフ→オン）|輪郭IoU（オフ→オン）|
|---|---:|---:|
|ルールが採用した画像 964c…、人差し指|78 → 25|0.837 → 0.878|
|ルールが採用した画像 bf93…、人差し指|11 → 0|0.872 → 0.814|

同一の位置推定・元ラベルを使用。640px長辺、ナチュラル形状・長さ1、Canvasのalpha≥128。基準の推定中心に最も近い手動ラベル成分を比較対象とした。2例目は外へのはみ出しを除いた一方、ラベル内の塗りも756→697画素へ減少した。採用例だけの比較で、全指・全体の精度改善や写実性の保証ではない。28枚は過去の開発にも使った集合で、独立評価ではない。親指・小指への改善は今回実証していない。

既存の自爪長さ変更・距離・回転のテストは再利用したが、長い／短い実爪を独立した条件に分けた網羅評価、iPhone Safari・Android Chrome実機、実際のカメラは未確認。輪郭が曖昧な写真では手動補正が必要。次の精度改善は、指別の正解輪郭がある未使用写真で、はみ出しと塗り残しの両方を評価することから始める。自由曲面ワープや学習モデルはその結果で判断する。

## 検証

|項目|結果|
|---|---|
|lint / typecheck / npm test / test:ux / build|全て成功。npm test は既存38＋新規1、buildはPreview安全設定でのローカル実行|
|診断→試着の新規ブラウザ試験|写真なしの8問・再読込、任意分析の明示選択、診断条件の反映、初期の輪郭チェックはオフ、実画像2枚で5本表示と輪郭あり／なし。320／375／390／430／1280pxで操作確認・横はみ出しなし|
|同じ写真へのデザイン指定|テンプレート・テキスト・下書き・コレクション・旧お気に入りを反映し、写真と既存保存行を維持。Before/After・607×1079 PNG・自作デザインの再編集を確認|
|既存のブラウザ回帰|サイト品質13ページ／78表示、手のひら・曲げ指、距離・長さ・追尾・解放、写真連続選択、保存・再編集とCanvas復旧。最終コードでも距離・疑似カメラを再実行|
|通常描画の画素比較|既存217条件、RGBA差分ゼロ。追加輪郭オンは意図的に画素が変わる（上表）|
|通信|新規試験でアプリの画像・テキスト送信POSTなし。先行試験でMediaPipeの使用状況・性能の計測先への試行を検出し、試験中は遮断。公開環境の動作は未検証|

画像・ログ・比較結果（開発用／公開素材ではない）：`C:/Users/nlgid/.codex/visualizations/2026/05/16/019e3149-2c2f-7ce2-a154-da042e23465d/diagnosis-photo-fit-20261119`。特に `C:/Users/nlgid/.codex/visualizations/2026/05/16/019e3149-2c2f-7ce2-a154-da042e23465d/diagnosis-photo-fit-20261119/targeted-mask-iou.json`、`C:/Users/nlgid/.codex/visualizations/2026/05/16/019e3149-2c2f-7ce2-a154-da042e23465d/diagnosis-photo-fit-20261119/scan.json` と `C:/Users/nlgid/.codex/visualizations/2026/05/16/019e3149-2c2f-7ce2-a154-da042e23465d/diagnosis-photo-fit-20261119/browser/result.json`。

## 変更ファイル

~~~text
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/app/globals.css
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/app/privacy/page.tsx
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/docs/diagnosis-photo-fit-20261119.md
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/package.json
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/scripts/check-diagnosis-photo-fit-browser.mjs
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/scripts/check-diagnosis-photo-fit.mjs
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/components/DiagnosisPhotoReview.tsx
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/components/DiagnosisQuiz.tsx
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/components/NailStudio.tsx
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/components/PhotoFitPanel.tsx
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/lib/designSuggestion.ts
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/lib/handPhotoObservations.ts
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/lib/handTracking.ts
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/lib/nailDiagnosis.ts
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/lib/photoContourFit.ts
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/lib/storage.ts
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/lib/studioSettings.ts
C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux/src/lib/types.ts
~~~

## ローカル確認

`C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux` で PowerShell を開き、次を実行。

```powershell
$env:VERCEL_ENV='preview'
npm run build
npm run start -- --hostname 127.0.0.1 --port 4334
```

[診断](http://127.0.0.1:4334/diagnosis)を完了し「この条件で試着する」→手の写真を選択。「試すデザインを選ぶ」でテンプレート／保存済み／テキストを比較し、必要に応じて輪郭内の表示・詳細調整を試す。写真から開始する場合は[写真試着](http://127.0.0.1:4334/try-on?photoFit=1)。ブラウザ内処理でもMediaPipeの性能計測は別途送信を試みる場合がある。スマホの平文LANではカメラのHTTPS要件に注意。クラウド公開は行わない。
