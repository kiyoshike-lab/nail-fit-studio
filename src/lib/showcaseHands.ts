import type { NailPose } from "./types";
import type { ShowcaseHand } from "./showcaseCatalog";

// Hand-reviewed root, tip and width in source-pixel coordinates. Only for the
// two specific generated demonstration images. No inference or user-photo reuse.
const width = 1122;
const height = 1402;
type Mark = [rootX: number, rootY: number, tipX: number, tipY: number, width: number];
const marks: Record<ShowcaseHand, Mark[]> = {
  linen: [
    [155, 696, 133, 587, 85], [381, 227, 373, 134, 66], [576, 148, 583, 50, 73],
    [726, 250, 739, 158, 65], [877, 424, 889, 351, 51],
  ],
  rose: [
    [921, 768, 954, 658, 78], [818, 276, 846, 185, 66], [675, 168, 699, 64, 74],
    [496, 221, 522, 125, 72], [263, 385, 277, 301, 57],
  ],
};
// Pixel outlines traced on these two curated images, not predicted boundaries.
// Applied only to unadjusted demo placement, never written to persisted poses.
const outlines: Record<ShowcaseHand, readonly (readonly [number, number][])[]> = {
  linen: [
    [[102,611],[111,599],[132,589],[150,587],[167,594],[179,610],[188,632],[192,655],[185,678],[167,692],[145,698],[132,689],[118,657],[106,629]],
    [[339,162],[350,147],[368,141],[388,143],[401,156],[409,181],[409,205],[401,220],[385,226],[368,224],[355,214],[347,192]],
    [[543,84],[552,69],[568,59],[587,56],[609,66],[616,81],[616,108],[609,132],[597,143],[576,145],[556,138],[544,121]],
    [[705,180],[716,166],[735,162],[753,167],[762,180],[763,201],[755,231],[746,241],[730,247],[713,244],[702,232],[700,209]],
    [[863,366],[874,354],[889,351],[903,357],[910,367],[907,390],[898,411],[889,421],[876,422],[862,416],[854,402]],
  ],
  rose: [
    [[913,677],[930,662],[949,658],[970,666],[981,678],[983,695],[975,721],[961,744],[940,766],[924,767],[903,750],[891,733],[893,716]],
    [[809,205],[822,194],[842,189],[858,198],[867,210],[867,227],[858,250],[846,269],[832,278],[813,272],[794,260],[790,245],[797,224]],
    [[659,92],[670,76],[685,68],[704,70],[726,83],[731,96],[726,119],[715,146],[700,163],[683,169],[659,160],[649,149],[647,129]],
    [[482,148],[495,134],[513,128],[535,136],[546,148],[548,166],[541,187],[530,205],[517,219],[498,221],[479,212],[469,199],[473,175]],
    [[250,319],[261,308],[277,307],[292,314],[299,326],[296,347],[289,368],[277,381],[265,385],[251,381],[241,372],[240,354],[244,334]],
  ],
};
export const showcaseSize = { width, height };
function handId(src?: string): ShowcaseHand | undefined {
  return src === "/assets/showcase/rose-hand-v1.webp" ? "rose" : src === "/assets/showcase/linen-hand-v1.webp" ? "linen" : undefined;
}
export function isShowcaseHand(src?: string) {
  return handId(src) !== undefined;
}

export function withShowcaseMasks(src: string | undefined, nails: NailPose[], lengths: readonly number[]): NailPose[] {
  const id = handId(src);
  if (!id) return nails;
  const original = showcaseHand(id).nails;
  return nails.map((nail, i) => {
    const prior = original[i];
    if (!prior || lengths[i] > 1 || nail.x !== prior.x || nail.y !== prior.y
      || nail.width !== prior.width || nail.height !== prior.height || nail.rotation !== prior.rotation) return nail;
    return { ...nail, clipContour: outlines[id][i].map(([x, y]) => ({ x: x / width * 100, y: y / height * 100 })) };
  });
}
export function showcaseHand(id: ShowcaseHand): { src: string; nails: NailPose[] } {
  return {
    src: `/assets/showcase/${id}-hand-v1.webp`,
    nails: marks[id].map(([x,y,tipX,tipY,w]) => ({
      x: x / width * 100, y: y / height * 100,
      width: w / width * 100, height: Math.hypot(tipX-x,tipY-y) / height * 100,
      rotation: Math.atan2(tipX-x,y-tipY) * 180 / Math.PI,
      visibility: 1, visibilityState: "manual",
    })),
  };
}
