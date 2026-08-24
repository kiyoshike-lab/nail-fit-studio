import type { Metadata } from "next";

export const metadata: Metadata = { title: "プライバシーポリシー", description: "画像、端末内保存、Cookie、Google Analytics、広告の取り扱いについて。", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return <main className="content-page"><header className="content-hero"><p className="eyebrow">PRIVACY</p><h1>プライバシーポリシー</h1><p>最終更新日：2026年8月24日</p></header><div className="prose"><h2>アップロード画像</h2><p>試着に使用する手の写真とカメラ映像は、現在の実装では利用者のブラウザ内で処理されます。Nail Fit Studioのサーバーへアップロードまたは保存しません。保存ボタンで作成した画像は利用者の端末へ保存・共有されます。</p><h2>端末内の保存</h2><p>デザイン設定、爪位置、お気に入り、試着履歴、最後の診断結果をlocalStorageへ保存する場合があります。手の元画像を履歴として大量に保存することはありません。ブラウザのサイトデータ削除機能で消去できます。</p><h2>Cookieとアクセス解析</h2><p>利用状況を把握し改善するため、Google Analyticsを利用する場合があります。送信するイベントに手の画像、ファイル名、個人を直接特定する情報は含めません。ブラウザ設定やGoogleの提供する方法で計測を制限できます。</p><h2>広告配信</h2><p>Google AdSenseを利用する場合、Googleなどの第三者配信事業者がCookieを使用し、過去のアクセス情報に基づいて広告を配信することがあります。広告は主に読み物ページへ配置し、写真アップロードや試着操作の画面には配置しません。</p><h2>第三者サービス</h2><p>手のランドマーク認識に必要な実行ファイルを外部配信元から読み込む場合があります。お問い合わせにはGitHubを利用します。各サービスに送られる情報は、それぞれのプライバシーポリシーに従います。</p><h2>変更とお問い合わせ</h2><p>機能や法令の変更に合わせて本ポリシーを更新することがあります。内容についての連絡はお問い合わせページの窓口をご利用ください。</p></div></main>;
}
