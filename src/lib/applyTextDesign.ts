import { defaultDesign } from "./defaults";
import type { TextDesignSuggestion } from "./designSuggestion";
import { artOrder, upgradePaintDocument, withLayerMeta } from "./paintData";
import { patchNailDesign } from "./presetTexture";
import { createDocument, MAX_PARTS, parseDocument } from "./workshopData";
import type { NailDesign } from "./types";
import type { DesignDocument, FingerArt, NailPart } from "./workshopTypes";

function updateBase(art: FingerArt, patch: Partial<NailDesign>): FingerArt {
  if (!Object.keys(patch).length) return art;
  return { ...art, base: patchNailDesign(art.base, patch), surface: undefined };
}

// Treat the plan as an edit: keep existing layers and parts, and only upgrade
// the in-memory editable copy when an actual finger surface/part is required.
export function applyTextDesign(plan: TextDesignSuggestion, current: NailDesign, artwork: DesignDocument | null) {
  const base = Object.keys(plan.patch).length ? patchNailDesign(current, plan.patch) : current;
  if (!artwork && !plan.finger) return { design: base, artwork: null };
  const doc = artwork ?? { ...createDocument(current), name: "テキスト指定のデザイン" };
  const partStyle = plan.finger?.accent;
  const part: NailPart | undefined = partStyle && {
    id: "text-accent-" + partStyle.kind, kind: partStyle.kind,
    color: partStyle.kind === "heart" ? "#da7b98" : partStyle.kind === "pearl" ? "#fff1e6" : "#e6dff3",
    x: 0, y: .18, size: partStyle.size, rotation: 0,
  };
  const target = plan.finger && doc.fingers[plan.finger.index];
  const existing = part && target?.parts.find(p => p.id === part.id);
  if (part && target && !existing && target.parts.length >= MAX_PARTS) {
    return { error: "この指のパーツ数が上限です。エディターで空きを作ってからお試しください。" };
  }
  if (part && existing && (existing.kind !== part.kind || target?.layerMeta?.[part.id]?.locked)) {
    return { error: "この指に編集できない装飾があります。エディターで調整してください。" };
  }
  const editable: DesignDocument = plan.finger ? { ...upgradePaintDocument(doc), schema: 4 } : doc;
  const updated: DesignDocument = { ...editable, updatedAt: new Date().toISOString(), fingers: editable.fingers.map((art, i) => {
    const common = updateBase(art, plan.patch);
    if (!plan.finger || i !== plan.finger.index) return common;
    let next = updateBase(common, plan.finger.base);
    if (plan.finger.magnet) {
      next = { ...next, base: patchNailDesign(next.base, { textureUrl: undefined, pattern: "solid", material: defaultDesign.material }),
        surface: { kind: "magnet", pigment:.78, gloss:.66, roughness:.28, intensity:.76, angle:-25, grain:.42, curve:.59 } };
    }
    if (!part) return next;
    const parts = existing ? next.parts.map(p => p.id === part.id ? {...p,size:part.size} : p) : [...next.parts,part];
    return withLayerMeta({ ...next, parts, order: artOrder({ ...next, parts }) });
  }) };
  if (!parseDocument(updated)) return { error: "デザインを反映できませんでした。現在の設定はそのままです。" };
  return { design: base, artwork: updated };
}
