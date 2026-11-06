import assert from 'node:assert/strict';
import {importTypescript} from './lib/import-typescript.mjs';
const {readStudioDesign,readStudioNails,validStudioNails,studioQueryPatch,DESIGN_KEY,NAILS_KEY}=await importTypescript('src/lib/studioSettings.ts');
const {defaultDesign,defaultPhotoNails}=await importTypescript('src/lib/defaults.ts');
const {readDiagnosisResult,STORAGE_KEYS}=await importTypescript('src/lib/storage.ts');
const data=new Map();globalThis.window={localStorage:{getItem:k=>data.get(k)??null,setItem(){throw Error('Reader must never write');}}};
const diagnosis={title:'診断',description:'おすすめ',color:'#123456',shape:'oval',length:'medium',pattern:'solid',tags:['オーバル'],completedAt:'2026-11-06T00:00:00Z'};
data.set(STORAGE_KEYS.diagnosis,JSON.stringify(diagnosis));assert.deepEqual(readDiagnosisResult(),diagnosis);
for(const raw of ['{}','null','"text"',JSON.stringify({...diagnosis,tags:3}),JSON.stringify({...diagnosis,color:'bad'})]){data.set(STORAGE_KEYS.diagnosis,raw);assert.equal(readDiagnosisResult(),null);assert.equal(data.get(STORAGE_KEYS.diagnosis),raw);}
for(const raw of ['null','{}','[]','1','"text"','not-json','{"color":null}']){
 for(const [key,read,fallback] of [[DESIGN_KEY,readStudioDesign,defaultDesign],[NAILS_KEY,readStudioNails,defaultPhotoNails]]){data.set(key,raw);assert.deepEqual(read(),fallback);assert.equal(data.get(key),raw);}
}
const legacy={...defaultDesign};delete legacy.naturalNailLength;data.set(DESIGN_KEY,JSON.stringify(legacy));assert.deepEqual(readStudioDesign(),legacy);
for(const bad of [{length:1e30},{shape:'bogus'},{pattern:'bogus'},{textureUrl:'https://example.org/track.jpg'},{color:'<img onerror=alert(1)>'}]){data.set(DESIGN_KEY,JSON.stringify({...defaultDesign,...bad}));assert.deepEqual(readStudioDesign(),defaultDesign);}
const poses=defaultPhotoNails.map(n=>({...n,anchorHeight:n.height,visibility:1,visibilityState:'manual',clipContour:[{x:0,y:0},{x:2,y:0},{x:2,y:3}]}));data.set(NAILS_KEY,JSON.stringify(poses));assert.deepEqual(readStudioNails(),poses);assert.equal(validStudioNails(poses),true);
for(const patch of [{width:0},{height:Infinity},{x:NaN},{clipContour:[{}]},{clipHoles:[null]},{visibility:10}])assert.equal(validStudioNails([{...poses[0],...patch},...poses.slice(1)]),false);
assert.deepEqual(studioQueryPatch(new URLSearchParams('shape=bogus&pattern=bogus&length=garbage&naturalNailLength=bad&color=%23123456')),{color:'#123456'});
assert.deepEqual(studioQueryPatch(new URLSearchParams('shape=square&pattern=french&length=long&naturalNailLength=long')),{shape:'square',pattern:'french',length:1.55,naturalNailLength:'long'});
Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}});assert.deepEqual(readStudioDesign(),defaultDesign);assert.deepEqual(readStudioNails(),defaultPhotoNails);
delete globalThis.window;assert.deepEqual(readStudioDesign(),defaultDesign);
console.log('studio-settings: null/wrong/legacy/denied/SSR storage, no mutation on read, bounded geometry and query allowlist passed');
