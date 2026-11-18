# 全機能UX監査・改修前基準（2026-11-18）

## 保護と作業範囲

専用branch `codex/ux-ui-improvements`、別worktree `C:/Users/nlgid/Documents/Codex/2026-05-16/new-chat/nail-fit-studio-ux` を `a438f47` から作成。元worktreeは `codex/nail-tail-latency` / `03a0bca` のまま。未コミットnext-env.d.tsと旧レポート2件を移動・破棄していない。

remote refとVercel APIで、既存Previewは `91d01c6` / `dpl_xXJ5WSu6jCaJKJxAjDJuuyLHnGsP`、Productionは `codex/nail-fit-studio-2` / `6875816` / `dpl_EPQiYDSLxFpRoy9q92vdiWGgmpUd` と確認。読み取りのみ。今回push・PR・デプロイは禁止。

## 実在する機能

ソース調査：14ページテンプレート、30ガイド記事、33 TSXコンポーネント。404は別途存在。素材ライブラリは**38件**、描画ツール定義は**32種**（選択を含む）、質感19種、従来装飾13種、作品の保存先分類4種。過去の依頼文の数字ではなく実コードを基準とする。

|機能群|実装と入口|監査範囲・現状|
|---|---|---|
|トップ・共通導線|Home / SiteHeader / MobileSiteNavigation / WorkshopResume|無料試着・診断・制作・前回再開・保存へのリンク。メニューの「保存」はfavorites専用|
|カメラ|NailStudio / cameraDevices / handTracking|カメラ起動停止、内外優先、複数device選択、権限エラー、GPU/CPU fallback、再試行。Camera.tsxは存在しない。実機は今回未確認|
|写真|PhotoUploader / photoPreparation|JPEG/PNG/WebP、10MB制限、連続選択対策、同一写真再選択、サンプル、カメラから固定。サンプル図は実写真認識の成功例ではない|
|手・爪|handPose / nailVisibility / nailGeometry / nailFrameRefiner / nailSmoothing|自動認識、姿勢・可視性、指別位置・サイズ・回転、自爪長。アルゴリズムは改修対象外|
|試着設定|DesignSelector / SettingsPanel|共通の色・8形状・仕上がり長・素材・模様・透明感・リアル調整、指ごと位置合わせ、リセット。自作5指デザインと共通設定の作用範囲が違う|
|プリセット・質感|DesignSelector / NailStylePanel|既存実写プリセット・互換alias、19質感、検索・分類・絞り込み・質感のお気に入り・5本適用。実写色変更時の素材解除は既存仕様|
|5指制作|WorkshopEditor / ArtworkCanvas|個別編集、基本模様、色/形/長さ、全指コピー、Undo/Redo、下書き、回復、端末内保存、試着へ反映|
|手描き・図形|NailPaintEditor / PaintCanvas|ペン・ブラシ・ドット・消しゴム・ラメ/ホロ、円/四角/ひし形等、ガイド・対称・塗り/線、正規化vector保存|
|素材・装飾|MaterialPalette / editorMaterials|検索・分類、ドラッグ、タップして配置、パーツ移動/角度/拡縮、固定/非表示、重なり順、上限処理|
|レイヤー・コピー|NailPaintEditor / paintData|名前・可視性・ロック・透明度、選択、複製、コピー/貼付、全指コピー、削除、Undo/Redo。数値の直接入力は未実装でrange主体|
|表示・入力|PaintViewControls / usePaintViewport / usePaintFocus|拡大縮小button、1本指描画/移動、2本指pan/pinch、拡大専用画面、focus trap、visualViewport対応。ホイールズームは未実装|
|保存|WorkshopCollection / SavedLooks / storage / workshopRecovery|自作コレクション、お気に入り、履歴、質感お気に入り、一時退避は別データ。schema 1–4。PNG保存/可能なら共有。自作コレクションは削除確認あり、旧お気に入り/履歴はなし|
|診断|DiagnosisQuiz|質問・戻る・結果・再開・試着連携。結果タグの一部は英語|
|ガイド|GuideExplorer / guide pages|30記事、検索・カテゴリ、関連記事・試着リンク。実ブラウザは代表記事を確認|
|信頼・外部|contact / about / editorial-policy / privacy / terms|Formspree/Turnstile、入力検証・エラー・fail-closed、GitHub窓口、端末データ管理。Previewは送信不可を維持。実到達・本番広告は未確認|

## 実ブラウザ基準

ローカルproduction buildをPreview安全設定で実行。headless desktop Chrome、viewport 320/375/390/430/1280、height 900。15経路（主要ページ、代表記事、404）×5幅＝75表示。全てpage横はみ出しなし、page error 0、外部request 0。モバイル実機・実ユーザー調査ではない。

|検証経路・指標|改修前の実測|注意|
|---|---|---|
|作品保存→共通「保存」→再編集|create→favorites→home→collections→createの4リンク操作/4遷移。favoritesには作品もcollectionsリンクもない|直接collectionリンクを知っていれば2操作。4が全経路の最小値だとは主張しない|
|PCでキャンバスへ戻った時のツール選択|1280×900で上端889.3/下端933.3px、画面内に収まらない|PC用横パネル候補|
|スマホ相当の同操作|390×900で上端930.3/下端974.3px、画面外|クイック操作・コンパクトパネル候補|
|ブラシ→移動→描く|ペンへ戻る|PaintViewControlsの固定pen指定。既存作品の破損ではなく、操作のやり直し負担|
|旧お気に入りの削除|1クリック、確認0、Undoなし。390/1280両方で再現|データを失う操作として最優先で統一|
|模擬カメラ拒否の説明|表示幅233pxに本文503px、nowrapの省略あり|復帰方法の末尾が読めない。拒否自体は正常処理|
|FAQ summary|高さ27.2px|44px目標に不足|
|PC指tab|一部43×44px|1px差だけを重大問題としない|
|スマホ記事フィルタ|狭幅で一部が約42–43px幅、約126.8px高|日本語が縦に折れ、toolbarが大きい|

操作回数はアプリ上のリンク/コントロール操作数。スクロール、OS picker内操作、待機は除外。実ユーザーの操作時間・誤操作率・満足度は計測していない。閉じたdetails内の非表示controlはtap target評価から除外した。最初の監査scriptでexact-label selectorが合わなかった点はscriptだけ修正し、再実行して完了。アプリの不具合へ読み替えていない。

## 優先順位と段階改修

|優先度|問題/改善|影響・コスト|予定phase|
|---|---|---|---|
|高|旧保存データの誤削除防止|破壊的操作。既存保存形式を変えず確認を追加、小|2|
|高|作品/お気に入り/履歴の保存導線の明確化|初回ユーザーの再編集。既存routeをつなぐ、小|2|
|高|PCキャンバスと設定の往復|主要編集。DOM配置/CSS、中|3|
|高|スマホのツール切替・設定往復|描く/消す/色変更。クイック操作とbounded panel、中|3|
|高|カメラ失敗時の説明切れ|次の行動が分からない。UI表示のみ、小|4|
|中|指別と全指適用の区別|作品を意図せず上書き。作用範囲ラベル、小|3/4|
|中|ブラシ・図形の直前選択の維持|反復操作。session UI stateのみ、小|3|
|中|数値微調整とkeyboard範囲|PC精密編集。既存rangeを残す、入力中Undo競合の防止、中|3|
|中|FAQ/フィルタ/選択状態の統一|共通の操作性。小|2|
|中|写真差し替え、PNGと作品保存の区別|入口/保存先を明確化。小|4|
|低/保留|ホイールズームの新規実装|browser zoom/ページscrollとの競合。必要性を再評価|今回必須にしない|
|保留|保存方式統合、新しい描画基盤、認識モデル|大規模・回帰リスク。本件では実装しない|対象外|

利用者は **PC横パネル／スマホはコンパクトパネル** を選択済み。まずphase2の共通改善を検証し、次にphase3、最後にphase4と総合検証へ進む。既存pointer座標変換・ジェスチャー・Canvas描画・認識は原則そのまま使う。

## Phase1の検証結果と未検証

lint / typecheck / npm test（38 scripts）/ build：PASS。既存 `check-paint-navigation-browser.mjs`：35 navigation/layout groups PASS。2本指gestureや拡大座標は既に動いている部分として保護し、問題があると決めつけて書き直さない。

56回帰、217描画条件、写真76組、移動拡縮240フレームは**今回の最終改修後に再実行する予定**。前回の成功記録を今回実行済みと記載しない。性能・memoryの前後比較と比較画像の「後」は未作成。スマホ実機/実カメラ、Formspree到達、本番広告配信も未検証。

raw証跡：`C:/Users/nlgid/.codex/visualizations/2026/05/16/019e3149-2c2f-7ce2-a154-da042e23465d/ux-audit-20261118`。`source-inventory.json`、`browser/result.json`、`browser/paint-baseline-1280.png`、`browser/paint-baseline-390.png`、`gesture-baseline.json`、各command logに保存。これらは公開assetではない。

## Phase2完了
保存種別navと選択表示、旧お気に入り/履歴の削除確認・cancel時focus復帰、トップの制作入口、FAQ/フィルタ/sliderの操作領域を追加。既存route/保存key/schemaは変更なし。lint/typecheck/npm test/test:ux/build PASS。新UX browser 5 viewport groups PASS、既存site quality 13ページ×6レイアウト・操作回帰 PASS。外部送信・公開なし。

## Phase3完了
PCはCanvasと横設定パネル、スマホはクイック設定と高さを制限した詳細欄へ整理。選択中の指を明示し、描画／移動切替後に前のブラシ・図形を復帰。選択オブジェクトの数値入力はblur/Enterで1回確定し、入力中のUndoと作品Undoを分離した。描画・座標変換・保存schemaは変更なし。

新UX 10 viewport groups、既存35 navigation/layout groups PASS。既存テストが発見した小画面のCanvas圧迫を修正（操作欄を短縮し、短いvisualViewportではモーダル内をスクロール）。閾値緩和や内部解像度低下はしていない。lint警告も解消。typecheck/test:ux/npm test/build PASS。最終コードで全回帰と画素一致を再実行する。

## Phase4完了
カメラ未起動／認識初期化失敗時の復帰文を省略せず表示、写真差替えラベルと持続する入力エラー、PNG画像保存と作品保存の区別、選択した指だけの数値調整を追加。NailStudioの変更はPhotoUploaderへのmode propのみ。既存カメラ／写真request revision、認識、追尾、手動補正関数をそのまま利用。

新UX 15 viewport groups、lint/typecheck/npm test/test:ux/build PASS。75画面表示の再監査で横overflow・page error・外部requestは0。保存後の共通nav経由再編集は4→3リンク操作、直接既知のcollectionリンクなら従来どおり2。削除は意図的に1→2操作（確認追加）。写真再選択とPNG download eventも確認。実機／実メール到達は未確認。

新テストの最初の失敗は、既存の初期選択が人差し指なのに親指を仮定したこと、および400ms保存debounceより早い150msでstorageを読んだこと。テストを実仕様に合わせ、選択指を明示し保存値を待機した。製品ロジックやタイミングの閾値は変更しない。
