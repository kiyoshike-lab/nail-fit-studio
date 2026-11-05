# スマホ収納式プレビュー・お問い合わせ（実装2026-11-02 / 最終検証2026-11-05）

## 作業状態

開始時HEAD：`3713d514021a3498bd70c3a22c7104f878c226b6`。リポジトリは `kiyoshike-lab/nail-fit-studio` の `nail-fit-studio-next`。開始時ブランチ `preview/mobile-startup-3713d51` から、今回の作業用 `codex/mobile-preview-contact` を作成した。既存の未コミット `next-env.d.ts` を退避し、build後に元のバイト列へ復元し、コミット対象から除外する。元のブランチを削除・リセットしない。

2026-11-05の再開時もHEAD/ブランチ/変更内容が同じことを確認。

Gitコミットのみ。GitHub push、Vercel Preview作成、Production公開、外部アカウント作成、実メール送信はいずれも行わない。

## 1. 元のプレビュー構造

`NailStudio` がカメラstream、MediaPipe、推論、描画ループ、写真、デザイン、保存を所有し、`NailPreview` がvideo/img/Canvasとドラッグ、表示比率、固定プレビュー高さを担当していた。描画はCanvasの実表示サイズと `containRect` で変換し、推論はvideoの**実映像解像度**から入力を作る。保存は小さいプレビュー画像を引き伸ばすのではなく、元画像/動画の実解像度へ別途描画する。

この所有関係を維持する。認識/フィット/One Euro/可視性/カメラ切替のアルゴリズム、`NailStudio` 自体は変更していない。

## 2. 収納方法

900px以下だけに適用する、小さな生プレビュー（高さ84px）と通常表示の切り替え。PCの大きさ・固定配置は従来どおり。

| 状態 | 初期表示・動作 |
|---|---|
| カメラへ切り替え | 大きく表示 |
| 写真・空状態・カメラ停止 | 収納表示 |
| 同じmodeで認識結果/色/形/長さが更新 | 手動の開閉状態を保持 |
| 内外カメラ切替（modeはcameraのまま） | 手動状態を保持 |
| 別modeに切り替えた後に再起動 | 新しいmodeの初期表示に戻る |

「プレビューを広げる」「収納する」は44px以上、`aria-expanded` と `aria-controls` を持つ。収納中もvideo/img/Canvasをアンマウント・display:noneにせず表示し続ける。サムネイルを触った/スクロールしただけでは開いたり手動位置を変えたりしない。明示的なボタンだけで開閉する。比較・詳細調整時もボタンから大きくできる。

表示寸法のアニメーションは採用しない。座標変換が移行中に変動することを避け、即時切り替えとした。既存の `prefers-reduced-motion` 設定も維持する。ResizeObserverがCanvasの再描画と固定プレビューのスクロール余白を追従更新する。カメラ/トラッカーの起動停止には接続しない。

## 3. スマホ表示・入力の確認

production build + Chromeのモバイル幅/タッチ相当操作で確認。**実iPhone/Safari・Android/Chromeではない**。

| 幅×高さ | 収納stage | 展開stage（今回の縦写真） |
|---|---:|---:|
| 320×568 | 84px | 295.36px |
| 375×812 | 84px | 422.23px |
| 390×844 | 84px | 438.88px |
| 430×932 | 84px | 484.63px |

各条件で開閉、Before/After、DOM要素の同一性、色/形/長さなどの設定保持、横はみ出しなしを確認。PCでは開閉ボタンが非表示で、通常サイズのまま。既存の主要11ページ×6条件（66条件）も横はみ出し・H1・入力ラベル・操作を確認する。

試験で見つけて直した問題：

- 320pxの短い画面ではBeforeボタンが下部操作と重なりやすかった。プレビューの操作ボタンにも下端スクロール余白を追加。情報通知のトーストがタップを遮っていたため、非対話のtoastのみpointer-events:noneにした。通常スクロール/フォーカスによるhit-testで確認し、force-clickで成功扱いにしない。
- 写真の高速ドラッグが12px中6pxで中断した。イベント記録では画像の標準HTMLドラッグが始まりpointercancelになっていた。画像/videoを `draggable={false}` にして修正。座標計算の倍率や固定オフセットは変更していない。最終試験では期待した元画像座標の移動3.30152%に対し実測3.30152%。これは入力変換テストで、爪認識の精度改善値ではない。
- リリース座標の再適用も仮説として試したが中断を解消せず、採用しなかった。採用したのは確認できた標準画像ドラッグの停止のみ。

## 4. カメラ・追尾への影響

自己ホストの実MediaPipe + 手写真由来640×480 Canvas.captureStreamで、収納中も同じ1本のstreamがlive、video時刻が進み、推論成功回数が増加、5本描画を維持、エンジン初期化時刻は同一であることを確認。展開後も5本、停止後はstreamが終了し収納する。写真保存は元の384×512pxのPNGで、84pxのプレビューへ解像度を落とさない。

別の既存回帰では、写真/VIDEO/鏡像の5本、距離拡縮、移動、認識喪失→復帰、切替時の旧stream解放、開いた手のひらの非表示、曲げた爪の部分マスク、甲に戻した5本、手動/自動補正、保存/お気に入りを検証する。静止画由来VIDEOであり、実機や連続した本物の手の回転動画の合格とはしない。新しい精度/FPS向上は主張しない。

## 5. 問い合わせの現状と選択

元の窓口は公開GitHub Issuesだけ。送信処理、管理者メール、問い合わせサービスの接続設定は存在しなかった。ユーザーの回答により **Formspree** を採用したが、アカウント/実フォーム/受信先は作成・推測していない。Gitの作者メールも受信先に流用しない。

2026-11-02閲覧時の[Formspree料金表](https://formspree.io/plans)では無料枠月50件・保存履歴30日。小規模窓口向け。比較したResendは[無料枠の日次100件](https://resend.com/pricing)があるが、[送信ドメインの認証](https://resend.com/docs/send-with-phoenix)等が必要な別方式で、今回は実装しない。将来の料金・上限は管理者が改めて確認する。

**現在の実送信先は未設定。通常起動では「準備中」と表示して入力/送信を無効化し、APIも503を返す。** 未接続で成功扱いにしない。従来のGitHub窓口は、アカウントが必要で投稿は公開と明記して残している。

## 6. 新フォームと送信境界

お名前（任意）、返信先メール（返信希望時だけ）、種類（不具合/改善要望/その他）、本文（必須・最大3000文字）。日本語の入力エラー、送信中、失敗、受付成功を表示。クライアントのタイムアウトはSafari互換性を考慮してAbortControllerと解放可能なタイマーを使う。失敗時は本文を残し、成功時だけ入力を消す。二重送信は同期refで抑制する。結果不明/タイムアウト時には、到達したと断定せず再送の重複可能性を案内する。

`/api/contact` でOrigin/Host/プロトコル、JSON形式、最大16KiBのストリーム読取、入力型/文字数/メール形式、許可フィールド、honeypot、トークンの有無/長さを検査。送信先は検証済みForm IDから組む固定のFormspreeドメインだけ。利用者がto/cc/件名/添付先を指定できない。本文やメールをログ・localStorage・独自GAイベントへ記録しない。手やカメラの画像を添付する処理もない。

同一送信元チェックではNext.jsの内部Request URLがlocalhostになるケースを実際に確認したため、ブラウザOriginとHTTP Host/プロトコルを比較する。クライアントが任意指定したX-Forwarded-Hostを信頼しない。異なるOriginやcross-siteは拒否する。

## 7. スパム対策と秘密鍵

Formspree公式の[Cloudflare Turnstile連携](https://help.formspree.io/articles/form-and-project-settings/protecting-your-forms-with-cloudflare-turnstile)を使う。**秘密鍵はFormspreeの非公開CAPTCHA設定で保持**し、このNext.jsアプリにはAPI秘密鍵を収集/保存する必要がない。自サイトの環境変数はForm ID、公開Site Key、設定完了フラグのみ。秘密鍵をNEXT_PUBLIC変数やクライアント、Git、チャットへ貼らない。将来別APIの秘密鍵を扱うならサーバー専用環境変数に限定する。

トークンを標準の `cf-turnstile-response` としてFormspreeへ一度だけ渡し、サービス側で検証してもらう。自サーバーで先に消費すると再利用不能なトークンの二重検証になるため、それは行わない。CAPTCHAは問い合わせページだけに読み込み、未設定ならロードしない。期限切れ/送信後にリセット、画面を離れたらwidgetを解除する。

補助制限：プロセス内でIP等をランダムsalt付きハッシュにし、5回/10分、全体20回/分、エントリー数上限を設ける。**サーバーレスの複数インスタンスをまたぐ永続レート制限ではない。** CAPTCHAとFormspree側の制限が主対策。Form IDを隠すことだけに依存しない。Formspree側CAPTCHAは無効化しない。

設定完了フラグは管理者の確認宣言で、Formspree管理設定をAPIで自動監査した結果ではない。実際に無効トークンを拒否することを接続後に必ず確認する。モックの成功だけをスパム対策の実サービス合格とはしない。

## 8. 管理者が行う設定（今回未実施）

1. 管理者自身がFormspreeアカウントを作り、確認できる受信メールを登録・認証。新しいフォームを作成し、フォームIDを取得する。公開Issueや公開ストレージへの転送は設定せず、非公開の受信箱/通知メールを使う。名前・メールを必須にする追加ルールは設定しない。
2. Cloudflare Turnstileでwidgetを作る。利用するProduction/Previewの正確なホスト名を許可し、Site Key/Secret Keyを取得。秘密鍵はFormspreeの対象フォームで CAPTCHA有効 → Cloudflare Turnstile選択 → Secret Key登録。上記公式手順を参照。テスト用公開鍵を本番へ流用しない。
3. Vercelの対象プロジェクトの**検証用環境**に次の3項目を設定する。実値は管理者が入力し、リポジトリの `.env.example` は空欄のままにする。

```text
CONTACT_FORMSPREE_FORM_ID=（管理者の実フォームID）
CONTACT_TURNSTILE_SITE_KEY=（公開Site Key）
CONTACT_FORMSPREE_TURNSTILE_ENABLED=true
```

`true` にするのはFormspreeのCAPTCHA設定が完了してから。アプリ側のAPIキーや管理者メールの環境変数は不要。この方式では秘密鍵の保管場所はアプリの環境変数ではなくFormspreeの非公開サーバー設定になる。

4. 所有者の別承認後、Preview環境へ反映してHTTPS URLで確認。今回はpush/Preview作成もしていない。既存Productionブランチへ不用意にpushしない。
5. テスト本文を1件送り、Formspreeの非公開受信箱と通知メールの**両方**を確認する。本文だけの場合、返信先を入れた場合、期限切れ/無効なトークンの拒否、送信エラー時の文面を確認する。大量負荷試験は実Formspreeへ実施しない。

「フォーム受付成功」はサービスの受付応答であり、メールボックスへの配送や管理者の既読を証明しない。迷惑メールフォルダ、通知設定、無料枠残量も確認する。不要な問い合わせは管理画面とメールボックス両方で管理者が削除/アクセス管理する。

## 9. 実際の到達結果と検証の区別

**実メール到達：未実施。実フォームID/受信先/秘密鍵がないため接続していない。**

unitは送信関数を差し替えたモック。ブラウザ試験は別のローカルproductionサーバーでのみQA用Node preloadとwidgetスタブを使い、実APIの入力検査を通した。フォーム入力不備、providerの500/429、HTTP200だがok:false、成功応答、二重送信、失敗時本文保持、成功時クリア、ページ遷移cleanupを確認。Formspree/Cloudflareへ実問い合わせは送らない。

`scripts/lib/contact-qa-fetch.mjs` は明示的にNodeへpreloadするQA補助で、本番start/buildは読み込まない。アプリにtestmodeのクエリや送信成功を偽装する分岐を設けていない。本番へQA用起動コマンド/仮の設定値をコピーしない。

## 10. 変更ファイル

| 区分 | ファイル |
|---|---|
| 収納表示 | `src/components/NailPreview.tsx`, `src/lib/previewPresentation.ts`, `app/globals.css` |
| フォーム画面 | `app/contact/page.tsx`, `src/components/ContactForm.tsx`, `ContactChallenge.tsx` |
| サーバー/入力 | `app/api/contact/route.ts`, `src/lib/contactServer.ts`, `contactConfiguration.ts`, `contactValidation.ts` |
| 設定/説明 | `.env.example`, `app/privacy/page.tsx`, `app/sitemap.ts` |
| 回帰/QA | `package.json`, `scripts/check-preview-presentation.mjs`, `check-contact.mjs`, `check-preview-contact-browser.mjs`, `scripts/lib/contact-qa-fetch.mjs` |
| 記録 | 本書、`evaluations/mobile-preview-contact-20261102.json` |

プライバシー説明は実際の送信内容・外部サービス・非公開/公開の違いへ合わせて更新した。sitemapの変更日は今回変更した試着/問い合わせ/プライバシーだけを2026-11-02とし、未変更ガイドの更新日は維持する。

## 11. テストと残る課題

lint/typecheck、27本の既存+追加テスト、production buildを実行し、すべて成功。さらに主要ページ66レイアウト、収納/展開/元解像度保存、実モデル写真/疑似VIDEO、可視性/復旧、診断、写真連続選択、保存/お気に入り、SEO/内部リンク、GA/AdSense各1タグ、ads.txt、Google確認ファイル53バイト/HTTP200、モデルgzip配信を確認した。結果は評価JSONに記録した。

未検証：iPhone Safari/Android Chromeの実機、実際のカメラ映像、実OSの保存・共有UI、キーボード/ノッチ、実Google広告配信、実Formspree配送/CAPTCHA設定。実機では「カメラ→甲で5本→収納→色/形/長さ変更→展開→Before/After→保存→停止→再起動」、指の曲げ/手のひら/距離、回転と再訪を確認する。コンパクト化による推論FPS改善・爪の認識精度向上は報告しない。

## 12. ローカル確認・コミット

プロジェクト `C:\Users\nlgid\Documents\Codex\2026-05-16\new-chat\nail-fit-studio-next` で：

```powershell
npm run build
npm run start -- --hostname 127.0.0.1 --port 4224
```

`http://127.0.0.1:4224/try-on` と `/contact`。未設定フォームは準備中になるのが正しい。通常の開発は `npm run dev`。LANのHTTPだけではスマホカメラのSecure Context要件を満たさないことがあるため、実機カメラ検証は適切なHTTPS Previewで行う。作業後にQAサーバーを止め、コミットまでで停止する。
