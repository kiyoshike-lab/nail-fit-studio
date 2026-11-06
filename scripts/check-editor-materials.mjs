import assert from 'node:assert/strict';
import {importTypescript}from'./lib/import-typescript.mjs';
const data=await importTypescript('src/lib/workshopData.ts'),paint=await importTypescript('src/lib/paintData.ts'),m=await importTypescript('src/lib/editorMaterials.ts'),o=await importTypescript('src/lib/editorObjects.ts'),g=await importTypescript('src/lib/paintGeometry.ts');
assert.equal(m.editorMaterials.length,38);assert.equal(new Set(m.editorMaterials.map(x=>x.id)).size,38);
let cases=0;
for(const shape of ['natural','round','oval','squoval','almond','coffin','square','stiletto'])for(const length of [.75,1,2.5])for(const material of m.editorMaterials){
 const legacy=data.createDocument();legacy.fingers[2].base={...legacy.fingers[2].base,shape,length};const before=JSON.stringify(legacy),p={x:.12,y:-.1},r=m.placeMaterial(legacy,2,material.id,p,paint.defaultPaintStyle);
 assert.ok(r,material.id);assert.equal(r.document.schema,3);assert.ok(data.parseDocument(r.document),material.id);assert.equal(JSON.stringify(legacy),before);
 const object=o.editorObject(r.document.fingers[2],r.id),geo=g.paintGeometry(100,160,legacy.fingers[2].base);assert.equal(object.x,p.x);assert.ok(Math.abs(object.y*geo.height/geo.width-p.y)<1e-12);
 if('tool'in object&&['circle','square'].includes(object.tool))assert.equal(object.width,object.height);cases++;
}
let doc=m.placeMaterial(data.createDocument(),0,'shape:circle',{x:0,y:0},paint.defaultPaintStyle).document;
const art=doc.fingers[0],id=art.layers[0].id,object=o.editorObject(art,id);
assert.equal(o.selectableObject(art,{x:3,y:3},1,id),undefined,'blank canvas must not drag stale selection');
assert.equal(o.selectableObject(art,{x:0,y:0},1,null).id,id);
const locked=m.patchLayerState(doc,0,id,{locked:true});assert.equal(o.selectableObject(locked.fingers[0],{x:0,y:0},1,id),undefined);
const hidden=m.patchLayerState(doc,0,id,{visible:false});assert.equal(o.selectableObject(hidden.fingers[0],{x:0,y:0},1,id),undefined);
const moved=o.transformObject(object,'move',{x:0,y:0},{x:.2,y:.15},1.5);assert.ok(Math.abs(moved.y-.1)<1e-12);assert.equal(moved.x,.2);
const scaled=o.transformObject(object,'scale',{x:.1,y:.1},{x:.2,y:.2},1);assert.equal(scaled.scale,2);assert.equal(scaled.width,scaled.height);
const rotated=o.transformObject(object,'rotate',{x:1,y:0},{x:0,y:1},1,true);assert.equal(rotated.rotation,90);
const duplicated=paint.cloneFingerArt(m.patchLayerState(doc,0,id,{name:'<img src=x onerror=alert(1)>',opacity:.4}).fingers[0]);assert.notEqual(duplicated.layers[0].id,id);assert.equal(paint.layerState(duplicated,duplicated.layers[0].id).opacity,.4);duplicated.layerMeta[duplicated.layers[0].id].name='changed';assert.notEqual(paint.layerState(art,id).name,'changed');
const v2=structuredClone(doc);v2.schema=2;for(const f of v2.fingers)delete f.layerMeta;assert.ok(data.parseDocument(v2));const v2Raw=JSON.stringify(v2);assert.ok(data.parseDocument(paint.upgradePaintDocument(v2)));assert.equal(JSON.stringify(v2),v2Raw);
for(const patch of [{name:''},{name:'x'.repeat(65)},{visible:1},{locked:'true'},{opacity:NaN},{opacity:2}]){const bad=structuredClone(doc);Object.assign(bad.fingers[0].layerMeta[id],patch);assert.equal(data.parseDocument(bad),null);}
const bad=structuredClone(doc);bad.fingers[0].layerMeta.extra={name:'extra',visible:true,locked:false,opacity:1};assert.equal(data.parseDocument(bad),null);
const pollution=JSON.parse(JSON.stringify(doc).replaceAll(id,'__proto__'));assert.equal(data.parseDocument(pollution),null);assert.equal({}.polluted,undefined);
let full=data.createDocument();for(let i=0;i<32;i++)full=m.placeMaterial(full,0,'shape:circle',{x:0,y:0},paint.defaultPaintStyle).document;assert.equal(m.placeMaterial(full,0,'shape:heart',{x:0,y:0},paint.defaultPaintStyle),null);assert.ok(data.parseDocument(full));
let parts=data.createDocument();for(let i=0;i<12;i++)parts=m.placeMaterial(parts,0,'part:pearl',{x:.48,y:0},paint.defaultPaintStyle).document;assert.ok(data.parseDocument(parts));assert.equal(parts.fingers[0].parts[0].x,.48);assert.equal(m.placeMaterial(parts,0,'part:pearl',{x:0,y:0},paint.defaultPaintStyle),null);
console.log(`editor-materials: ${cases} shape/length/material placements, v1/v2/v3 preservation, local transforms/handles, locks, blank deselection, metadata injection and budgets passed`);
