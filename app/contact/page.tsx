import type { Metadata } from "next";

export const metadata: Metadata = { title: "お問い合わせ", description: "Nail Fit Studioへのご意見・不具合報告の窓口です。", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return <main className="content-page"><header className="content-hero"><p className="eyebrow">CONTACT</p><h1>お問い合わせ</h1><p>不具合、ご意見、掲載内容についてのご連絡を受け付けています。</p></header><div className="prose"><h2>GitHubから連絡する</h2><p>現在は送信先未設定のフォームを置かず、実際に確認できるGitHub Issuesを窓口にしています。画像を添付する場合は、顔、住所、通知、写真の位置情報など個人情報が写っていないか確認してください。</p><p><a className="button primary" href="https://github.com/kiyoshike-lab/nail-fit-studio/issues/new" target="_blank" rel="noreferrer">お問い合わせを作成する</a></p><h2>不具合報告にあると助かる情報</h2><ul><li>利用端末（例：iPhone 15、Android）</li><li>ブラウザ名</li><li>どの操作で問題が起きたか</li><li>エラーメッセージ（表示された場合）</li></ul><p className="notice">手の写真や個人を特定できる情報は、必要がない限り公開のIssueへ投稿しないでください。</p></div></main>;
}
