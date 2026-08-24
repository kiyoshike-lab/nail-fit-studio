import type { Metadata } from "next";
import { NailStudio } from "@/components/NailStudio";

export const metadata: Metadata = {
  title: "バーチャルネイル試着",
  description: "手の写真やカメラで、ネイルの色・形・長さ・デザインを無料で試せます。",
  alternates: { canonical: "/try-on" },
};

export default function TryOnPage() {
  return <NailStudio />;
}
