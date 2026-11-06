import assert from 'node:assert/strict';
import {importTypescript} from './lib/import-typescript.mjs';
const w=await importTypescript('src/lib/workshopData.ts'),p=await importTypescript('src/lib/paintData.ts');
const s=await importTypescript('src/lib/nailStyles.ts'),types=await importTypescript('src/lib/surfaceTypes.ts'),fav=await importTypescript('src/lib/styleFavorites.ts');
assert.equal(s.nailStyles.length,19);assert.equal(new Set(s.nailStyles.map(s=>s.id)).size,19);
assert.deepEqual(new Set(types.surfaceKinds),new Set(s.nailStyles.map(s=>s.id)));
const legacy=w.createDocument(),original=JSON.stringify(legacy);
let doc=p.upgradePaintDocument(structuredClone(legacy));doc.fingers[0]=p.withLayerMeta({...doc.fingers[0],parts:[{id:'pearl',kind:'pearl',x:.1,y:0,size:.2,color:'#ffffff',rotation:0}],layers:[p.makeShape('circle',{x:0,y:0},{x:.2,y:.2},1.5,p.defaultPaintStyle,false)]});
doc.fingers[0].base.length=1.6;doc.fingers[0].base.shape='coffin';doc.fingers[0].base.naturalNailLength='long';
doc.fingers[0].order=p.artOrder(doc.fingers[0]);
for(const style of s.nailStyles){const next=s.applyNailStyle(doc,0,style.id);assert.ok(w.parseDocument(next),style.id);assert.equal(next.schema,4);assert.equal(next.fingers[0].base.length,1.6);assert.equal(next.fingers[0].base.shape,'coffin');assert.equal(next.fingers[0].base.naturalNailLength,'long');assert.deepEqual(next.fingers[0].parts,doc.fingers[0].parts);assert.deepEqual(next.fingers[0].layers,doc.fingers[0].layers);assert.deepEqual(next.fingers[0].layerMeta,doc.fingers[0].layerMeta);assert.deepEqual(next.fingers.slice(1),doc.fingers.slice(1));assert.equal(p.upgradePaintDocument(next).schema,4);assert.deepEqual(w.parseDocument(JSON.parse(JSON.stringify(next))),next);}
assert.equal(JSON.stringify(legacy),original);assert.equal(s.applyNailStyle(doc,6,'color'),null);assert.equal(s.applyNailStyle(doc,0,'<script>'),null);
const modern=s.applyNailStyle(doc,0,'magnet');
const materials=await importTypescript('src/lib/editorMaterials.ts');assert.equal(materials.editorMaterials.length,38);assert.ok(materials.editorMaterials.every(m=>materials.materialCategoryIds(m).length));assert.equal(materials.filterEditorMaterials('パール','すべて','elegant').length,1);assert.equal(materials.filterEditorMaterials('not-found','すべて','').length,0);assert.equal(materials.filterEditorMaterials('','すべて','').length,38);
assert.equal(w.patchAllBases(modern,{color:'#aabbcc',length:1.5}).fingers[0].surface.kind,'magnet');
for(const patch of[{pattern:'french'},{finish:'pearl'},{material:'jelly'},{textureUrl:'/assets/preset-textures/design_001.png'}])assert.equal(w.patchAllBases(modern,patch).fingers[0].surface,undefined,'legacy controls must work after a modern preset');
for(const patch of[{kind:'bad'},{pigment:NaN},{roughness:-1},{gloss:Infinity},{angle:181},{intensity:2},{grain:'1'},{curve:1.1},{url:'https://bad.test'},{kind:['color']}]){const next=structuredClone(modern);Object.assign(next.fingers[0].surface,patch);assert.equal(w.parseDocument(next),null,JSON.stringify(patch));}
assert.equal(w.parseDocument({...modern,schema:3}),null,'older reader must not silently drop surface');
const copied=p.cloneFingerArt(modern.fingers[0]);copied.surface.gloss=0;assert.notEqual(copied.surface.gloss,modern.fingers[0].surface.gloss);
const h=w.historyChange({past:[],present:doc,future:[]},modern);assert.equal(w.historyUndo(h).present,doc);assert.equal(w.historyRedo(w.historyUndo(h)).present,modern);
assert.equal(s.filterStyles('',{},[],false,'new').length,19);assert.equal(s.filterStyles('フレンチ',{},[],false,'name').length,4);
assert.equal(s.filterStyles('上品 フレンチ',{event:'wedding'},[],false,'name').length,1);
assert.equal(s.filterStyles('',{type:'special',decoration:'holo'},[],false,'name')[0].id,'hologram');
assert.equal(s.filterStyles('',{type:'special',season:'summer'},[],false,'name').length,4);
assert.equal(s.filterStyles('ＣＡＴ－ＥＹＥ',{},[],false,'new')[0].id,'cat-eye');
assert.equal(s.filterStyles('',{},['clear'],true,'name')[0].id,'clear');assert.equal(s.filterStyles('not-found',{},[],false,'new').length,0);
for(const [facet,values]of Object.entries(s.styleFacets))for(const style of s.nailStyles)for(const tag of style.tags[facet])assert.ok(Object.hasOwn(values,tag),`${facet}:${tag}`);
const storage=new Map();globalThis.window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},dispatchEvent(){}};
assert.equal(w.saveWorkshopDocument(modern),true);assert.deepEqual(w.readWorkshopLibrary().entries[0].document,modern);assert.equal(w.saveWorkshopDraft(modern),true);assert.deepEqual(w.readWorkshopDraft().document,modern);
assert.equal(fav.toggleStyleFavorite('magnet'),true);assert.deepEqual(fav.parseStyleFavorites(fav.favoriteSnapshot()),['magnet']);assert.equal(fav.toggleStyleFavorite('magnet'),true);assert.deepEqual(fav.parseStyleFavorites(fav.favoriteSnapshot()),[]);
for(const raw of['broken','{"schema":9,"ids":[]}',JSON.stringify({schema:1,ids:['clear','clear']}),JSON.stringify({schema:1,ids:['<img>']})]){storage.set(fav.STYLE_FAVORITES,raw);assert.equal(fav.toggleStyleFavorite('clear'),false);assert.equal(storage.get(fav.STYLE_FAVORITES),raw);}
window.localStorage.setItem=()=>{throw Error('quota')};storage.delete(fav.STYLE_FAVORITES);assert.equal(fav.toggleStyleFavorite('clear'),false);delete globalThis.window;
console.log('nail-surfaces: 19 real families, v1/v2/v3 compatibility, v4 strict schema/storage, layers/length/shape preserved, Undo/Redo, multi-facet/search/favorites and invalid/quota data passed');
