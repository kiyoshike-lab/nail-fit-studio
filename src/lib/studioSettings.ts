import { defaultDesign, defaultPhotoNails } from "./defaults";
import { readJson } from "./storage";
import { validBase } from "./workshopData";
import type { NailDesign, NailPose } from "./types";

export const DESIGN_KEY = "nail-fit-studio-next.design.v1";
export const NAILS_KEY = "nail-fit-studio-next.nails.v1";

// localStorage and URL parameters are untrusted, even when JSON parsing works.
// Reading never rewrites the original record or the user's saved artwork.
export function readStudioDesign(): NailDesign {
  const v = readJson<unknown>(DESIGN_KEY, null);
  if (!validBase(v)) return defaultDesign;
  return {
    color:v.color, shape:v.shape, finish:v.finish, pattern:v.pattern,
    material:v.material, motif:v.motif, motifColor:v.motifColor,
    tipColor:v.tipColor, tipAmount:v.tipAmount, length:v.length,
    thickness:v.thickness, realism:v.realism,
    ...(v.textureUrl ? { textureUrl:v.textureUrl } : {}),
    ...(v.naturalNailLength ? { naturalNailLength:v.naturalNailLength } : {}),
  };
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
function contour(v: unknown): v is {x:number; y:number}[] {
  return Array.isArray(v) && v.length >= 3 && v.length <= 512 && v.every(p => record(p) && finite(p.x,-1000,1000) && finite(p.y,-1000,1000));
}
export function validStudioNails(v: unknown): v is NailPose[] {
  return Array.isArray(v) && v.length === 5 && v.every(n => record(n)
    && finite(n.x,-1000,1000) && finite(n.y,-1000,1000)
    && finite(n.width,.001,1000) && finite(n.height,.001,1000) && finite(n.rotation,-36000,36000)
    && (n.anchorHeight === undefined || finite(n.anchorHeight,.001,1000))
    && [n.confidence,n.visibility,n.visibilityConfidence].every(c => c === undefined || finite(c,0,1))
    && (n.visibilityState === undefined || ["visible","partial","hidden","uncertain","manual"].includes(n.visibilityState as string))
    && (n.clipContour === undefined || contour(n.clipContour))
    && (n.clipHoles === undefined || Array.isArray(n.clipHoles) && n.clipHoles.length <= 32 && n.clipHoles.every(contour)));
}
export function readStudioNails(): NailPose[] {
  const v = readJson<unknown>(NAILS_KEY,null);
  return validStudioNails(v) ? v : defaultPhotoNails;
}

export function studioQueryPatch(params: URLSearchParams): Partial<NailDesign> {
  const patch: Partial<NailDesign> = {};
  const shape = params.get("shape"), pattern = params.get("pattern"), color = params.get("color");
  if (shape && ["natural","round","oval","squoval","almond","coffin","square","stiletto"].includes(shape)) patch.shape = shape as NailDesign["shape"];
  if (pattern && ["solid","gradient","french","floral","marble","patterned"].includes(pattern)) patch.pattern = pattern as NailDesign["pattern"];
  if (color && /^#[0-9a-f]{6}$/i.test(color)) patch.color = color;
  const length = params.get("length");
  if (length === "short" || length === "medium" || length === "long") patch.length = length === "short" ? .84 : length === "long" ? 1.55 : 1.08;
  const natural = params.get("naturalNailLength");
  if (natural === "auto" || natural === "short" || natural === "standard" || natural === "long") patch.naturalNailLength = natural;
  return patch;
}
