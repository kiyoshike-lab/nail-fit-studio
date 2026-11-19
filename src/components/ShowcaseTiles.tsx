import Image from "next/image";
import Link from "next/link";
import { showcaseImage, showcaseUrl, type ShowcaseExample } from "@/lib/showcaseCatalog";

export function ShowcaseTiles({ examples, compact = false }: { examples: readonly ShowcaseExample[]; compact?: boolean }) {
  return <div className={`design-showcase example-grid${compact ? " example-grid-compact" : ""}`}>
    {examples.map(example => <Link href={showcaseUrl(example)} prefetch={false} className="design-tile" key={example.id}>
      <div><Image src={showcaseImage(example)} alt="" width={1122} height={1402} sizes={compact
        ? "(max-width: 560px) 44vw, 230px"
        : "(max-width: 560px) 46vw, (max-width: 900px) 29vw, 280px"} loading="lazy" /></div>
      <span>{example.category}</span><strong>{example.name}</strong>
      <small className="example-action">この作例を試す →</small>
    </Link>)}
  </div>;
}
