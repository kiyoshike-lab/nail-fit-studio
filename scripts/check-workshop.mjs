import assert from 'node:assert/strict';
import {importTypescript}from'./lib/import-typescript.mjs';
const w=await importTypescript('src/lib/workshopData.ts');
const d=w.createDocument();assert.equal(d.fingers.length,5);assert.ok(w.parseDocument(d));
const saved=JSON.stringify(d);d.fingers[1].base.color='#ffffff';assert.notEqual(d.fingers[0].base.color,'#ffffff');
for(const patch of[{schema:2},{fingers:[]},{id:''},{detail:'unknown'}])assert.equal(w.parseDocument({...d,...patch}),null);
for(const part of[{id:'p',kind:'pearl',color:'#fff',x:0,y:0,size:.2,rotation:0},{id:'p',kind:'pearl',color:'#ffffff',x:10,y:0,size:.2,rotation:0},{id:'p',kind:'external',color:'#ffffff',x:0,y:0,size:.2,rotation:0}]){const n=JSON.parse(saved);n.fingers[0].parts=[part];assert.equal(w.parseDocument(n),null);}
for(const url of['https://attacker.test/p.png','//attacker.test/p.png','/assets/preset-textures/../../private.png','data:image/png;base64,a'])assert.equal(w.validBase({...d.fingers[0].base,textureUrl:url}),false);
assert.equal(w.validBase({...d.fingers[0].base,textureUrl:'/assets/preset-textures/design_001.png'}),true);
let history={past:[],present:d,future:[]};for(let i=0;i<70;i++)history=w.historyChange(history,{...d,name:'edit'+i});assert.equal(history.past.length,40);const last=history.present;history=w.historyUndo(history);assert.equal(history.future[0],last);history=w.historyRedo(history);assert.equal(history.present,last);history=w.historyChange(w.historyUndo(history),{...d,name:'different'});assert.equal(history.future.length,0);
const values=new Map();globalThis.window={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}};
values.set('nail-fit-studio-next.favorites.v1','LEGACY UNTOUCHED');assert.equal(w.saveWorkshopDocument(d,'salon'),true);assert.equal(w.readWorkshopLibrary().entries[0].folder,'salon');assert.equal(w.findWorkshopDocument(d.id).name,d.name);assert.equal(values.get('nail-fit-studio-next.favorites.v1'),'LEGACY UNTOUCHED');
assert.equal(w.saveWorkshopDraft(d),true);assert.equal(w.readWorkshopDraft().document.id,d.id);
const future='{"schema":9,"entries":[]}';values.set(w.WORKSHOP_LIBRARY,future);assert.equal(w.readWorkshopLibrary().ok,false);assert.equal(w.saveWorkshopDocument(d),false);assert.equal(w.deleteWorkshopDocument(d.id),false);assert.equal(values.get(w.WORKSHOP_LIBRARY),future);
values.set(w.WORKSHOP_DRAFT,'broken');assert.equal(w.saveWorkshopDraft(d),false);assert.equal(values.get(w.WORKSHOP_DRAFT),'broken');
window.localStorage.getItem=()=>{throw Error('denied');};assert.equal(w.readWorkshopDraft().ok,false);assert.equal(w.readWorkshopLibrary().ok,false);assert.equal(w.saveWorkshopDocument(d),false);delete globalThis.window;
console.log('workshop data: strict five-finger schema, local textures only, bounded parts/history, roundtrip, legacy untouched, future/corrupt storage preserved and denied storage passed');
