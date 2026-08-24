import { GuideAnalytics } from "@/components/GuideAnalytics";

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return <GuideAnalytics>{children}</GuideAnalytics>;
}
