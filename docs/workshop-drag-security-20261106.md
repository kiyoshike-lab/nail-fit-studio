# 大型アップデート第2弾：ドラッグ配置・保存品質・セキュリティ（2026-11-06）

## 1. 結論・今回の区切り

**第2弾全体の完成ではない。最優先のPhase 1〜2と、先に対処すべき依存脆弱性・保存/入力の安全性を実装した段階。**
38素材をマウス/タッチで配置し、変形・レイヤー操作・保存・再読込・写真/動画試着へ接続する。既存の追尾モデル/推論頻度/姿勢判定を変更して精度や速度を犠牲にする方法は採用しない。
未完成の再訪機能や実機検証を「完成」としない。空の比較/レシピ/特集ボタンも追加しない。
GitHubへのpush、PR、Vercel Preview/Productionへの公開、契約、環境変数変更は実施しない。

## 2. 開始時のGit・本番との差分

- 作業ディレクトリ：`C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-next`
- remote：`kiyoshike-lab/nail-fit-studio`。開始ブランチ `codex/design-workshop`、HEAD `63f75a383d175dcacc7573b404753aac3f79315a`。
- 前段の `301d8b6` と `63f75a3`、既存の設計/描画/問い合わせレポートを確認した。
- 既存の未コミット変更は生成ファイル `next-env.d.ts` のみ。バイト単位で退避し、ビルド後に復元してコミット対象から除外する。
- 新しいローカルブランチ **`codex/design-workshop-2`** を作成。既存ブランチからreset/merge/cherry-pickは行わない。
- Vercelの読み取り専用照会では、Productionは `codex/nail-fit-studio-2` / `3f6ab5a878c3dcf134482806c162c6c95a6639e9` / READY。開始HEADはこの本番基準より2コミット先。
- 既存Previewに関する記録は今回の作成物ではない。本番URLのrobots/manifestとトップはHTTP200。本番ブランチ・ドメイン・環境設定は変更しない。

## 3. Phase別状況

| Phase | 今回の状態 |
|---|---|
| 0 調査 | Git/本番/保存形式/エディター/攻撃面/npm依存/変更前production計測を確認 |
| 1 ドラッグ配置 | 38素材、Pointerドラッグ、タップ→配置、移動、ハンドル拡縮/回転、キー操作、保存/試着を実装 |
| 2 レイヤー/描画 | 手描き・図形・13装飾の統合選択、名前、表示、ロック、濃さ、重なり、コピー/貼り付け、Undo/Redo |
| 3 立体パーツ | **質感の新方式は未採用**。既存のCanvasによる陰影/反射/クリップ/追尾を維持し、編集方式のみ統合 |
| 4 再訪機能 | **新規特集・比較・レシピ・推薦・新着・SWは未実装**。既存コレクション/再編集を維持し、保存後の再読込と安全な削除を改善 |
| 5 セキュリティ | 本番依存の重大/高リスクを解消、ヘッダー・保存スキーマ・環境ファイル除外・削除確認を強化。開発用中程度8件/実サービス検証は残る |
| 6 性能/UI | 描画の不要な中間合成を削減、エディターを追加分割、範囲/メモリ上限を維持。実機性能は未確認 |
| 7 総合検証 | ローカルの自動/実Chrome/タッチ相当/実モデル検証。実iPhone/Androidと実際の連続手動作は未検証 |

## 4. ドラッグ配置の操作方法とPC/スマホの違い

1. `/create` で指を選び「拡大して絵を描く」を開く。
2. 素材一覧を「基本図形」「ネイル模様」「立体風装飾」で切り替える。
3. 素材を爪の内側へドラッグし、離す。画面端では緩やかにページをスクロールする。
4. ドラッグが難しければ素材をタップ→爪の配置位置をタップ。キーボードなら素材を選んだ後、CanvasでEnter（中央配置）。
5. 配置後は選択したオブジェクトをドラッグで移動。四角いハンドルで等方拡縮、丸いハンドルで回転する。
6. 幅/高さを別々に変える場合は設定を使用。正円/正方形の縦横比は固定。
7. 矢印で微調整、Alt+矢印で回転、Shiftで大きな移動/15度回転、+/-で拡縮、Deleteで削除。
8. Ctrl/⌘+C・V、またはコピーボタンで貼り付け。他の指にも渡せる非公開・メモリ内のクリップボードであり、OSのクリップボードへ書き込まない。
9. Undo/Redo、別の指/5本へのコピー、保存、写真/カメラ試着を利用する。

マウス・タッチ・ペンはPointer Eventsで統一。HTML Drag and Drop APIだけに依存しない。
素材のタップ領域は44px以上、変形ハンドルのタッチ判定も直径44px。描画Canvas/素材ボタン以外は通常スクロールを維持。
pointercancel/キャプチャ喪失は確定しない。フォーカスが他の入力へ移ったときも未確定の変形を取り消し、後から触った設定を古いgestureで上書きしない。
ドラッグ途中の変形は1回のUndoで戻せ、取り消しではRedoも保持する。
ピンチではなく既存の拡大/縮小・表示移動ボタンを使う。複数選択は未実装。

## 5. 素材・座標・描画方式

基本13種（円/楕円/正方形/長方形/ひし形/三角形/五角形/六角形/星/ハート/半月/直線/曲線）、ネイル模様12種（水玉/小星/花/チェック/ストライプ/波/レース風/フレンチ/キラキラ/リボン/連続ハート/グラデーション）、既存の立体風装飾13種。
すべて自作Canvasベクター/手続き形状。外部の画像素材、SVGアップロード、重い3Dライブラリは追加しない。

`client座標 → Canvas CSS矩形 → backing座標 → 爪中心を引く → 爪幅で正規化` の順で変換する。
スクロールはgetBoundingClientRectに含まれ、ズーム/DPRを二重適用しない。ドロップは現在見えているviewportと実際の爪パスの内側に限定する。
爪外に落とした素材は不自然に端へクランプせず取り消す。

オブジェクト中心はx/爪幅、y/爪長。図形寸法・ポイント・線幅は両軸とも爪幅単位で、円や正方形を歪めない。
パーツサイズも爪幅に比例。変形はローカル回転・スケールで適用する。
写真/動画試着では既存の映像contain変換、mirror、爪姿勢、部分表示輪郭/穴、爪形状のクリップを継承する。
表示の拡大や収納でモデル座標は変えず、カメラ/MediaStreamを作り直さない。

## 6. レイヤー・保存互換性・品質修正

新しい編集ではdocument **schema=3**。既存のschema=1/2を読み込み可能で、読み込みだけでは移行しない。
5本の `layers` / `parts` / `order` に加え、IDごとの `layerMeta`（名前・visible・locked・opacity）を保存する。
旧版に戻したときはschema=3を拒否するので、新しい情報を黙って削り落として上書きしない。
ライブラリ外側のschema、保存キー、保存枠40、700000文字上限は維持する。

- 非表示は描画だけでなく選択からも除外。ロックは変形・削除・色/サイズ変更を防ぎ、基本パーツ画面からも保護する。
- 消しゴムは従来どおり下の手描きだけに作用。非表示の消しゴムは描画に影響しない。
- 素材・装飾・線を共通の重ね順で扱う。複製/コピーはIDとメタデータ、ポイント配列を独立化する。
- 空白をドラッグしても、以前の選択物を勝手に動かすfallbackを廃止した。
- 保存成功時、制作ページだけを `?id=...` にreplaceStateする。再読込で保存物へ戻る。試着ページ内の保存ではURL/streamを変更しない。
- コレクション削除は確認と取消を追加。全端末内データの削除は別の確認入力を要求する。
- 保存拒否/破損/未来schemaでは元データを保持し、成功を偽らない。

保存画像は小さなプレビューを拡大せず、既存の写真前処理後の解像度（長辺最大2200）または動画実解像度に対し再描画する。
実写から物理的な3D爪形状・材質を完全復元したという主張はしない。

## 7. セキュリティ監査・修正・残留リスク

| 攻撃面/優先度 | 発見・判断・対処 |
|---|---|
| 依存/runtime・最優先 | Next 16.3.0が複数の公式告知の対象。Next/対応ESLint設定を16.4.5へ限定更新。sharp等も互換範囲で更新 |
| 保存/Canvas | storageを信頼しない。schema/列挙/長さ/座標/個数/ポイント/メタデータを検証、予約IDを拒否。任意外部URL/SVG/コードを読み込ませない |
| XSS | 名前はReactのテキストとして表示。実ブラウザでHTML風の名前が実行されないことを確認。既存の静的ガイドJSON-LDにも `<` エスケープを追加（現在ユーザー入力の到達はない） |
| 環境ファイル | 従来は.env*.localのみ除外。.env/.env.*を除外し、exampleだけ許可。環境の実値は変更しない |
| 秘密履歴 | 追跡対象の環境ファイルはexampleのみ。既知の秘密鍵/APIキー形式をGit全履歴でハッシュのみ出力して検索、該当なし。すべての秘密形式を検出できる保証ではない |
| 問い合わせ/API | JSON16KiB、本文3000字、同Origin/Host/型/ホワイトリスト、固定Formspree URL、redirect拒否、8秒timeout、Turnstileトークン転送を維持 |
| レート制限 | per-instanceの補助制限とFormspree側CAPTCHA/制限を維持。分散サーバーレス全体での厳密な回数保証ではない |
| プライバシー | カメラ/写真は既存のブラウザ内処理。描画/写真試着のQAでPOSTなし。新しい画像API/AI送信先を追加しない |
| 削除 | prefixが `nail-fit-studio-next.` のlocalStorageだけ削除。別のキーは保持。部分失敗を件数付きで正しく通知する |

問い合わせの実サービスへの送信、CAPTCHA秘密鍵/管理設定の変更、大量送信/攻撃的なテストは行わない。
既存のモックテストを実メール到達と混同しない。Formspree側の設定と実際のメール到達は未確認。
生のEXIF等を永続保存する追加処理はない。既存の写真準備はCanvas再エンコードを通す。これを独立した全画像形式のメタデータ監査済みとは呼ばない。
広告/解析スクリプトの将来の挙動を保証するものではない。ブラウザQAでは第三者広告/解析を遮断しており、実広告配信中の全通信は未検証。

### npm監査

開始時：critical 1 / high 5 / moderate 8（計14、重複する伝播パッケージを含む）。
更新後：**本番依存は0件**。全依存では開発用ESLint/typescript-eslint→minimatchのmoderate 8件が残る。
minimatch 11への互換範囲外overrideや、audit fix --forceによるNext 15への変更は採用しない。公開APIへ直接到達する処理ではないが、開発ツールのリスクとして追跡が必要。
Next/ESLint設定は修正版に固定し、ロックファイルを更新。sharp=0.35.5、source-map-js=1.2.2、zod=4.6.7等へ限定更新。
app/src/scriptsに参照がないことを確認した `onnxruntime-web` は除去。MediaPipe=1.0.1、React/ReactDOM=19.2.8は維持。

主な一次資料：
- [Next画像最適化の公式告知](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)
- [Next use cache/typed arraysの公式告知](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr)

アプリに該当するuse cache関数はない。画像API側も実際の入力経路に条件がある。対象バージョンだったことと、実際に侵害されたことを混同しない。
**本番への修正適用は今回禁止されているため、本番が修正済みとは報告しない。**

## 8. ヘッダーとモデル配信の互換性

nosniff、strict-origin-when-cross-origin、SAMEORIGIN、camera=(self)/microphone・geolocation無効を追加。
CSPは**Report-Onlyのみ**。既知のGoogle/Turnstile/自己ホストWASMを考慮し、広告の動的な接続先は広く許容して、まだ強制しない。
外部のレポート収集先は追加せず、コンソールでの確認に限定する。nonceのため全ページをdynamic化する変更は採用しない。
Vercel本番のHSTSは読み取り確認で有効。今回、localhostや他のサブドメインへ新しいHSTS/preload設定を上書きしない。

### 実ブラウザで発見したNext更新時の回帰と修正

Next 16.4.5では、force-static Route Handlerの保存済みレスポンスからContent-Encoding/Content-Lengthが除かれた一方、本文はgzipのままだった。
HTTP200/ビルド成功でも、MediaPipeのGPU/CPU両方が `Unable to open zip archive` で初期化に失敗した。
raw HTTPのgzip本文と元モデルのSHA-256一致、ブラウザの診断で原因を確認した。

既存のビルド時圧縮とSDK URLは維持し、圧縮される2つの正確なパスにnext.configのContent-Encodingを追加。
SDKパスはAccept-Encodingのgzip条件付きとし、identity/gzip;q=0では元の非圧縮ファイルを返す。
chunked転送でContent-Lengthがない場合も、実際のHTTP復号後の全バイト一致で検証する。
モデル重みは元のまま（SHA-256 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`）、7819105→5796145 bytes。
Route Handler単体テストだけではこの回帰を検出できないため、production HTTPでの検証を実施した。
Vercel CDN上の最終確認は、別途公開の承認を得たPreviewで必要。

## 9. パフォーマンス・採用判断

変更前は63f75a3を実際にproduction buildして新しく3回計測。変更後も同条件で測る。
localhost/Chrome、10Mbps/80ms、ページCPU4倍、カメラCPU1倍/SwiftShader、640×480静止画由来VIDEO、広告/GA遮断。
実スマホのFPS/熱/電池ではない。Next自体も更新しており、差をすべてエディターの改善効果と断定しない。

3回の中央値（描画単独は100/30フレームの分位値）は次のとおり。

| 計測 | 変更前 | 変更後 |
|---|---:|---:|
| ホームFCP（中央値） | 1392ms | 1284ms |
| 試着FCP（中央値） | 1056ms | 1000ms |
| 初回JS encoded body合計（各ルート） | 273654B | 277780B |
| cold/warm可視5本 | 11016/8034ms | 10572/7602ms |
| cold/warm engine初期化 | 8072/5199ms | 8023/5157ms |
| cold/warm最終認識呼出 | 238.0/235.1ms | 222.5/228.4ms |
| cold/warmモデル処理p50（各runからの中央値） | 180.0/177.9ms | 160.9/163.0ms |
| cold/warm画像補正p50（同上） | 71.9/64.7ms | 65.5/64.5ms |
| cold/warm診断上の瞬時drawFPS | 12.99/9.98 | 9.50/9.61 |
| 通常：サイズ変更描画p90 | 2.2ms | 1.1ms |
| 最大：サイズ変更描画p90 | 68.9ms | 59.1ms |
| 通常：1本の描画更新p90 | 0.6ms | 0.4ms |
| 最大：1本の描画更新p90 | 23.3ms | 12.1ms |
| キャッシュ済み描画p90 | 0.2ms | 0.2ms |

通常は各3層+装飾1/120点、最大は各32層+装飾12/4096点/消しゴム8。5本/780〜800×1040 CanvasのCPU発行時間でありGPU完了時刻ではない。
最大のサイズ変更は変更後p50=35.8ms、最悪63.2ms。フレーム予算を超えるのでスマホの最大構成を快適と認定しない。
初回JSは4126B増加し、削減したとは報告しない。FCP/初期化の差も3回・異なるNextバージョンを含むため一般的な速度改善の保証ではない。

**drawFPSは下がったサンプルがある。** coldの各runは変更前12.99/13.14/9.35、変更後7.83/9.62/9.50。
これは起動後12回成功時点で読む2秒窓の診断値で、一定期間の定常FPSではない。ソフトウェアGPUとホスト負荷の影響も切り分けられていない。
描画CPUと認識処理が軽くなった値だけを理由に「PC追尾FPSも改善/維持済み」と断定しない。原因確定・長時間の定常FPS/実機確認は残る公開ゲート。
JS heapの観測範囲は変更前24.6〜40.4MB、変更後29.2〜43.0MB。GC時点に依存し、Canvas/GPU nativeメモリを含まず、長時間リークがない証拠ではない。

素材/変形操作の最終Pointer move→Canvas再描画開始は19サンプル、p50=1.6ms、p90=2.4ms、最大5.0ms。
表示完了までの遅延ではなく、変更前の同じ入力計測もないので、入力遅延が改善したとは主張しない。

実装した最適化は、NailPaintEditorの追加dynamic分割、消しゴムがない層での不要な中間合成の省略、失敗時のCanvas backing解放。
キャッシュは最大6面/合計400万画素、scratch/マスクは明示解放。点数/レイヤー上限は増やさず、1指32層/4096点/消しゴム8/装飾12のまま。
円を楕円へ変形する低精度な縮小画像キャッシュ、認識しきい値/推論解像度/頻度の引き下げは採用しない。
最大構成での負荷は残る。高負荷端末で常に滑らかと断定しない。

## 10. テスト記録

- lint/typecheck/32テストスクリプト/build成功（50 static-generation items）。既存21描画テストと手描きなし48条件のコマンド比較を含む。
- 新しい単体検証：38素材×8爪形×3長さ=912ケース、v1/v2/v3、座標/変形/コピー/予約ID/異常値/上限。
- 新しい実Chrome検証：38素材すべて配置・保存・復元・実ラスタ描画、マウスdrag/ハンドル/キー、タッチdrag/cancel、DPR2/拡大、写真試着、XSS風文字列、namespace削除、API405。
- 320/375/390/430/768/1280px、素材44px、横スクロールなし。旧プレビュー/BeforeAfter/スマホナビを維持。
- 最終ブラウザ：素材16グループ、手描き12グループ、従来workshop11グループ。各pageerror 0。
- サイト品質：13ページ/78レイアウト、BeforeAfter操作の被覆なし、異常画像/保存拒否を含む。
- SEO：43ルート/15レイアウト/サイトマップ40件、canonical/JSON-LD/日本語OGP/robots/noindex/AdSense/GA/ads.txt維持。
- 診断：5幅、実モデルVIDEO5本、手を見失って再試行/復帰、権限拒否、匿名診断コピー。
- 曲げた手：写真4本のpartial、静止画由来VIDEO3本、掌0本、甲へ戻して5本復帰。PNG保存/撮影時stream解放。
- 写真競合：最新選択/サンプル切替/カメラ失敗の案内を維持し、Object URLを解放。
- HTTP：gzip/identity/q=0のモデル全バイト一致、Search Console HTML/200、API405とセキュリティヘッダー。
- React確認：Client境界、トップレベルdynamic、Observer/RAF/pointer/unmount cleanup、immutable data、ラベルと操作領域を点検。

QA成果物は
`C:/Users/nlgid/.codex/visualizations/2026/05/16/019e3149-2c2f-7ce2-a154-da042e23465d/workshop-v2-20261106/`
の `before/after-startup.json`、`before/after-paint.json`、`comparison.json`、各 `*-regression.json`、`material-browser.json`、監査JSONと画像に保存。本番へ同梱しない。

上記の手検出は実モデルだが、VIDEOは静止画由来。実際の手の3D回転や撮影距離に対する精度測定ではない。
実iPhone Safari/Android Chrome、実USBカメラ、OS保存/共有、実広告/CAPTCHA/メール到達は未検証。

## 11. 変更ファイル

設定/依存：`.gitignore`、`next.config.ts`、`package.json`、`package-lock.json`。
UI：`MaterialPalette.tsx`、`NailPaintEditor.tsx`、`PaintCanvas.tsx`、`WorkshopEditor.tsx`、`WorkshopCollection.tsx`、`LocalDataControls.tsx`、`app/collections/page.tsx`、`app/globals.css`。
データ/描画：`editorMaterials.ts`、`editorObjects.ts`、`paintTypes.ts`、`paintData.ts`、`paintRenderer.ts`、`workshopTypes.ts`、`workshopData.ts`、`localDataControls.ts`、`securityHeaders.ts`、`nailRenderer.ts`。
安全なJSON-LD：`app/guide/[slug]/page.tsx`。
テスト：`check-editor-materials.mjs`、`check-material-placement-browser.mjs`、`check-workshop-security.mjs`、既存paintの2スクリプト、`check-startup-delivery.mjs`。および本文書。
handTracking/姿勢/One Euro/爪fit/モデル/GA/AdSense/ads.txt/Search Console確認HTML/フォームサーバー/環境変数は変更しない。

## 12. 未完了の再訪機能・次の区切り

| 項目 | 次に実装/検証する単位 |
|---|---|
| 季節/イベント特集 | 本当に試せるDesignDocument、説明、編集日、編集/試着導線を一組ずつ追加 |
| 同じ手で2案比較 | 同一写真・同一ポーズに2つの保存物を描画。Before/Afterとは別にテスト |
| セルフレシピ | 可視レイヤーと色/装飾から制作メモを生成。製品依存の硬化時間は断定しない |
| ルールベース提案 | 色/雰囲気/長さ/イベント等の明示条件を基に提案。個人の肌を確定診断しない |
| 新着/編集者おすすめ | 実際の追加日と選定理由を持つ。架空の利用ランキングを作らない |
| PWA | 既存manifest/iconsは維持。SW/オフラインは更新・旧JS破棄を検証できる別単位で実装 |
| 再開体験 | 今回は明示保存後の再読込を改善。自動保存・最近編集一覧の拡張は未実装 |
| 高度なパーツ質感 | 既存CanvasとWebGLを実測比較するための素材/照明/実機予算を先に準備 |

## 13. ローカル確認と公開前ゲート

```powershell
cd "C:\Users\nlgid\Documents\Codex\2026-05-16\new-chat\nail-fit-studio-next"
npm run build
npm run start -- --hostname 127.0.0.1 --port 4236
```

`http://127.0.0.1:4236/create` と `/collections`。開発は `npm run dev`。
LANのHTTPだけではスマホカメラのSecure Contextを満たさない。今回はHTTPS Previewを作らない。
将来、所有者が明示承認した後、Production branchを再確認して検証専用ブランチ/環境だけでPreviewを作る。Production push/merge/promoteは別承認。

公開前に必要な確認：
1. HTTPS Previewでモデルgzip/identityのHTTP復号結果と、iPhone/Androidの実MediaPipe初期化・甲5本を確認。
2. 素材drag/tap、拡縮/回転、タッチキャンセル、保存→再読込→再編集→試着→OS保存/共有を確認。
3. 距離変化、掌非表示、曲げた指の部分表示、親指、認識喪失/復帰、プレビュー収納/展開を確認。
4. 通常/最大構成を分けてFPS、入力遅延、発熱、長時間メモリを計測する。
5. Report-Only CSPの違反を実広告/GA/Turnstileで確認し、必要な許可先を精査してから強制CSPを別途検討。
6. 管理者の許可を得てFormspree/CAPTCHA/メール到達を少数で確認し、広告が操作領域を覆わないことを確認。

テスト用サーバーは作業完了時に停止する。コミットIDは最終報告とgit logで確認できる。実値の秘密鍵や環境変数はこのレポートへ記載しない。
