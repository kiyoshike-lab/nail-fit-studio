# 旧実写プリセット：爪だけの素材への再選定・再生成（着手済み、未完了）

## 公開を止める理由

最終QA中、旧`texture_001.png`を見たところ、爪/肌/背景の32pxパッチを並べた画像だった。生成元の旧HTMLプロジェクトの`ai-research/tools/generate_preset_nail_textures.py`も、写真全体の色候補からランダムな32pxパッチを敷き詰める処理だった。**爪セグメンテーションではない。**

Next.js側は`NailStudio.selectPreset`から`textureImage`をそのまま使い、Canvasに重ねていた。実ブラウザで旧プリセットを選択して確認し、実際に5本へモザイクを描画することを再現した。既存の19質感/38素材の正常さや、ファイルHTTP200/決定的な描画と、この見た目の正しさは別の問題である。

- 旧カタログは**83プリセット設定、47の写真元/テクスチャ**。83枚の独立した爪写真ではない。
- `real_`の通番と`design_`画像の番号は同じではない（欠番後のずれ＋後から作られた派生設定）。`exampleImage`で対応付ける。番号だけを頼りに置換しない。
- `legacy-materials/result.json`：見本/テクスチャ94ファイルはHTTP200だが、既知の不適切画像が実際に使われている。`--strict`は意図どおりexit1。このP1が残るので公開判定は**NO-GO**。

証拠の絶対ルート：`C:\Users\nlgid\.codex\visualizations\2026\05\16\019e3149-2c2f-7ce2-a154-da042e23465d\release-qa-20261106`。
`legacy-materials/legacy-applied.png`（実際のrenderer）、`legacy-texture-atlas.png`（47素材）、`sources-0.png`〜`sources-3.png`（写真元）を保管した。

## 利用者と合意した方針

2026-11-07、利用者は「写真を参考に色/質感だけへ退避」ではなく、**爪だけの素材を再選定・再生成する**方針を選択した。勝手に写真再現機能を削除したり、配色提案だけを写真再現と呼ぶことはしない。

評価が不十分なAIモデルは追加しない。最初は元写真の1本の爪を明示的なpolygonで切り出す。ランダムなパッチ、背景の混入、生成AIによる架空の模様、アップスケールによる偽の高精細化は行わない。

## 今回作成したもの

- `scripts/build-reviewed-nail-materials.py`：source SHA256・EXIF回転後のサイズ・polygon範囲・最小面積・爪先/根元を検証。単一爪だけを透過PNGへ切り抜き、爪先を上へ回転。画像外のRGBはゼロ。未承認のものを`public/`へ出せない。
- `docs/preset-material-review.json`：元画像・作者・ライセンス・原寸のpolygon・爪先/根元・SHA256。**candidateのままで、承認済みではない**。
- `docs/preset-material-workboard.json`：47写真元/83設定の対応、元URL、再確認済みライセンス、要再選定理由を記録。瓶/売り場/彫刻などの9件は近接爪写真の再選定が必要。残りも1本ずつ選択する。
- 2つの権利元を再確認し、Commonsの**原寸画像**を各1回取得。EXIFを補正し、3候補を生成した。手の写真や背景のパッチを模様へ使っていない。

|候補|写真元/作者・出典|ライセンス|
|---|---|---|
|フレンチ / ラメ|[French Manicure with Glitter nail art on ring finger / Theknowhau](https://commons.wikimedia.org/wiki/File:French_Manicure_with_Glitter_nail_art_on_ring_finger.jpg)|CC BY-SA 4.0|
|青紫の花柄|[Polished purple nails with nail art on / Köttbulleledaren](https://commons.wikimedia.org/wiki/File:Polished_purple_nails_with_nail_art_on.jpg)|CC BY-SA 4.0|

切り抜き・回転・透過化を変更点としてPNGとmanifestへ付記し、[素材のライセンス](https://creativecommons.org/licenses/by-sa/4.0/)を記録した。アプリコード自体のライセンスと写真素材の条件を混同しない。

候補の場所：上記証拠ルートの`material-candidates-original/`。小さいサムネイル由来の試作は`material-candidates/`、再生成した原寸由来は`material-candidates-original/`として区別する。配布用素材を増やしたわけではなく、どちらもローカル検証用。

## テストと現時点の進捗

- 原寸2写真のsource SHA/向き/サイズを検証。3PNGの再生成バイト一致、RGBA透明領域、未承認public書込拒否、変更されたsource hash/不正polygonの拒否を確認する。
- **ドラフト3候補、元写真2/47件。公開用置換は0/47件。** 残45写真元の選択、原寸入手、権利情報再確認、マスク/爪先方向の確認が未完了。
- 83設定の移行・旧保存データのURL解決、新素材と実際の爪輪郭のマッピング、フレンチの爪先位置、カメラ/写真での最終描画は**未完了**。候補のPNGが良く見えるだけでサイト修正済みとはしない。
- 本番のプリセットJSON/PNG/rendererをまだ変更していない。認識・追尾を維持するため、未評価の素材を一部だけ本番処理へ混ぜない。

## 続きの採用ゲート

1. この3候補を元画像と比較し、爪の形/根元/爪先・柄の欠落を確認。切り出し方を固める。
2. 47写真元を1件ずつ選別。爪がない/小さすぎる/不鮮明な画像は、権利の確認できる爪写真に再選定する。同じ写真を水増しして「別素材数」と呼ばない。
3. 各元画像とマスク・原寸PNG・作者/出典/変更点を対応させる。83設定の既存IDと保存スキーマを保持する。
4. 表示範囲へ連続的に変形し、爪先だけ白い柄の向き/根元位置/輪郭のクリップが正しいか確認。ランダムパッチに戻す生成は採用しない。
   現行描画の1.25倍coverと指ごとのdrift、追加の手続き模様をそのまま使うと、新しいフレンチ先端や花柄を切ったり重ねたりする可能性がある。PNG差し替えだけで完了とはしない。必要なら写真の複数爪を既存の5本個別スキーマへ対応させる。これらはまだ実装していない。
5. **全件の目視＋写真/疑似VIDEO・実機・保存/再編集・速度を再確認してから**素材を更新し、総合QAをやり直す。既知の不合格素材を検出するrelease gateだけでは新素材の画質は保証しない。

この作業は現在進行中の候補準備までであり、「全素材の修正完了」「公開可能」とは報告しない。push/PR/Preview/本番公開も行っていない。
