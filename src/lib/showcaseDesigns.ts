import { defaultDesign } from "./defaults";
import { withLayerMeta } from "./paintData";
import { createLocalId } from "./storage";
import type { NailSurface, SurfaceKind } from "./surfaceTypes";
import type { DesignDocument, NailPart, PartKind } from "./workshopTypes";
import type { ShowcaseExample, ShowcaseId } from "./showcaseCatalog";

type Accent = [kind: PartKind, color: string, x: number, y: number, size: number];
type Tone = [color: string, kind: SurfaceKind, pigment: number, tip?: string, parts?: readonly Accent[]];
const pearl: Accent = ["pearl", "#fff0df", -.09, .22, .15];
const stone: Accent = ["crystal", "#dcd5f8", .09, .12, .14];
const smallStone: Accent = ["rhinestone", "#ffead7", .14, .29, .085];
const office: Tone = ["#b88472", "color", .58];
const jelly: Tone = ["#e9809e", "sheer", .42];
const french: Tone = ["#e3b2a3", "french", .29, "#fff4ea"];
const magnet: Tone = ["#805176", "magnet", .87, "#efb8c7"];
const gradient: Tone = ["#e3a9b0", "gradient", .22, "#d77591"];
const aurora: Tone = ["#d6bbde", "aurora", .60];
const mirror: Tone = ["#a3a3a9", "mirror", .89];
const holo: Tone = ["#a897ca", "hologram", .62];
const glitter: Tone = ["#b396bb", "glitter", .74, "#faecf7"];
const milk: Tone = ["#f0d7e4", "milky", .68];
const lilac: Tone = ["#af95c6", "milky", .69];
const wine: Tone = ["#dca8a8", "french", .39, "#6f233f"];
const beige: Tone = ["#d0a18d", "sheer", .57];
const soft: Tone = ["#c67484", "color", .7];
const charcoal: Tone = ["#36313d", "matte", .84];
const accent = ([color,kind,pigment,tip]: Tone, ...parts: Accent[]): Tone => [color,kind,pigment,tip,parts];

// Each row is thumb -> pinky. Use the same data to render the gallery assets,
// populate the editor and composite the actual try-on; no texture photographs.
const recipes: Record<ShowcaseId, readonly Tone[]> = {
  office: [office,office,office,beige,office],
  jelly: [jelly,jelly,jelly,milk,jelly],
  french: [french,french,french,french,french],
  magnet: [magnet,magnet,["#9a6387","magnet",.8,"#eacddd"],magnet,magnet],
  gradient: [gradient,gradient,gradient,gradient,gradient],
  aurora: [aurora,aurora,mirror,aurora,aurora],
  hologram: [holo,glitter,holo,glitter,holo],
  korean: [milk,lilac,milk,accent(lilac,pearl),milk],
  wonhong: [wine,accent(wine,stone,smallStone),wine,accent(wine,stone),wine],
  pearl: [beige,beige,accent(beige,pearl,smallStone),accent(french,pearl,stone),beige],
  soft: [soft,milk,soft,accent(milk,pearl),soft],
  mode: [charcoal,mirror,charcoal,["#7f6b7f","diagonal-french",.8,"#26212e"],charcoal],
};

export function createShowcaseDesign(example: ShowcaseExample): DesignDocument {
  const now = new Date().toISOString();
  return {
    schema: 4, id: createLocalId("showcase"), name: example.name, detail: "standard",
    createdAt: now, updatedAt: now,
    fingers: recipes[example.id].map(([color,kind,pigment,tipColor,accents], finger) => {
      const surface: NailSurface = {
        kind, pigment, gloss: kind === "matte" ? .08 : .67, roughness: kind === "matte" ? .93 : .28,
        intensity: kind === "magnet" ? .78 : .62, angle: -25, curve: .59, grain: .42,
      };
      const parts: NailPart[] = (accents ?? []).map(([kind,color,x,y,size], i) => ({
        id: `showcase-part-${finger}-${i}`, kind, color, x, y, size, rotation: 0,
      }));
      return withLayerMeta({
        base: { ...defaultDesign, color, tipColor: tipColor ?? "#fff1ea", shape: "squoval", length: 1, tipAmount: .23, realism: .93, thickness: .37 },
        effect: "none", opacity: 1, parts, layers: [], order: parts.map(part => part.id), surface,
      });
    }),
  };
}
