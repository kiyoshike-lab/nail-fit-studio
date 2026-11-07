import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {importTypescript} from './lib/import-typescript.mjs';
const {resolveNailTextureUrl,isPhotoNailTexture,patchNailDesign}=await importTypescript('src/lib/presetTexture.ts');
const {defaultDesign}=await importTypescript('src/lib/defaults.ts');
const w=await importTypescript('src/lib/workshopData.ts');
const m=JSON.parse(await readFile('public/assets/preset-materials-v2.json','utf8'));
const labels=JSON.parse(await readFile('docs/preset-source-polygons-v2.json','utf8'));
const payload=JSON.parse(await readFile('public/assets/design-presets.json','utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const {presetManifestUrl}=await importTypescript('src/lib/presetTextureMap.ts');
const presetsBytes=await readFile('public/assets/design-presets.json');
assert.ok(presetManifestUrl.includes(digest(presetsBytes).slice(0,12)));assert.deepEqual(await readFile('public'+presetManifestUrl),presetsBytes);
assert.equal(m.materials.length,47); assert.equal(payload.presets.length,83);
assert.equal(new Set(m.materials.map(e=>e.id)).size,47);
assert.equal((await readdir('public/assets/preset-textures')).filter(f=>/^texture_\d{3}\.png$/.test(f)).length,47);
for(const e of m.materials){
 assert.equal(e.reviewStatus,'reviewed'); assert.ok(labels.annotations[e.id]);
 assert.ok(e.author&&e.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
 assert.match(e.license,/^CC (BY|BY-SA)|^CC0$/);assert.match(e.licenseUrl,/^https?:\/\/creativecommons\.org\/(licenses|publicdomain)\//);
 assert.equal(e.derivativeLicense,e.license);assert.ok(e.changes.includes('no generative'));
 assert.ok(e.sourceSize[0]>=e.surfaceSize[0]&&e.sourceSize[1]>=e.surfaceSize[1]);
 assert.ok(e.surfaceSize[0]>=80&&e.surfaceSize[1]>=80,'Insufficient native nail pixels: '+e.id);
 assert.equal(e.sampledPixelsInsideMask,true);
 for(const [file,hash]of [[e.texture,e.textureSha256],[e.cutout,e.cutoutSha256],[e.preview,e.previewSha256]]){
  const b=await readFile('public/'+file);assert.equal(digest(b),hash,file);assert.equal(b.subarray(1,4).toString(),'PNG');
 }
 const alias=`/assets/preset-textures/texture_${e.id}.png`,fixed=resolveNailTextureUrl(alias);
 assert.equal(fixed,'/'+e.texture);assert.equal(resolveNailTextureUrl(alias.slice(1)),fixed);
 assert.equal(resolveNailTextureUrl(`/assets/preset-textures/nail_texture_${e.id}_v2.png`),fixed);
 assert.equal(resolveNailTextureUrl(`/assets/preset-textures/nail_texture_${e.id}_v2_000000000000.png`),fixed);
 assert.ok(e.texture.includes(e.textureSha256.slice(0,12))&&e.preview.includes(e.previewSha256.slice(0,12)));
 assert.equal(digest(await readFile('public'+alias)),e.textureSha256);assert.ok(isPhotoNailTexture(alias));
 const base={...defaultDesign,textureUrl:alias};
 assert.equal(patchNailDesign(base,{length:1.8}).textureUrl,alias);
 assert.equal(patchNailDesign(base,{shape:'square'}).textureUrl,alias);
 assert.equal(patchNailDesign(base,{color:'#123456'}).textureUrl,undefined);
 assert.equal(patchNailDesign(base,{color:'#123456',textureUrl:fixed}).textureUrl,fixed);
 for(const schema of [1,2,3,4]){
  const doc=w.createDocument();doc.schema=schema;doc.fingers=doc.fingers.map(()=>({base,opacity:1,effect:'none',parts:[],...(schema>1?{layers:[],order:[]}: {}),...(schema>=3?{layerMeta:{}}:{})}));
  const restored=w.parseDocument(JSON.parse(JSON.stringify(doc)));assert.ok(restored,'legacy schema '+schema);
  assert.equal(restored.fingers[0].base.textureUrl,alias);
  assert.ok(w.patchAllBases(restored,{color:'#223344'}).fingers.every(f=>!f.base.textureUrl));
 }
}
for(const p of payload.presets){const e=m.materials.find(e=>e.texture===p.textureImage);assert.ok(e,p.id);for(const k of ['author','license','licenseUrl','sourceUrl','changes'])assert.equal(p[k],e[k]);assert.equal(p.previewImage,e.preview);}
for(const url of ['/custom/test.png','data:image/png;base64,aa','/assets/preset-textures/texture_999.png'])assert.equal(resolveNailTextureUrl(url),url);
assert.ok(!isPhotoNailTexture('/assets/preset-textures/texture_999.png'));
const {addPresetAttribution}=await importTypescript('src/lib/presetAttribution.ts');
const image=new Blob([await readFile('public/'+m.materials[0].preview)],{type:'image/png'}),originalFetch=globalThis.fetch;
let attempts=0;globalThis.fetch=async()=>++attempts===1?new Response('unavailable',{status:503}):Response.json(m);
await assert.rejects(addPresetAttribution(image,['/assets/preset-textures/texture_001.png']));
const attributed=await addPresetAttribution(image,['/assets/preset-textures/texture_001.png']);assert.equal(attempts,2);
const text=Buffer.from(await attributed.arrayBuffer()).toString('utf8');
assert.ok(text.includes('NailMaterialCredits')&&text.includes(m.materials[0].author)&&text.includes(m.materials[0].licenseUrl));
assert.equal(await addPresetAttribution(image,[]),image);globalThis.fetch=originalFetch;
console.log('PASS 47 source/asset/alias/license contracts; 83 IDs; 188 schema roundtrips; manual edits retain fit and remove photo intentionally');
