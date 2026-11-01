import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {importTypescript} from './lib/import-typescript.mjs';
const storage=await importTypescript('src/lib/storage.ts');
const {defaultDesign,defaultPhotoNails}=await importTypescript('src/lib/defaults.ts');
const data=new Map();globalThis.window={localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}};
const item={id:'legacy',design:defaultDesign,nails:defaultPhotoNails,savedAt:'2026-10-31T12:00:00Z'};
assert.equal(storage.tryWriteJson('x',{a:1}),true);assert.deepEqual(storage.readJson('x',{}),{a:1});assert.equal(storage.writeJson('x',1),undefined);
for(const kind of ['favorites','history']){
 const valid=kind==='history'?{...item,createdAt:item.savedAt}:item;
 data.set(storage.STORAGE_KEYS[kind],JSON.stringify([null,3,{}, {...valid,design:null},{...valid,design:{...defaultDesign,length:null}},{...valid,nails:[null]},valid]));
 const raw=data.get(storage.STORAGE_KEYS[kind]);assert.deepEqual(storage.readSavedLooks(kind),[valid]);assert.equal(data.get(storage.STORAGE_KEYS[kind]),raw,'read changed persisted data');
 for(const raw of ['null','{}','1','"string"','not-json']){data.set(storage.STORAGE_KEYS[kind],raw);assert.deepEqual(storage.readSavedLooks(kind),[]);}
}
window.localStorage.setItem=()=>{throw new DOMException('full','QuotaExceededError');};assert.equal(storage.tryWriteJson('x',2),false);assert.doesNotThrow(()=>storage.writeJson('x',2));
Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});assert.equal(storage.tryWriteJson('x',2),false);assert.deepEqual(storage.readSavedLooks('favorites'),[]);
delete globalThis.window;assert.equal(storage.tryWriteJson('x',2),false);

const {preparePhoto}=await importTypescript('src/lib/photoPreparation.ts');
const originalURL=URL.createObjectURL;let closed=0,lastCanvas;
globalThis.createImageBitmap=async()=>({width:4400,height:3300,close(){closed++;}});
let failure='none';globalThis.document={createElement(){lastCanvas={width:0,height:0,getContext(){if(failure==='context')return null;return{drawImage(){if(failure==='draw')throw Error('draw');}};},toBlob(cb){if(failure==='encode')cb(null);else cb(new Blob(['jpeg']));}};return lastCanvas;}};
URL.createObjectURL=()=>{if(failure==='url')throw Error('url');return 'blob:local';};
assert.equal(await preparePhoto({}), 'blob:local');assert.equal(lastCanvas.width,2200);assert.equal(lastCanvas.height,1650);assert.equal(closed,1);
for(const mode of ['context','draw','encode','url']){failure=mode;const before=closed;await assert.rejects(()=>preparePhoto({}));assert.equal(closed,before+1,mode+' leaked bitmap');}
URL.createObjectURL=originalURL;delete globalThis.document;delete globalThis.createImageBitmap;
assert.equal(await readFile('public/googlef4620872cc6591de.html','utf8'),'google-site-verification: googlef4620872cc6591de.html');
const settings=await readFile('src/components/SettingsPanel.tsx','utf8'),comparison=await readFile('src/components/BeforeAfter.tsx','utf8');
assert.ok(settings.includes('role="group"')&&!settings.includes('role="tablist"'));assert.ok(settings.includes('aria-pressed={selectedFinger === index}'));assert.ok(comparison.includes('aria-pressed={!enabled}'));
console.log('site-reliability: denied/quota/SSR storage, corrupt and valid legacy favorites/history, no mutation on read, bitmap cleanup on success/four errors, resize limit, verification file and selection semantics passed');
