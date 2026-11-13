# 29958a9 描画テール・連続距離変化の局所最適化

## 作業範囲と基準

- 開始 HEAD: `29958a9a950511db509b7c521a879618adf8c5ae`。開始ブランチ `codex/nail-realism-performance` から、作業用 `codex/nail-tail-latency` を作成。
- 開始時の利用者変更は `next-env.d.ts`。バイト単位で別途退避し、build が生成する変更と区別して最後に復元する。コミットには含めない。
- `29958a9` の変更・`docs/performance-parity-20261110.md` を確認。旧レポートの消しゴム p99 34.2ms は180フレーム×3回の値であり、今回の長時間測定の基準値を34.2に固定しない。
- 目的は同じ絵を軽く描くことのみ。認識、MediaPipe、One Euro、指/姿勢/可視性、UI、保存schema、素材、広告/解析、SEO、問い合わせ実装は変更しない。push・PR・デプロイを行わない。

以下の略記はローカルの絶対パス：

- R: `C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-next`
- E: `C:/Users/nlgid/.codex/visualizations/2026/05/16/019e3149-2c2f-7ce2-a154-da042e23465d/tail-latency-20261113`
- PM: `C:/Users/nlgid/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`

`E/baseline/src` は変更前29958a9の凍結ソース。大きなtrace、比較PNG、写真、個人デザインはGitに追加しない。集計・主要診断は本書と同階層のmetrics JSONに記録する。

## 測定方法と限界

ローカルproduction Next.js、desktop headless Chromeで実際の `drawNails` を実行する。800×1040 Canvas、5本、保存形式に適合する最大構成（各指32レイヤー・12装飾・4096点・8消しゴム）。粒数、解像度、AA、shadow、gradient、opacityを落とさない。

`scripts/profile-tail-latency.mjs` で通常/距離を1200回、消しゴム編集を2400回測る。24回の同じwarmup後、全入力を描画し、フレームを捨てない。min/p50/p90/p95/p99/max、>16.7/25/33/50ms、各フレーム、最遅1%、JS heap、GC重なり、経過時間を保存。

- `--pace-ms 16.6667`: おおむね60回/秒を上限とする入力。処理が遅ければ後続も遅れる。待機を増やしてp99を良くしたと扱わない。
- `--pace-ms 0`: 追加の待機なし。ただし旧測定同様にrequestAnimationFrameを待つ。実ディスプレイのFPSではなく、このChromeの提出/RAFスループット。
- 距離: 5往復、scale 0.78–1.26。Canvasサイズではなく**爪幅・爪高を両方変える**。1200入力は60fpsなら20秒相当だが、実際の経過時間も別記する。旧レポートのCanvas幅のみ変更する負荷と混同しない。
- 別軌道 `--motion jitter`: 往復位相・指ごとの縦横比に微小な連続変化を加え、同じサイズの完全反復だけに有利な結果ではないか確認する。実機の姿勢精度評価ではない。
- GCはCDP traceのフレーム開始/終了markと同じpid/tidのMinorGC/MajorGCを突き合わせる。描画後のレポートJSON化によるGCはフレームのGCに加算しない。mark欠落時は失敗にする。
- 受入計測ではCanvas APIをラップしない。`--diagnostic` は別実行でAPIごとの時間/回数と割当サンプリングを取得する。wrapper・Error stack・heap samplerのオーバーヘッドがあるため受入レイテンシに混ぜない。phaseは入れ子で重複し、合計できない。
- JS peakは `performance.memory` の粗いフレーム後サンプル。benchmark用typed array、mark、読み込んだソースも含む。CDP heapの前後も別記。ネイティブCanvas、GPUメモリ、瞬間的な全プロセスpeakは取得できていない。
- renderer分離試験なので、実カメラ、MediaPipe推論、React更新、発熱、画面提示のFPSまでは測定していない。CPU側drawImageが待つ原因を、GPUドライバ等と断定しない。

## 原因の切り分け

### GCだけでは説明できない

基準版の距離1200回はp50 54.9/p99 76.2/max381.4ms、>16.7ms 1107回。そのうちGC重なりは119回。追加待機なしの消しゴム2400回はp99 35.4ms、long209回のうちGC重なりは1回。GCは存在するが大半のlong frameの原因ではない。

診断版の距離最遅360.1ms中、Canvas `drawImage` に348.3ms、GC重なり0.454ms。ほかの約79–91msの遅いフレームもdrawImageに67–77ms、GCなし。消しゴムの診断最遅45.5msはdrawImage44.1ms、GCなし。

距離のcache missはほぼ5本/フレーム。元の20-entry制限は画素上限4Mより先に達し、近いサイズの再訪でも古い完成画像を失う。毎サイズで完成画像に加え、実際に編集されるか未定の「最後のオブジェクト前コピー」も作っていた。scratch/maskは使用後1×1に縮小し、次の編集で再確保していた。

`getImageData` / `putImageData` / ImageData生成はこの描画経路では0。Path2D生成やgradient数・save/restore数だけでは長いフレームを説明できない。React/DOM/MediaPipeなしでも再現するため、今回それらのスケジューラを変更する根拠はない。

### 試した候補

1. **A: 割当削減だけ** — command/plan memo、LRU index、tupleの数値アクセス。距離GCは131→40に減ったが、p50 54.9→55.0、p99 76.2→75.4msで主問題は残った。GC対策だけで解決したとはしない。
2. **B: 完全一致サイズの保持・prefixの遅延生成** — 往復負荷のlongを1107→231へ削減。ただし微小変化を含む別軌道のp99は76.1→74.6ms程度に留まった。どんなカメラ移動にも大幅改善とはしない。
3. **C: 一時Canvasの完全一致サイズ再利用** — scratch/maskだけを追加待機なし編集でも再利用。個々の素材を縮小画像に置き換えない。採用版はA+B+C。

## 実装・キャッシュ無効化

- `paintCommands` / `paintPlan` は弱参照でimmutableなFingerArt依存を再利用。parts/layers/order/layerMetaの参照置換時は再構築。元の編集/Undo/Redoのimmutable契約を維持し、同じwrapperで依存だけ置換する試験も追加。
- 完成画像は従来どおり**0.1 destination pixelの完全一致**、brightnessの既存丸め、light、全visual command、後続eraserまで比較。座標/rotationは外側の既存transformで毎回適用。新たなscale bucketや再標本化はしない。
- size index＋LRU＋incremental pixel/ref count。完成cacheの4M画素上限は不変。件数を20→512、同一geometry内の版は16件までに分ける。距離の再訪を保持し、編集履歴が全slotを占有しない。共有prefixは最後の参照が消えた時だけ破棄。
- 最後のオブジェクトの実編集を観測したときだけprefix画像を作る。新しい距離だけではほぼ同じ画像を2枚確保しない。**新geometryで最初の編集はcold replayになり得る**。その最大値/初回コストも隠さない。
- raw stamp cacheは元の1M画素/64件、stamp位置も64件。光沢/石/パールの描画命令・計算順序は維持。tuple destructuringによるiteratorだけを数値読み出しへ変更。
- 新しいscratch poolは完成デザインを保持しない。**同じ整数Canvas寸法のときだけ**取得しclearRect、異なる寸法は新規確保。24枚/1M画素まで、過大な保存画像のbufferは保持せず解放。正常経路も例外経路も必ず返却。pagehide/明示clear/プールcontextlostで解放し、取得時のcontext lossも確認。
- 完成cache4Mは同じでも実際の利用率は増える。加えてscratch poolは最大1M画素（RGBA backingなら約4MB相当、ブラウザ付帯費用別）を保持する。**総native/GPUメモリが減ったとは主張しない。** 実機の長時間確認が必要。

## 見送った方法

解像度/DPRを下げる、ラメ減粒、影や艶削除、フレーム間引き、サイズ丸めを粗くする、異なるサイズのbitmapを拡大する方法は不採用。画素差ゼロの目的に反する。GC対策のみで解決とする案も上記反証で見送り。Worker/React/MediaPipe/UIの書き換えは今回の診断根拠と変更範囲に合わない。

## 最終版の性能

API wrapperなしの**同条件ペア**。Eの`final-*.json`からフレームをpoolしてpercentileを計算する（各回のp99の平均ではない）。消しゴムは3ペア、往復距離は順序を逆にした2ペア。それ以外は1ペアで再現性の確証が弱い。

|最大構成 / 前→後|各側N|min ms|p50 ms|p90 ms|p95 ms|p99 ms|max ms|
|---|---:|---:|---:|---:|---:|---:|---:|
|消しゴム・追加待機なし|7200|1.1→1.0|2.0→1.4|7.9→7.7|32.8→30.3|34.8→32.6|58.1→54.5|
|連続距離・同軌道5往復|2400|0.1→0.0|54.7→0.2|65.0→45.5|68.3→55.2|74.2→67.3|360.1→323.2|
|連続距離・指別微小変化付き別軌道|1200|0.2→0.1|55.8→51.2|66.3→66.0|70.5→69.8|77.5→74.5|347.6→308.7|
|同じ最大構成・静止|1200|0.1→0.0|0.3→0.2|0.4→0.3|0.4→0.3|0.4→0.3|0.7→0.4|
|消しゴム・60回/秒入力|1200|1.3→1.0|1.5→1.3|1.8→1.4|1.9→1.5|2.1→1.7|5.1→3.9|

0.0は時計分解能による表示で、描画コストが0という意味ではない。sub-ms差を精密な改善率として扱わない。

|状態 / 前→後|>16.7ms|>25ms|>33ms|>50ms|提出/秒（※）|JS peak MiB|GC回数|
|---|---:|---:|---:|---:|---:|---:|---:|
|消しゴム・追加待機なし|540→493|540→491|319→41|6→1|136.44→147.49|24.85→25.53|137→85|
|連続距離・同軌道|2218→452|2204→360|2169→344|1608→176|19.36→45.56|29.85→25.81|261→26|
|連続距離・別軌道|1167→1157|1163→1143|1133→1112|839→634|18.61→19.66|29.65→25.79|128→36|
|最大構成・静止|0→0|0→0|0→0|0→0|60.01→60.01|24.36→24.25|14→8|
|消しゴム・60回/秒|0→0|0→0|0→0|0→0|60.01→60.01|24.36→24.71|36→17|

※ elapsed wall timeに対する実行完了回数で、物理的な画面提示FPSではない。longはCanvas描画呼出時間であり、rAF間隔のlongではない。rAF間隔そのものは全フレームJSONに保存。GCの回数も描画を含む測定区間中の値で、すべてのGCが描画内に発生したわけではない。

1200入力の距離1回あたりの実経過は、同軌道が約62.0→26.3秒、別軌道が約64.5→61.0秒。フレームを飛ばしていない。**同軌道の再訪には大きく効くが、毎フレーム新しい縦横比になる動きには改善が限定的**。別軌道では依然としてほぼ全フレームが16.7msを超える。

### バラつき・悪化・残るテール

- 待機なし消しゴムの各回p99は前34.9/35.0/34.5、後32.7/32.0/32.8ms。3回とも改善。ただし各回p50は前2.1/2.0/1.9、後3.0/1.3/1.6msで、**1回目は悪化**。poolした良い中央値だけで全試行無悪化としない。
- メモリは消しゴムでJS peakが24.85→25.53MiBへ増加。60fps編集でも24.36→24.71MiB。Canvasのnative/GPU peakは不明。GC回数が少ないことと総メモリが少ないことは別。
- 最適化後の診断でも307.0msの距離フレームはdrawImage293.4ms、個別のコピー1回248.2ms。ソース・宛先は同じ43×124px、artSurfaceのscratch→完成surface合成でGCなし。編集の診断49.4msもdrawImage48.1ms、同57×144pxコピー1回46.7ms、GCなし。単なる画像の巨大化だけではなく、Canvas内の合成/コピー待ちが残る。GPU内部処理の詳細までは確定できない。
- 編集の代表的なmissフレームではCanvas生成4→1、寸法setter16→4回、drawImage66→65回。距離のcold frameは20→11生成、80→34 resize、250→245 drawImage。pool再利用により減るが、画質に必要な残りの合成は削除しない。
- この新測定で改善しても、過去の34.2msをいつも下回ると保証しない。ブラウザのGPU queue、GC、温度や他プロセス等による変動、実機の性能差がある。

### 前回の短時間ハーネスも再実行

`benchmark-realism-performance.mjs --cases A,E --runs 3 --samples 180` を前後で実行。下は各回percentileの中央値（上のpoolした値とは違う）で、Eは同じ最大構成。旧連続距離はCanvas幅のみ変えるので別指標。

|E 状態|前 p50/p90/p99 ms|後 p50/p90/p99 ms|
|---|---|---|
|cached|0.3/0.3/0.4|0.2/0.2/0.3|
|continuous-distance（旧条件）|2.4/24.3/36.0|0.2/0.2/0.3|
|active-ink|0.7/0.8/0.9|0.5/0.6/1.0|
|active-eraser|1.5/4.6/7.5|1.8/1.9/2.1|

ここでは消しゴムのp50が1.5→1.8msと悪化する一方、p90/p99は低下した。短い測定と長い測定でキャッシュ/GPUの状態も異なる。旧ハーネスの新しい値を、過去の5.7→1.8msと混ぜて報告しない。

**cold編集のトレードオフ**：active-inkの最大は、前3回が1.0/1.3/1.3ms、後22.4/2.2/2.2ms。遅延prefixの初回cold replayにより、新たに22.4msの1フレームが生じた。平均/p90は改善しても、初回の最悪値まで無悪化という条件は達成していない。この条件は残存リスクとして公開判定に含める。

通常ジェルAのcachedは、両側ともp90が3回すべて0.2ms。p50は0.1–0.2msで、通常負荷の大きな悪化は観測していない。

## 最終回帰・画素一致

利用者の操作は「制作/写真/カメラ → immutableな指別デザイン → 正規化素材と爪座標 → Canvas合成 → 保存/再読込/再編集」。この経路を既存のproduction-browser試験で確認し、外部サービス到達とは分ける。

|検証|最終結果・E配下の証拠|
|---|---|
|lint|成功。新QA script追加後の`lint-final.log`|
|typecheck|成功。利用者next-env復元後の`typecheck-final.log` / `typecheck-restored-final.log`|
|npm test|38スクリプトすべて成功。`test.log`。今回追加したmemo/LRU/pool/上限/context loss回帰も含む|
|production build|Next.js 16.4.5成功、50/50静的生成。`build-final.log`。アプリの最終変更はこのbuildに含む|
|56回帰ジョブ|**56実行/56成功/0失敗**。`regression/manifest.json`。別途5領域未実施|
|元の142描画条件|29958a9と全RGBA差0。`regression/render-equality.json`|
|拡張217描画条件|29958a9と全RGBA差0。`final-pixels.json`。72の色/alpha/寸法/編集条件、3つの任意cache登録失敗条件を含む。例外24回注入でも描画継続|
|写真76組|実画像2枚×38条件、全RGBA差0。`photo-parity/result.json`。通常ジェル・ラメ・ストーン・パール・複合/最大構成を含む。実写47素材も別に差0|
|動的geometry追加試験|240連続フレーム、全RGBA差0。`final-motion-pixels.json`。5指のscale/縦横比・XY移動・回転を同時に変え、pool/evictionを通す。readbackがあるため性能値に混ぜない|
|Canvas復旧・保存・再編集|recovery / workshop / paint / materials / styles / studio-settings等のbrowserジョブで成功。旧schema・破損/容量不足・Undo/Redo・レイヤー・保存失敗・再編集も対象|
|写真・疑似カメラ|distance.logで実モデルによる拡縮/XY/回転、認識喪失/復帰、自動補正、長い自爪、撮影、stream解放、PNG保存が成功。物理カメラではない|
|甲・掌・曲げた指|curled.jsonで甲へ復帰5本、開いた掌0本、曲げ写真4本/静止画由来VIDEO3本を確認。連続的な実際の手回転の精度を測ったものではない|
|スマホ幅・PC・既存連携|320/375/390/430px等でoverflowなし、既存スマホ導線のbrowser試験成功。SEO・GA4・AdSense・ads.txt・Search Consoleファイルの検査も成功|
|利用者の未コミット変更|`next-env-original.bin`と現在のnext-env.d.tsをバイト比較して一致。コミット対象から除外|

38スクリプトはnpm testと56ジョブ内で再実行したが、独立した76ジョブ等に水増ししない。142は217に含む。写真76は「76枚の異なる手」ではなく2枚×38条件。追加motionの240フレームも217条件の件数へ加算しない。

比較画像は `E/photo-parity/hand-0-board-0.png`～`hand-0-board-9.png` と `hand-1-board-0.png`～`hand-1-board-9.png`。全画像を生成し、RGBA比較に加えてラメ、石/パール、複合デザイン等を目視spot-checkした。これは新しい美的品質の採点ではなく、前版と見た目が変わらないことの検査。

main cacheは217試験終了時3,313,998/4,000,000画素、raw stamp 982,620/1,000,000画素、scratch 284,268/1,000,000画素（24枚）。各cache上限のassertを維持した。これらは保持bufferの画素数であって、アプリ総メモリの実測ではない。

### 未検証の範囲

物理カメラ、iPhone Safari実機、Android Chrome実機、本物のFormspree/Turnstile到達、実広告/GA配信が未確認。ローカルのFormspree QA preload＋process限定ダミーenvで送信成功/失敗をmockし、実メールは送らない。広告/GA外部リクエストもbrowser試験で遮断した。mock用4261サーバーは検証後停止した。

今回の描画時間測定は中心/回転を固定しサイズを変える負荷。移動/回転の**機能性**は上記distance/追加240フレームで確認するが、実追尾の遅延やカメラFPSを測定したとはしない。ヘッドレスの実モデル診断で5本表示は確認したが、モデル推論に数百msかかるサンプルもあり、実カメラ/スマホの速度向上を断定する根拠には使わない。

新しいP0/P1は上記自動検証範囲で検出なし。ただしcold編集の22.4msや未測定のnativeメモリ等を無視して「全条件無悪化」とはしない。

## 実機チェックリスト（両OSとも未実施）

同じ端末・OS・ブラウザ・デザイン・光・カメラで29958a9と候補を比較し、端末名、ブラウザ版、室温、実行時間を記録する。今回HTTPS Previewを作成していない。実機用HTTPS環境は別途許可・準備が必要。LANのHTTPではSecure Context制約によりカメラが開けない場合がある。

|人間が確認する項目|Safari iPhone|Chrome Android|
|---|---|---|
|カメラ許可、外/内カメラ切替、停止→再起動|未|未|
|甲5本、親指/小指、手追尾、距離連続往復、傾き|未|未|
|掌の隠れ爪非表示、曲げた指の部分表示、甲へ復帰|未|未|
|通常ネイル/ラメの粒数・透明感・艶が前版と同じ|未|未|
|ストーン/パールの反射・影、半透明パーツが同じ|未|未|
|スクロール、収納プレビュー、Safe Area、Before/After|未|未|
|お絵描きピンチズーム/パン、5本個別編集、Undo/Redo|未|未|
|消しゴム・レイヤー順/色/太さ/opacity変更が即時反映|未|未|
|新サイズで初めて線を編集したときの一瞬の重さ|未|未|
|通常/最大構成10分以上、連続距離、FPS低下、発熱|未|未|
|メモリ不足、タブ再読み込み、バックグラウンド→復帰、Canvas復旧|未|未|
|写真連続選択、高解像度保存/共有、保存→再編集、旧データ|未|未|

## 公開判定・未解決事項

**公開判定：NO-GO（保留）。** p99や往復距離のCPU時間は改善したが、実機未確認、別軌道の最大構成の重さ、cold編集の1フレーム悪化、native/GPUメモリ未測定が残る。今回もpush・PR作成・Vercel Preview/Productionデプロイを一切行わない。

目標の「同じ絵なのに処理が軽い」は今回のChrome試験範囲で確認したが、「全試行/全操作でp50や最大値が無悪化」「スマホで問題なし」「スパイク完全解消」という完了宣言はしない。公開に必要な実機判定は別に残す。

次は無限にcacheを増やすのではなく、実機のdrawImage合成待ちとresident memory、初回prefix準備の22.4msを、画素一致を維持したまま再評価する必要がある。今回の変更で解像度・粒数・光沢・影・フレーム更新を削っていない。

## 変更ファイル

以下はいずれも上記R配下。各略記はRの絶対パスに対応する。

|ファイル|役割|
|---|---|
|`R/src/lib/paintSurfaceCache.ts`|immutable recipe memo、size-indexed LRU、画素/ref count、件数/版数制限|
|`R/src/lib/paintRenderer.ts`|plan memo、prefix遅延生成、scratch pool連携、tuple割当削減|
|`R/src/lib/paintScratchPool.ts`|1M画素/24枚の完全一致一時Canvas再利用・context loss対策|
|`R/src/lib/partRendering.ts`|同じ数値計算のままtuple iteratorだけ削減|
|`R/scripts/check-paint-surface-cache.mjs`|memo依存、512件/16版、lazy prefix、pool/復旧/上限の回帰試験|
|`R/scripts/profile-tail-latency.mjs`|別実行のphase/GC/heap診断、全フレーム/slow1%の保存、距離別軌道|
|`R/scripts/check-motion-render-browser.mjs`|距離/縦横比/移動/回転240フレームの画素一致回帰|
|`R/docs/tail-latency-20261113.md`|本書|
|`R/docs/tail-latency-metrics-20261113.json`|各試行・集計・診断・最終QA・runtime hash|

`next-env.d.ts` は利用者変更を復元し、コミットしない。新ライブラリやpackage scriptの変更はない。

## ローカル確認・再計測

既存のローカルサーバーを停止してから、自分で起動する場合：

```powershell
Set-Location 'C:\Users\nlgid\Documents\Codex\2026-05-16\new-chat\nail-fit-studio-next'
npm run build
npm run start -- --hostname 127.0.0.1 --port 4260
```

今回の確認URLは `http://127.0.0.1:4260/create` と `http://127.0.0.1:4260/try-on`。GitHub/Vercel公開URLではない。

新しいPowerShellでの例（Rを作業ディレクトリとする）：

```powershell
$e='C:/Users/nlgid/.codex/visualizations/2026/05/16/019e3149-2c2f-7ce2-a154-da042e23465d/tail-latency-20261113'
$pm='C:/Users/nlgid/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
node scripts/profile-tail-latency.mjs --base-url http://127.0.0.1:4260 --playwright-module $pm --scenario eraser --frames 2400 --pace-ms 0 --output "$e/recheck-eraser.json"
node scripts/profile-tail-latency.mjs --base-url http://127.0.0.1:4260 --playwright-module $pm --scenario distance --motion jitter --frames 1200 --output "$e/recheck-distance.json"
```

前版には `--source-root "$e/baseline"` を追加。診断はさらに `--diagnostic` を追加し、別の出力名で実行。API wrapperあり/なしを同じ表に集計しない。新規環境では29958a9のsrcスナップショットとPMを用意する必要がある。

本書を含むコミットIDは最終返信、または `git log -1 --format=%H -- docs/tail-latency-20261113.md` で確認できる。
