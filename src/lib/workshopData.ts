import { defaultDesign } from "./defaults";
import { createLocalId, tryWriteJson } from "./storage";
import { collectionNames, partNames, type CollectionEntry, type CollectionKind, type DesignDocument, type FingerArt, type NailPart, type LayerState } from "./workshopTypes";
import type { NailDesign } from "./types";
import { parsePaintLayers } from "./paintData";
import { parseSurface } from "./surfaceTypes";

export const WORKSHOP_DRAFT = "nail-fit-studio-next.workshop-draft.v1";
export const WORKSHOP_LIBRARY = "nail-fit-studio-next.workshop-library.v1";
export const MAX_PARTS = 12;
const oneOf = (v: unknown, values: readonly string[]): v is string => typeof v === "string" && values.includes(v);
const color = (v: unknown): v is string => typeof v === "string" && /^#[a-f0-9]{6}$/i.test(v);
const range = (v: unknown, a: number, b: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= a && v <= b;
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
function boundedWrite(key: string, value: unknown): boolean {
  // Never write a payload that our bounded reader would later refuse to open.
  return JSON.stringify(value).length <= 700_000 && tryWriteJson(key, value);
}
export function safeTexture(v: unknown) { return v === undefined || (typeof v === "string" && /^\/assets\/preset-textures\/[a-z0-9_.-]+\.(png|webp|jpe?g)$/i.test(v)); }

export function validBase(v: unknown): v is NailDesign {
  if (!record(v)) return false;
  return color(v.color) && color(v.tipColor) && color(v.motifColor)
    && oneOf(v.shape, ["natural", "round", "oval", "squoval", "almond", "coffin", "square", "stiletto"])
    && oneOf(v.finish, ["gloss", "sheer", "pearl", "chrome", "sparkle"])
    && oneOf(v.pattern, ["solid", "gradient", "french", "floral", "marble", "patterned"])
    && oneOf(v.material, ["cream", "jelly", "glitter", "metallic", "shimmer", "sheer"])
    && typeof v.motif === "string" && v.motif.length <= 80 && safeTexture(v.textureUrl)
    && range(v.length, .75, 2.5) && range(v.tipAmount, .08, .55) && range(v.thickness, 0, 1) && range(v.realism, 0, 1)
    && (v.naturalNailLength === undefined || oneOf(v.naturalNailLength, ["auto", "short", "standard", "long"]));
}
export function parseDocument(v: unknown): DesignDocument | null {
  if (!record(v) || ![1,2,3,4].includes(v.schema as number) || !text(v.id, 120) || !text(v.name, 80) || !date(v.createdAt) || !date(v.updatedAt)
    || !oneOf(v.detail, ["standard", "light"]) || !Array.isArray(v.fingers) || v.fingers.length !== 5) return null;
  const fingers: FingerArt[] = [];
  const modern = v.schema===3 || v.schema===4;
  for (const f of v.fingers) {
    if (!record(f) || !validBase(f.base) || !range(f.opacity, 0, 1) || !oneOf(f.effect, ["none", "dots", "lines", "magnetic"]) || !Array.isArray(f.parts) || f.parts.length > MAX_PARTS) return null;
    const ids = new Set<string>();
    if (v.schema!==4 && f.surface!==undefined) return null;
    const surface = f.surface===undefined ? undefined : parseSurface(f.surface);
    if (surface===null) return null;
    for (const p of f.parts) {
      if (!record(p) || !text(p.id, 120) || ["__proto__","prototype","constructor"].includes(p.id) || ids.has(p.id) || !(typeof p.kind === "string" && Object.hasOwn(partNames, p.kind)) || !color(p.color)
        || !range(p.x, modern?-.7:-.45, modern?.7:.45) || !range(p.y, modern?-.7:-.45, modern?.7:.45) || !range(p.size, .06, .6) || !range(p.rotation, -180, 180)) return null;
      ids.add(p.id);
    }
    const layers = v.schema!==1 ? parsePaintLayers(f.layers,modern) : undefined;
    if (v.schema===1 && (f.layers!==undefined || f.order!==undefined)) return null;
    if(!modern && f.layerMeta!==undefined)return null;
    if(v.schema!==1){
      if(!layers || !Array.isArray(f.order)) return null;
      for(const layer of layers){if(ids.has(layer.id))return null;ids.add(layer.id);}
      if(f.order.length!==ids.size || new Set(f.order).size!==ids.size || !f.order.every(id=>typeof id==="string"&&ids.has(id)))return null;
    }
    let layerMeta:Record<string,LayerState>|undefined;
    if(modern){
      if(!record(f.layerMeta)||Object.keys(f.layerMeta).length!==ids.size)return null;
      const entries:[string,LayerState][]=[];
      for(const id of ids){const m=Object.hasOwn(f.layerMeta,id)?f.layerMeta[id]:null;
        if(!record(m)||!text(m.name,64)||typeof m.visible!=="boolean"||typeof m.locked!=="boolean"||!range(m.opacity,0,1))return null;
        entries.push([id,{name:m.name,visible:m.visible,locked:m.locked,opacity:m.opacity}]);
      }layerMeta=Object.fromEntries(entries);
    }
    // Copy only the defined schema: do not retain arbitrary objects/URLs.
    const b = f.base;
    fingers.push({ base: { color:b.color, shape:b.shape, finish:b.finish, material:b.material, pattern:b.pattern, motif:b.motif, motifColor:b.motifColor, tipColor:b.tipColor, tipAmount:b.tipAmount, length:b.length, thickness:b.thickness, realism:b.realism, ...(b.textureUrl ? {textureUrl:b.textureUrl}:{}), ...(b.naturalNailLength ? {naturalNailLength:b.naturalNailLength}:{}) }, opacity:f.opacity, effect:f.effect as FingerArt["effect"], parts:f.parts.map(p => ({id:p.id,kind:p.kind,color:p.color,x:p.x,y:p.y,size:p.size,rotation:p.rotation} as NailPart)),...(v.schema!==1?{layers:layers!,order:[...f.order as string[]]}:{}),...(layerMeta?{layerMeta}:{}),...(surface?{surface}:{}) });
  }
  return { schema:v.schema as DesignDocument["schema"],id:v.id,name:v.name,createdAt:v.createdAt,updatedAt:v.updatedAt,detail:v.detail as DesignDocument["detail"],fingers };
}
export function createDocument(base: NailDesign = defaultDesign): DesignDocument {
  const safe = validBase(base) ? base : defaultDesign;
  const now = new Date().toISOString();
  return { schema:1,id:createLocalId("design"),name:"マイネイル",createdAt:now,updatedAt:now,detail:"standard",fingers:Array.from({length:5},()=>({base:{...safe},opacity:1,effect:"none",parts:[]})) };
}
export function patchAllBases(doc: DesignDocument, patch: Partial<NailDesign>): DesignDocument {
  // Explicit legacy finish/pattern/texture choices must remain functional, not
  // be silently hidden under a newer procedural finish. Color/fit edits keep it.
  const legacySurface = ["finish","material","pattern","textureUrl"].some(k=>Object.hasOwn(patch,k));
  return { ...doc, updatedAt:new Date().toISOString(), fingers:doc.fingers.map(f=>({...f,base:{...f.base,...patch},...(legacySurface&&f.surface?{surface:undefined}:{})})) };
}
export type DocumentHistory = { past: DesignDocument[]; present: DesignDocument; future: DesignDocument[] };
export function historyChange(h: DocumentHistory, next: DesignDocument): DocumentHistory { return {past:[...h.past,h.present].slice(-40),present:next,future:[]}; }
export function historyUndo(h: DocumentHistory): DocumentHistory { return h.past.length ? {past:h.past.slice(0,-1),present:h.past.at(-1)!,future:[h.present,...h.future].slice(0,40)} : h; }
export function historyRedo(h: DocumentHistory): DocumentHistory { return h.future.length ? {past:[...h.past,h.present].slice(-40),present:h.future[0],future:h.future.slice(1)} : h; }

function readValue(key: string): {ok:boolean; value:unknown} {
  if (typeof window === "undefined") return {ok:true,value:null};
  try { const raw=window.localStorage.getItem(key); if (raw && raw.length>700_000) return {ok:false,value:null}; return {ok:true,value:raw?JSON.parse(raw):null}; } catch { return {ok:false,value:null}; }
}
export function readWorkshopLibrary(): {ok:boolean; entries:CollectionEntry[]} {
  const data=readValue(WORKSHOP_LIBRARY);
  if (!data.ok) return {ok:false,entries:[]};
  if (data.value===null) return {ok:true,entries:[]};
  if (!record(data.value) || data.value.schema!==1 || !Array.isArray(data.value.entries) || data.value.entries.length>40) return {ok:false,entries:[]};
  const entries: CollectionEntry[]=[];
  for (const entry of data.value.entries) { if (!record(entry) || !(typeof entry.folder === "string" && Object.hasOwn(collectionNames,entry.folder))) return {ok:false,entries:[]}; const document=parseDocument(entry.document); if(!document) return {ok:false,entries:[]}; entries.push({folder:entry.folder as CollectionKind,document}); }
  if (new Set(entries.map(e=>e.document.id)).size!==entries.length) return {ok:false,entries:[]};
  return {ok:true,entries};
}
export function saveWorkshopDocument(document:DesignDocument, folder:CollectionKind="created"):boolean {
  const parsed=parseDocument(document), existing=readWorkshopLibrary();
  if(!parsed || !existing.ok || !Object.hasOwn(collectionNames,folder)) return false;
  const other=existing.entries.filter(e=>e.document.id!==parsed.id);
  if(other.length>=40) return false; // Never silently evict another design.
  return boundedWrite(WORKSHOP_LIBRARY,{schema:1,entries:[{folder,document:parsed},...other]});
}
export function deleteWorkshopDocument(id:string):boolean {
  const existing=readWorkshopLibrary();return existing.ok && boundedWrite(WORKSHOP_LIBRARY,{schema:1,entries:existing.entries.filter(e=>e.document.id!==id)});
}
export function readWorkshopDraft(): {ok:boolean; document:DesignDocument|null} {
  const raw=readValue(WORKSHOP_DRAFT); const document=parseDocument(raw.value);
  return {ok:raw.ok&&(raw.value===null||!!document),document};
}
export function saveWorkshopDraft(document:DesignDocument):boolean {
  const parsed=parseDocument(document);return !!parsed && readWorkshopDraft().ok && boundedWrite(WORKSHOP_DRAFT,parsed);
}
export function findWorkshopDocument(id:string) { return readWorkshopLibrary().entries.find(e=>e.document.id===id)?.document??null; }
// Legacy v1 records remain in place. Import only after an explicit restore.
export function documentFromLegacy(design:unknown) {
  if(!record(design)) return null;
  const base={...design,textureUrl:safeTexture(design.textureUrl)?design.textureUrl:undefined};
  return validBase(base)?createDocument(base):null;
}
