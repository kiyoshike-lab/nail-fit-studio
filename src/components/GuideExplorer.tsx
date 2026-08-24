"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { guideCategories, type GuideArticle } from "@/content/guides";

export function GuideExplorer({ articles }: { articles: GuideArticle[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof guideCategories)[number]>("すべて");
  const filtered = useMemo(() => articles.filter((article) => (category === "すべて" || article.category === category) && `${article.title}${article.description}`.includes(query.trim())), [articles, category, query]);

  return <><div className="guide-tools" role="search"><label><span className="sr-only">記事を検索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="形・色・シーンから検索" /></label>{guideCategories.map((item) => <button type="button" key={item} className={`filter-chip ${category === item ? "is-active" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="guide-grid">{filtered.map((article) => <Link className="guide-card" href={`/guide/${article.slug}`} key={article.slug}><span>{article.category}</span><h2>{article.title}</h2><p>{article.description}</p><small>約5分で読めます →</small></Link>)}</div>{!filtered.length && <div className="empty-panel"><h2>記事が見つかりませんでした</h2><p>別の言葉かカテゴリーでお試しください。</p></div>}</>;
}
