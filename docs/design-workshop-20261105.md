# デザイン制作・立体風パーツ：段階実装記録（2026-11-06）

## 1. 結論・今回の実装範囲

**Phase 0〜4の最初の利用可能版を実装。7つの再訪機能までの全体完成ではない。**

「5本を個別に作る → 写真/カメラで試す → 保存 → 再読み込み → 再編集」を通した。カメラ中の編集は試着ページ内で行い、ストリームを作り直さない。追加ライブラリ、外部画像素材、外部AI、DB、ログインは不要。

| Phase | 状態・根拠 |
|---|---|
| 0 調査 | 完了。Git・Production/Preview・保存・描画・キャッシュを監査、変更前build/計測を保存 |
| 1 データ基盤 | 完了。schema=1、5本の独立データ、正規化座標、上限、厳格な検証、旧データ非破壊 |
| 2 自作エディター | ローカル検証完了。色/模様/形/長さ/透明度/装飾、Undo/Redo/初期化/取消/保存/再編集 |
| 3 試着接続 | ローカル検証完了。実MediaPipeの写真と静止画由来VIDEO、保存・再試着、同一stream維持 |
| 4 立体風装飾 | ローカル検証完了。13種、移動/大きさ/色/回転/重なり/コピー、既存可視性マスクを継承 |
| 5 再訪7機能 | **一部のみ**。4分類の自作コレクション、旧お気に入り/履歴への導線、ホームから再開 |
| 6 UI/性能 | 実装とPC/スマホ幅検証完了。実機負荷・Safari操作は未確認 |
| 7 総合検証 | 自動検証完了。実機と実際の連続手動作の最終ゲートは未完了 |

新ページは `/create` と `/collections`。既存URL・グローバルナビ・ピンク系デザインを維持。ダミーの比較・レシピ・おすすめボタンは設置していない。

## 2. 作業開始時の確認

対象 `kiyoshike-lab/nail-fit-studio` / `nail-fit-studio-next`。開始ブランチ `codex/nail-fit-studio-2`、HEAD `3f6ab5a878c3dcf134482806c162c6c95a6639e9`。

未コミットは既存 `next-env.d.ts` のdev生成参照のみ。ファイルを退避し、最終的にバイト単位で復元する。今回のコミットには入れない。

read-onlyのVercel接続と公開GitHub Deployment記録でProduction READY/3f6ab5aを確認。Deploymentは `dpl_Fqv4whyQ9wNj4tdDnuUV8pBP33Ly`。Previewには3f6ab5aと古いbdd9303の記録がある。remoteの同名ブランチとmobile-preview-contactも3f6ab5a、mainは別の旧サイト系統であり取り込まない。Productionに一致するHEADから **codex/design-workshop** を新規作成した。

push、PR、Preview新規公開、Production公開、有料契約は実施していない。問い合わせ設定・秘密鍵には変更しない。

## 3. 監査で確認した課題と採用判断

従来は5本共通のNailDesign。旧お気に入りには完全な設定を保存していたが、再試着リンクでは色/形/模様/長さ区分だけへ変換し、素材・仕上げ・実写柄・厳密な長さが欠落していた。

今回は指別の構造化デザインを追加し、再試着は端末内の保存IDを解決する方式へ修正。写真上の爪位置/可視性は新しい写真で再認識し、以前の写真のマスクを貼り戻さない。旧設定は読み取り時に書き換えない。

重い3Dライブラリ・サーバーAI・新しい爪モデルは採用しない。認識エンジン、21点/3D姿勢、指ID、親指補正、One Euro Filter、画像境界補正、自然爪長、反転/contain変換には変更していない。

## 4. エディターの仕様

5本それぞれにベースカラー、透明度、模様、仕上げ、形、デザイン長、表面アート、装飾配列を保持。グラデーション、フレンチ、花風、マーブル、ドット、ライン、ラメ、ミラー風、マグネット風を組み合わせられる。実写素材は元のプリセットから読み込んだものを維持し、写真素材がない状態で実写再現を装わない。

装飾はシルバーホロ、ゴールドホロ、大粒/細かいラメ、ラインストーン、クリスタル、パール、ハート、星、リボン、シェル風、ぷっくりジェル風、フラワー風の13種。色/位置/大きさ/回転、複製/削除/前後移動、5本へのコピーを提供する。

位置は爪の中心に対する正規化x/y、サイズは爪幅の割合。画面ピクセルで保存しない。ドラッグのほか位置スライダーをキーボードでも操作できる。爪の外側は切り抜く。各指最大12パーツ（全体60）、Undo/Redo各40状態。1回のドラッグは1Undo単位。pointercancelは元の状態とRedoを復元する。

自動保存ではない旨を画面に明記。明示保存でコレクションへ、試着操作で下書きへ保存する。試着ページ内では保存不能でもメモリ内のデザインを適用し、再読み込みで失われる旨を通知。ページ間移動は保存失敗時に中断し、内容を失わせない。

## 5. 描画方式と限界

Canvas 2Dのプロシージャル自作図形。多角形の反射面、放射グラデーション、ハイライト、簡易な接地影で立体感を近似。ダウンロード素材のライセンス追加や外部通信はない。

既存の爪root→center→rotation→shape clip内に装飾を描画し、distance/rotation/shape/design lengthに追従する。既存のpartial contour/holes・非表示・フェードも同じ描画階層で適用する。透明度は塗り部分のみに作用し、装飾そのものは残る。透明ベースに不要な根元影が残らないようにした。

これは**2.5D風表現であり完全な3Dではない**。実際のパーツ厚、PBR/スペクトル反射、横から見た立体の張り出し、指同士の物理的遮蔽、爪面の完全な透視形状を復元しない。認識精度の向上も今回の成果とは主張しない。

複数の実写テクスチャはCanvasのsave/clipより前に並列解決。古い非同期フレームはisCurrentで描画しない。カメラでは既存どおりテクスチャ待ちをせず、読み込み完了後の次フレームで使用する。

## 6. カメラ・既存機能への影響

エディターをnext/dynamicで必要時に読み込む。表示だけの変更をカメラのstart/stop依存に入れない。プレビュー収納/展開、編集、適用後も同一MediaStreamがactiveのまま、getUserMediaの呼出が1回であることをブラウザで確認。停止/撮影ではtrackを解放する。

実MediaPipe VIDEOで5本描画。従来の回帰では曲げた手の静止画4本（partial）、静止画由来VIDEO3本（partial）、開いた手のひら0本、手の甲へ戻して5本を確認。これは連続撮影動画や正解マスク付き評価ではない。親指/小指・距離・回転・反転・喪失/復帰・可視性の既存ユニット回帰も成功。

iPhone/Androidの既存復旧コードは変更していないが、**この変更後の実機成功を確認したわけではない**。

## 7. スマホUI

320/375/390/430pxで横はみ出しなし。基本・装飾・コピー/保存をdetailsで分離し、指ボタンを折り返す。主要ボタンの44px以上、16px入力、グループのaria-pressed、状態通知、図の代替テキストを確認。追加の固定ポップアップやアニメーションはない。既存Safe Areaとプレビュー収納/BeforeAfterを継承。

Canvas不可の場合は図だけにエラーと再試行を出し、編集データを保持。実ブラウザで復旧を確認。Chromeのタッチエミュレーション、pointercancel、キーボードの位置調整を確認。iOSのカラーピッカー・共有シート・実タッチは別ゲート。

## 8. 保存・互換性・プライバシー

新キーは `nail-fit-studio-next.workshop-draft.v1` と `nail-fit-studio-next.workshop-library.v1`。schema=1、40デザイン、約70万文字を上限とし、readerが拒否する大きさをwriterも拒否する。色/列挙値/座標/角度/URL/5本/パーツ数/重複IDを検証し、写真・landmark・任意フィールドを保存対象から除外。URLはローカルのpreset-texturesだけ。

未知バージョン、壊れたJSON、保存権限なし、容量不足は成功扱いにしない。元データを上書きしない。未知データの自動修復やクラウド同期は未実装。サイトデータ削除で消える端末内保存であることを案内。

既存SavedNailLookに任意のartworkを追加。旧お気に入り/履歴はそのまま読み、旧キーを移行・削除しない。旧機能の試着お気に入り/履歴と新しい自作コレクションは別保存で、相互の導線を設けている。自作は4分類（created/favorite/next/salon）。保存済み分類を再編集・再保存しても勝手にcreatedへ移動しない回帰を追加。

手の写真/動画を外へ送らず、自作図形は端末内生成。デザイン名/装飾座標もGAイベントに含めない。プライバシーポリシーに新しいローカル保存の説明を追加。

## 9. 性能計測

変更前build（3f6ab5a）と変更後production buildを同じlocalhost/Chrome/390×844で各3回。ネットワーク10Mbps/80ms、ページ表示CPU4倍、カメラCPU1倍/SwiftShader、640×480の静止画由来stream。広告/GA通信はCDPでブロックし、HTTPキャッシュ自体は無効化していない。coldは新context、warmは同一contextでページを再読込。端末実測・実動画・フィールドデータではない。

| 指標（3回の中央値） | 変更前 | 変更後 |
|---|---:|---:|
| ホームFCP/LCP | 1348ms | 1296ms |
| 試着FCP/LCP | 996ms | 1012ms |
| カメラ開始→実際に5本が可視描画、cold | 10751ms | 10736ms |
| 同上warm | 7649ms | 7605ms |
| 認識エンジン初期化cold | 8053ms | 8052ms |
| 初期化warm | 5143ms | 5149ms |
| 定常最後の1推論cold（各runの値の中央値） | 225.3ms | 227.3ms |
| 同上warm | 224.7ms | 221.9ms |
| 診断の描画FPS cold | 9.35 | 9.13 |
| 診断の描画FPS warm | 9.45 | 9.48 |
| 診断の最後のCanvas描画呼出cold/warm | 0.1/0.1ms | 0.2/0.2ms |
| 計測窓のJS転送量（各route） | 249350B | 264348B |
| 観測したJS heap範囲（全6カメラrun） | 30.9〜44.8MB | 29.0〜42.8MB |

FCPの全3回は変更前ホーム1724/1320/1348ms、後1728/1252/1296ms、前試着1108/996/940ms、後1148/996/1012ms。cold5本は前10751/10626/10815ms、後10736/10822/10686ms。warmは前7818/7649/7614ms、後7793/7605/7578ms。差は小さく、OS負荷/GC/prefetch/モデル初期化の変動を含む。**有意な高速化を断言しない。**

全5本が見えていることをalpha/検出表示/描画呼出で確認した通常デザインで計測した。装飾なしでのみ既存の回転呼出計測を使い、装飾追加のrotate呼出を5本検出と誤認しない。短時間のheapはGPU/WASM総メモリやリーク証明ではない。SwiftShaderの同期推論が大きいため、このFPSをスマホ実機の値にしない。

新しい検証/描画によりJSは約15kB（約6%）増加。初期候補の試着272614Bから、新規コレクション等の不要なprefetchを無効化して最終264348Bへ抑えた。エディター本体は初期ナビゲーションで読み込まれず、開いたときに取得されることをresource/chunkで確認。後の別nav-only runではホーム145133〜264312Bと先読みタイミングで変動しており、最少値だけを採用して大幅削減と主張しない。

追加装飾の単体コストもChromeの780×1040 Canvasで30 warmup＋500回/条件を測定した（CPUの描画コマンド発行時間、GPU完了/FPSではない）。

| 全5本の装飾数 | モード | p50 | p90 | 平均 |
|---|---|---:|---:|---:|
| 0 | 標準 | 0.10ms | 0.20ms | 0.081ms |
| 5 | 標準 | 0.10ms | 0.20ms | 0.127ms |
| 5 | 軽量 | 0.10ms | 0.20ms | 0.135ms |
| 60 | 標準 | 0.70ms | 0.80ms | 0.692ms |
| 60 | 軽量 | 0.40ms | 0.50ms | 0.464ms |

少数パーツでは軽量モードの優位は測定分解能内。最大60個ではコマンドコストを抑えられたが、実カメラ＋60個の長時間FPS/発熱/メモリ、iPhone/Androidでの上限妥当性は未検証。

元JSON/スクリーンショットはローカルQA領域 `C:\Users\nlgid\.codex\visualizations\2026\05\16\019e3149-2c2f-7ce2-a154-da042e23465d\design-workshop-20261105` のbaseline.json、release-check-performance.json、parts-cost-final.json、*-browser.jsonに保存。画像をリポジトリ/外部へ追加公開していない。再計測はscripts/benchmark-startup-browser.mjsとbenchmark-workshop-rendering.mjsの--base-url/--playwright-module/--output（前者は--image/--runs 3）を使う。

装飾のlightモードは反射面/粒子数のみ減らし、位置・マスク・手認識の頻度は変更しない。実機の安全性確認なしに推論を間引く変更は採用していない。

## 10. SEO・GA4・広告・問い合わせ

既存の日本語title/description/canonical/OGP/構造化データを維持。実在する/createだけsitemapへ追加（計40件）。個人用/collectionsはnoindexでsitemapに入れない。変更したホーム/試着/プライバシー/制作だけ更新日を2026-11-06へ、未変更記事の更新日は維持。

GA4の既存イベントを維持し、design_editor_started / custom_design_saved / custom_design_tryon / nail_part_added / saved_design_reeditedを追加。送信パラメータはパーツ種類・本数等だけ。実GA配信の受信確認ではなく、タグとコードの重複/保持を検証している。

G-CLEJWK7RF3、ca-pub-6994120027205290、ads.txt、Search Consoleファイルを維持。HTML/Googlebot UA検証43ページ、sitemap40件、robots/404、広告/GAローダータグ各1個を確認。確認ファイルのHTTP 200と完全一致本文も確認。

新しい制作/コレクションにはAdSlotを置かない。既存の自動広告ローダーは変更しないため、AdSense側でもこれらの操作URLが自動広告除外になっているか公開前に確認すること。Formspree/Turnstile/環境変数/サーバー送信は未変更。問い合わせテストは既存のmock transport検証であり、今回メールを実送信していない。

再訪率は公開承認後にGA4の7日/28日コホートで、再編集・再試着・保存の利用を観測する。実ユーザーの数値がない現段階で改善した再訪率や人気順位は作らない。

## 11. 検証結果

- lint：成功、warning/errorなし。
- typecheck：成功（既存next-env復元後にも再実行）。
- npm test：29スクリプト成功。新規描画チェック21ケースを含む。
- build：成功、50 static-generation items。新2ルートを生成。
- workshopブラウザ：11分類成功。作成/各指/ドラッグ/コピー/Undo/保存/再読込/再編集/写真/VIDEO/PNG/お気に入り/履歴/保存拒否/未知schema/Canvas復帰。
- サイト品質：13ページ×6画面条件＝78レイアウト、BeforeAfter被覆なし、既存保存/診断/プリセット/不正画像エラー成功。
- SEO：43ページ、15レイアウト、sitemap40件成功。
- diagnostics：5画面幅、実モデルVIDEO5本、手なし継続、同一stream再試行、再生再開、権限拒否成功。
- 写真競合：連続選択の最新480px画像、サンプル/カメラ操作による上書き防止、Object URL解放成功。
- 曲げた手：実モデル写真/静止画由来VIDEO/開いた手のひら非表示/手の甲5本復帰/PNG/撮影成功。

新規描画テストは全8形×6素材の48条件の描画コマンドを変更前のdigestと比較。装飾なしの描画が同一で、指ID、部分マスク/holes、古いtextureフレーム棄却、例外時のsave/restoreも確認した。ただしコマンド比較を実写真のIoU改善や実機FPSと呼ばない。

途中で見つかった不具合（非文字列enumでの例外、花びらのCanvas状態漏れ、過大保存、分類の意図しない変更、touchcancel時のRedo喪失、透明ベースの影）を修正してから通過させた。Canvas再試行ボタンを列挙するブラウザテストのインデックスずれも修正した。

## 12. 未完了・次の実装順

| 未完了 | 次に行うこと |
|---|---|
| 実機と実動画 | まずiPhone Safari/Android Chromeで下のチェック。特に最大60パーツ時の負荷 |
| 季節・イベント・系統特集 | 実体のあるDesignDocument＋カテゴリ/編集日/説明データ、一覧/詳細、試着、保存を一組ずつ追加 |
| 同じ手で2案比較 | 同一写真/同一ポーズに2ドキュメントを描画。BeforeAfterの意味は変えず専用比較を追加 |
| 好みベース提案 | 既存診断と統合し、色/場面/パーツ/長さをルールベースで絞る。肌の確定診断はしない |
| 新着・おすすめ | 実際の追加日と編集者選定に基づく紹介。架空ランキングなし |
| サロン画像・レシピ | 現在は候補フォルダーのみ。指別仕様入り書き出しと、製品依存の硬化時間を断定しない手順を実装 |
| PWA/オフライン | 既存manifest/iconsは維持。新SWは未追加。モデル/カメラ/更新キャッシュを分離評価してから |
| 保存の拡張 | 明示JSONバックアップ/インポート、破損データの安全な復旧、旧お気に入りとの一覧統合を別段階で |
| 高度3D | 必要な視点・遮蔽の正解データとスマホ予算が得られるまでは現行Canvas近似を維持 |

これらは未完成であり、完成したUIとして空ボタンを追加していない。Phase 5を広げる前に実機ゲートを優先する。

## 13. 変更ファイル

新規：
- app/create/page.tsx、app/collections/page.tsx
- src/components/workshop/ArtworkCanvas.tsx、WorkshopEditor.tsx、WorkshopStart.tsx、WorkshopCollection.tsx、WorkshopResume.tsx
- src/lib/workshopTypes.ts、workshopData.ts、workshopDrawing.ts
- scripts/check-workshop.mjs、check-workshop-rendering.mjs、check-workshop-browser.mjs、benchmark-workshop-rendering.mjs
- このレポート

変更：
- src/lib/nailRenderer.ts、types.ts、analytics.ts
- src/components/NailStudio.tsx、SavedLooks.tsx
- app/page.tsx、privacy/page.tsx、sitemap.ts、globals.css
- package.json
- scripts/check-ad-placement.mjs、check-seo.mjs、check-seo-browser.mjs、check-site-quality-browser.mjs

MediaPipe/handTracking/One Euro/姿勢/爪fit/モデル/next.config/manifest/問い合わせ/秘密環境変数/Google確認HTML/ads.txtは変更していない。

## 14. ローカル確認と安全なPreview検証

```powershell
cd "C:\Users\nlgid\Documents\Codex\2026-05-16\new-chat\nail-fit-studio-next"
npm run build
npm run start -- --hostname 127.0.0.1 --port 4234
```

ブラウザで http://127.0.0.1:4234/create を開く。5本を編集、コレクション保存、写真で試着、再編集、PNG保存を確認する。保存一覧は /collections、旧お気に入りは /favorites、試着履歴は /history。

スマホのLAN HTTPはSecure Contextではないため、カメラが使えなくても直ちにコード不具合と判断しない。実機はHTTPSのPreviewが必要。

**今回はPreviewを作らない。** 次回、利用者がpush/Preview作成を明示承認した後、Production BranchをVercelの読み取り画面で確認し、未使用の検証用ブランチだけからPreviewを作る。Productionブランチへpush、merge、`vercel --prod`、Promoteはしない。別プロジェクト/保護されたPreviewでProduction Aliasが変わらないことを確認する。独自ドメイン不要。テスト端末は同じPreview Originを使う（ローカル保存は本番や別URLと共有されない）。

### 実機チェック（現段階では未検証）

1. 内/外カメラの許可・拒否、手の甲で5本、親指・小指、左右の手と反転。
2. 上下左右/遠近/回転/指の曲げ、手のひら非表示、再び甲で復帰。
3. カメラ中に編集を開閉し、装飾追加・コピー・Undo/Redo。映像/認識が再起動しない。
4. 収納/展開/BeforeAfter/手動調整が使え、固定ボタンが覆わない。画面回転とキーボードも確認。
5. 1/12パーツ×5本、標準/軽量で発熱・FPS・長時間メモリを測る。無理なら上限/描画方式を再評価。
6. PNGの実保存先/共有シート、写真連続選択、コレクション/旧お気に入り/履歴を再読み込み・再編集。
7. Safariの保存制限/プライベートモードで成功を偽らない。問い合わせ設定、SEO、広告除外も確認。

実機未確認の状態で本番品質達成としない。ローカルQAサーバーは作業終了時に停止する。コミットIDは作業完了報告とgit log -1で確認できる。
