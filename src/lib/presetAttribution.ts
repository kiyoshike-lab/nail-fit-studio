import { isPhotoNailTexture, resolveNailTextureUrl } from "./presetTexture";

type Credit = { texture: string; author: string; sourceUrl: string; license: string; licenseUrl: string; changes: string };
let creditsPromise: Promise<Credit[]> | undefined;
function credits() {
  return creditsPromise ??= fetch("/assets/preset-materials-v2.json").then(async response => {
    if (!response.ok) throw new Error("Material credits unavailable");
    const payload = await response.json() as { materials: Credit[] };
    return payload.materials;
  }).catch(error => { creditsPromise = undefined; throw error; });
}

// PNG iTXt supports Unicode author names. Inserting before IEND preserves every
// image pixel and output dimensions; no footer over the user's hand photograph.
export async function addPresetAttribution(blob: Blob, textureUrls: (string | undefined)[]): Promise<Blob> {
  const urls = [...new Set(textureUrls.filter((url): url is string => isPhotoNailTexture(url)).map(resolveNailTextureUrl))];
  if (!urls.length) return blob;
  const all = await credits();
  const selected = urls.map(url => {
    const entry = all.find(e => "/" + e.texture === url);
    if (!entry?.author || !entry.sourceUrl || !entry.licenseUrl) throw new Error("Material credit missing");
    const { author, sourceUrl, license, licenseUrl, changes } = entry;
    return { author, sourceUrl, license, licenseUrl, changes };
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes[0] !== 137 || bytes[1] !== 80 || bytes.length < 20) throw new Error("Invalid PNG");
  let end = 8;
  const view = new DataView(bytes.buffer);
  while (end + 12 <= bytes.length && String.fromCharCode(...bytes.slice(end+4,end+8)) !== "IEND") end += view.getUint32(end) + 12;
  if (end+12 !== bytes.length) throw new Error("Missing PNG end chunk");
  const payload = new TextEncoder().encode("NailMaterialCredits\0\0\0\0\0" + JSON.stringify({
    scope: "Nail surface derivatives only; original photo and user artwork rights are not assigned by this notice.",
    derivatives: selected,
  }));
  const chunk = new Uint8Array(payload.length + 12);
  const cv = new DataView(chunk.buffer); cv.setUint32(0,payload.length);
  chunk.set([105,84,88,116],4); chunk.set(payload,8);
  let crc = 0xffffffff;
  for (const byte of chunk.slice(4,-4)) {
    crc ^= byte;
    for (let bit=0;bit<8;bit++) crc = (crc>>>1) ^ (crc&1 ? 0xedb88320 : 0);
  }
  cv.setUint32(chunk.length-4,(crc^0xffffffff)>>>0);
  return new Blob([bytes.slice(0,end),chunk,bytes.slice(end)],{type:"image/png"});
}
