import { pageMetadata } from "@/lib/seo";
import { NailStudio } from "@/components/NailStudio";

export const metadata = pageMetadata("ネイルシミュレーター｜写真・カメラで無料試着", "自分の手の写真やカメラでネイルを無料シミュレーション。色・形・長さやデザインを変えて比較し、気に入った試着画像を保存できます。アプリ不要。", "/try-on");

export default function TryOnPage() {
  return <NailStudio />;
}
