import assert from'node:assert/strict';import{importTypescript}from'./lib/import-typescript.mjs';
const r=await importTypescript('src/lib/workshopRecovery.ts'),w=await importTypescript('src/lib/workshopData.ts');
const storage=new Map();globalThis.window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
const docs=Array.from({length:6},()=>w.createDocument());for(const d of docs.slice(0,5))assert.equal(r.saveWorkshopRecovery(d),true);const old=storage.get(r.WORKSHOP_RECOVERY);assert.equal(r.saveWorkshopRecovery(docs[5]),false);assert.equal(storage.get(r.WORKSHOP_RECOVERY),old);
const styles=await importTypescript('src/lib/nailStyles.ts'),modern=styles.applyNailStyle(docs[0],0,'magnet');assert.equal(r.saveWorkshopRecovery(modern),true);assert.equal(r.readWorkshopRecovery().documents[0].schema,4);assert.equal(r.readWorkshopRecovery().documents[0].fingers[0].surface.kind,'magnet');
assert.equal(r.saveWorkshopRecovery({...docs[0],name:'更新した一時退避'}),true);assert.equal(r.readWorkshopRecovery().documents[0].name,'更新した一時退避');assert.equal(r.readWorkshopRecovery().documents.length,5);
assert.equal(r.deleteWorkshopRecovery(docs[1].id),true);assert.equal(r.saveWorkshopRecovery(docs[5]),true);assert.equal(r.deleteWorkshopRecovery('not-found'),true);
const existingLibrary='unchanged';storage.set(w.WORKSHOP_LIBRARY,existingLibrary);assert.equal(r.saveWorkshopRecovery(docs[3]),true);assert.equal(storage.get(w.WORKSHOP_LIBRARY),existingLibrary);
for(const bad of['broken',JSON.stringify({schema:9,documents:[]}),JSON.stringify({schema:1,documents:[docs[0],docs[0]]}),JSON.stringify({schema:1,documents:Array(6).fill(docs[0])}),JSON.stringify({schema:1,documents:[{...docs[0],schema:99}]}),'a'.repeat(700001)]){
 storage.set(r.WORKSHOP_RECOVERY,bad);assert.equal(r.readWorkshopRecovery().ok,false);assert.equal(r.saveWorkshopRecovery(docs[0]),false);assert.equal(r.deleteWorkshopRecovery(docs[0].id),false);assert.equal(storage.get(r.WORKSHOP_RECOVERY),bad);
}
storage.delete(r.WORKSHOP_RECOVERY);assert.equal(r.saveWorkshopRecovery({...docs[0],fingers:[]}),false);
window.localStorage.setItem=()=>{throw Error('quota')};assert.equal(r.saveWorkshopRecovery(docs[0]),false);window.localStorage.getItem=()=>{throw Error('denied')};assert.equal(r.readWorkshopRecovery().ok,false);assert.equal(r.saveWorkshopRecovery(docs[0]),false);delete globalThis.window;
console.log('workshop-recovery: strict legacy/v4 documents, 5-project bound with no eviction, update/delete, formal library untouched, invalid/unknown/large data and storage denial preserved');
