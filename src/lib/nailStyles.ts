import type { DesignDocument } from "./workshopTypes";
import { upgradePaintDocument } from "./paintData";
import type { NailSurface, SurfaceKind } from "./surfaceTypes";

// Curated suggestions, not measured popularity or claims about wear/cure time.
export const styleFacets = {
  type: { basic: "ベーシック", special: "光沢・特殊仕上げ" },
  mood: { simple: "シンプル", elegant: "上品", cute: "かわいい", cool: "クール", bold: "派手", individual: "個性的" },
  color: { pink: "ピンク", white: "白", beige: "ベージュ", blue: "青", purple: "紫", silver: "シルバー", gold: "ゴールド", clear: "クリア" },
  season: { spring: "春", summer: "夏", autumn: "秋", winter: "冬" },
  event: { date: "デート", wedding: "結婚式", graduation: "卒業式", christmas: "クリスマス", valentine: "バレンタイン", halloween: "ハロウィン", fan: "推し活", ceremony: "成人式" },
  difficulty: { beginner: "初心者向け", intermediate: "中級者向け", advanced: "上級者向け" },
  decoration: { none: "パーツなし", glitter: "ラメ", holo: "ホログラム" },
} as const;
export type StyleFacet = keyof typeof styleFacets;
export type StyleFilters = Partial<Record<StyleFacet, string>>;
export type NailStyle = { id: SurfaceKind; name: string; keywords: string; color: string; tipColor: string; surface: NailSurface; tags: Record<StyleFacet, readonly string[]>; added: string };
const surface = (kind: SurfaceKind, patch: Partial<NailSurface> = {}): NailSurface => ({ kind, pigment: .82, roughness: .24, gloss: .65, angle: -28, intensity: .55, grain: .35, curve: .6, ...patch });
const seasonal: Partial<Record<SurfaceKind, readonly string[]>> = { magnet:["autumn","winter"], "cat-eye":["autumn","winter"], mirror:["summer","winter"], chrome:["autumn","winter"], aurora:["spring","summer"], unicorn:["spring","summer"], hologram:["summer","winter"], glitter:["spring","winter"], flash:["winter"], matte:["autumn","winter"] };
function style(id: SurfaceKind, name: string, color: string, colorTag: string, mood: string[], patch: Partial<NailSurface> = {}, extra: Partial<NailStyle["tags"]> = {}): NailStyle {
  return { id, name, color, tipColor: "#fff3ee", surface: surface(id, patch), keywords: `${name} ${id} ジェル ネイル`, added: "2026-11-06", tags: { type: [id === "color" || ["sheer","clear","milky","gradient","french","reverse-french","diagonal-french","half-french"].includes(id) ? "basic" : "special"], mood, color: [colorTag], season: seasonal[id]??["spring","summer","autumn","winter"], event: ["date"], difficulty: ["beginner"], decoration: ["none"], ...extra } };
}
export const nailStyles: readonly NailStyle[] = [
  style("color", "ワンカラー", "#bd6d88", "pink", ["simple","elegant"]),
  style("sheer", "シアー", "#df9cae", "pink", ["simple","cute"], {pigment:.34}),
  style("clear", "クリアジェル風", "#f3d8d4", "clear", ["simple"], {pigment:.08,gloss:.8}),
  style("milky", "乳白ジェル風", "#f2e6dc", "white", ["elegant","cute"], {pigment:.55,roughness:.36}),
  style("gradient", "爪先グラデーション", "#d394a7", "pink", ["elegant"], {pigment:.35}, {event:["date","wedding"]}),
  style("french", "フレンチ", "#d2a49d", "beige", ["elegant","simple"], {pigment:.3}, {event:["wedding","graduation","date"]}),
  style("reverse-french", "逆フレンチ", "#cfa18b", "beige", ["individual","elegant"], {}, {difficulty:["intermediate"]}),
  style("diagonal-french", "斜めフレンチ", "#b886a6", "purple", ["cool","elegant"], {}, {difficulty:["intermediate"]}),
  style("half-french", "ハーフフレンチ", "#dcb1b2", "pink", ["simple","cute"], {pigment:.4}),
  style("magnet", "マグネット風", "#694c78", "purple", ["cool","elegant"], {}, {difficulty:["intermediate"],event:["date","ceremony"]}),
  style("cat-eye", "キャッツアイ風", "#285368", "blue", ["cool","individual"], {intensity:.75}, {difficulty:["intermediate"],event:["halloween","date"]}),
  style("mirror", "ミラー風", "#8e929b", "silver", ["bold","cool"], {pigment:.95,gloss:.8,roughness:.1}, {difficulty:["intermediate"]}),
  style("chrome", "クロム風", "#b39462", "gold", ["elegant","bold"], {pigment:.95,gloss:.75,roughness:.15}, {difficulty:["intermediate"],event:["christmas","ceremony"]}),
  style("aurora", "オーロラ風", "#d3b9d7", "purple", ["cute","elegant"], {pigment:.3}, {difficulty:["intermediate"],event:["wedding","date"]}),
  style("unicorn", "ユニコーン風", "#d898bc", "pink", ["bold","cute"], {intensity:.7}, {difficulty:["intermediate"],event:["fan","valentine"]}),
  style("hologram", "ホログラム", "#6f94c1", "blue", ["individual","bold"], {}, {decoration:["holo"],event:["fan","christmas"]}),
  style("glitter", "グリッタージェル風", "#b78c59", "gold", ["bold","elegant"], {pigment:.6}, {decoration:["glitter"],event:["christmas","ceremony"]}),
  style("flash", "フラッシュ風", "#a75982", "pink", ["bold","individual"], {intensity:.75,grain:.2}, {decoration:["glitter"],event:["fan","date"]}),
  style("matte", "マット", "#a47f78", "beige", ["simple","cool"], {roughness:1,gloss:0}),
];
const normalized = (s: string) => s.normalize("NFKC").toLocaleLowerCase("ja").replace(/[\s_-]+/g, "");
export function filterStyles(query: string, filters: StyleFilters, favorites: readonly string[], onlyFavorites: boolean, sort: "name" | "new"): NailStyle[] {
  const words = query.slice(0,120).trim().split(/\s+/).filter(Boolean).map(normalized);
  return nailStyles.filter(s => (!onlyFavorites || favorites.includes(s.id))
    && Object.entries(filters).every(([k,v]) => !v || s.tags[k as StyleFacet]?.includes(v))
    && words.every(word => normalized([s.name,s.keywords,...Object.entries(s.tags).flatMap(([k,ids]) => ids.map(id => (styleFacets[k as StyleFacet] as Record<string,string>)[id] ?? id))].join(" ")).includes(word)))
    .sort((a,b) => sort === "name" ? a.name.localeCompare(b.name,"ja") : b.added.localeCompare(a.added) || a.id.localeCompare(b.id));
}
export function applyNailStyle(doc: DesignDocument, finger: number, id: string): DesignDocument | null {
  const style = nailStyles.find(s => s.id === id); if (!style || !doc.fingers[finger]) return null;
  const next = upgradePaintDocument(doc);
  return { ...next, schema:4, fingers:next.fingers.map((f,i) => {
    if(i!==finger)return f;
    const base={...f.base,color:style.color,tipColor:style.tipColor,pattern:"solid" as const,material:"cream" as const,finish:"gloss" as const,motif:"none"};delete base.textureUrl;
    return { ...f, effect:"none", base, surface:{...style.surface} };
  }) };
}
