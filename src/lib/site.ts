export const SITE_NAME = "Nail Fit Studio";
export const SITE_DESCRIPTION =
  "ネイルをする前に、自分の手で似合うデザインをチェック。Nail Fit Studioは、写真やカメラでネイルの色・形・長さを無料で試せるサイトです。アプリのインストール不要で、スマホから気軽にお試しできます。";
export const HOME_TITLE = "無料ネイル試着｜写真・カメラで似合うネイルをお試し - Nail Fit Studio";
export const SHARE_TITLE = "無料でネイル試着！自分の手で似合うデザインを探そう｜Nail Fit Studio";
export const SHARE_DESCRIPTION = "写真やカメラでネイルをお試し。色・形・長さを自由に変えて、自分に似合うデザインを見つけよう。無料・アプリ不要。";
// Editorial dates of unchanged guide articles remain separate from this SEO release.
export const SEO_UPDATED_AT = "2026-10-30";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nail-fit-studio.vercel.app").replace(/\/$/, "");

export const primaryNavigation = [
  { href: "/", label: "ホーム" },
  { href: "/try-on", label: "試着" },
  { href: "/diagnosis", label: "診断" },
  { href: "/guide", label: "ガイド" },
  { href: "/favorites", label: "保存" },
] as const;
