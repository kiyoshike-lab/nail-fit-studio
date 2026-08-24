export const SITE_NAME = "Nail Fit Studio";
export const SITE_DESCRIPTION =
  "自分の手の写真でネイルを試し、似合う色・形・デザインを見つけられる無料のバーチャルネイルサービス。";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nail-fit-studio.vercel.app").replace(/\/$/, "");

export const primaryNavigation = [
  { href: "/", label: "ホーム" },
  { href: "/try-on", label: "試着" },
  { href: "/diagnosis", label: "診断" },
  { href: "/guide", label: "ガイド" },
  { href: "/favorites", label: "保存" },
] as const;
