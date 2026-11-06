import assert from 'node:assert/strict';
import {importTypescript}from'./lib/import-typescript.mjs';
const w=await importTypescript('src/lib/workshopData.ts'),p=await importTypescript('src/lib/paintData.ts'),g=await importTypescript('src/lib/paintGeometry.ts');
const {drawingTools,MAX_STROKE_POINTS}=await importTypescript('src/lib/paintTypes.ts');
const {defaultDesign}=await importTypescript('src/lib/defaults.ts');
const legacy=w.createDocument(),original=JSON.stringify(legacy),doc=p.upgradePaintDocument(legacy);
assert.equal(doc.schema,3);assert.ok(w.parseDocument(doc));assert.equal(JSON.stringify(legacy),original);assert.equal(w.parseDocument({...legacy,schema:2}),null,'incomplete v2 must not drop paint');
const stroke={...p.defaultPaintStyle,id:'line-1',type:'stroke',tool:'pen',x:0,y:0,scale:1,rotation:0,mirror:false,points:[{x:-.2,y:0},{x:.2,y:.1}]};
const shape=p.makeShape('circle',{x:-.2,y:-.2},{x:.1,y:.2},1.3,p.defaultPaintStyle,false);
doc.fingers[0]=p.withLayerMeta({...doc.fingers[0],parts:[{id:'pearl',kind:'pearl',color:'#ffffff',x:0,y:0,size:.2,rotation:0}],layers:[stroke,shape],order:[stroke.id,'pearl',shape.id]});
assert.deepEqual(w.parseDocument(doc),doc);
for(const patch of[{schema:4},{schema:1},{fingers:[]},{schema:'2'}])assert.equal(w.parseDocument({...doc,...patch}),null);
for(const mutate of[
 d=>d.fingers[0].layers[0].points[0].x=Infinity,d=>d.fingers[0].layers[0].tool=['pen'],d=>d.fingers[0].layers[0].opacity=2,
 d=>d.fingers[0].layers[0].color='url(attack)',d=>d.fingers[0].layers[0].scale=99,d=>d.fingers[0].layers[0].points=Array(257).fill({x:0,y:0}),
 d=>d.fingers[0].order=['pearl','pearl',shape.id],d=>d.fingers[0].layers[0].id='pearl',d=>d.fingers[0].layers[1].height+=.1,
 d=>d.fingers[0].layers=Array.from({length:33},(_,i)=>({...stroke,id:String(i)})),
 d=>{d.fingers[0].layers=Array.from({length:9},(_,i)=>({...stroke,id:'e'+i,tool:'eraser'}));d.fingers[0].order=['pearl',...d.fingers[0].layers.map(l=>l.id)];},
 d=>{d.fingers[0].layers=Array.from({length:17},(_,i)=>({...stroke,id:'s'+i,points:Array.from({length:256},(_,j)=>({x:j/256,y:0}))}));d.fingers[0].order=['pearl',...d.fingers[0].layers.map(l=>l.id)];},
]){const candidate=structuredClone(doc);mutate(candidate);assert.equal(w.parseDocument(candidate),null);}
for(const tool of Object.keys(drawingTools).filter(t=>!['select','pen','brush','dots','eraser','glitter','holo'].includes(t))){
 for(const [dx,dy]of[[.2,.3],[-.2,.3],[.2,-.3],[-.2,-.3]]){const l=p.makeShape(tool,{x:0,y:0},{x:dx,y:dy},1.4,p.defaultPaintStyle,true);const next=p.replacePaintArt(doc,1,{...doc.fingers[1],layers:[l],order:[l.id]});assert.ok(w.parseDocument(next),tool);if(['circle','square'].includes(tool))assert.equal(l.width,l.height);}
}
let points=[{x:0,y:0}];for(let i=1;i<8000;i++)points=p.appendPoint(points,{x:i/2500,y:Math.sin(i*.02)});assert.ok(points.length<=MAX_STROKE_POINTS);assert.equal(points[0].x,0);assert.ok(Math.abs(points.at(-1).x-7999/2500)<.00001);
let small=[{x:0,y:0}];for(let i=1;i<20;i++)small=p.appendPoint(small,{x:i/50,y:0},3);assert.ok(small.length<=3);assert.equal(small.at(-1).x,.38);
const copied=p.cloneFingerArt(doc.fingers[0]);assert.notEqual(copied.layers[0].id,stroke.id);assert.notEqual(copied.layers[0].points,stroke.points);assert.equal(new Set(copied.order).size,3);assert.ok(w.parseDocument(p.replacePaintArt(doc,2,copied)));
// Same normalized input under CSS scaling, backing-store DPR, zoom and scroll.
for(const dpr of[1,2])for(const zoom of[1,1.5,2.5])for(const scroll of[0,80]){
 const size={width:400*zoom*dpr,height:640*zoom*dpr},rect={left:50-scroll,top:80-scroll,width:400*zoom,height:640*zoom},geo=g.paintGeometry(size.width,size.height,defaultDesign),expected={x:.15,y:-.23};
 const client={x:rect.left+(geo.center.x+expected.x*geo.width)/size.width*rect.width,y:rect.top+(geo.center.y+expected.y*geo.width)/size.height*rect.height};
 const actual=g.clientToPaint(client,rect,size,defaultDesign);assert.ok(Math.abs(actual.x-expected.x)<1e-10&&Math.abs(actual.y-expected.y)<1e-10);
}
assert.equal(g.hitPaintLayer({x:shape.x,y:shape.y*1.3},shape,1.3),true);assert.equal(g.hitPaintLayer({x:3,y:3},shape,1.3),false);
const storage=new Map();globalThis.window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
assert.equal(w.saveWorkshopDocument(legacy,'salon'),true);assert.equal(w.saveWorkshopDocument(doc,'salon'),true);assert.deepEqual(w.readWorkshopLibrary().entries[0].document,doc);
assert.equal(w.saveWorkshopDraft(doc),true);assert.deepEqual(w.readWorkshopDraft().document,doc);
const future='{"schema":1,"entries":[{"document":{"schema":9}}]}';storage.set(w.WORKSHOP_LIBRARY,future);assert.equal(w.saveWorkshopDocument(doc),false);assert.equal(storage.get(w.WORKSHOP_LIBRARY),future);
delete globalThis.window;
console.log('nail-paint: v1/v2 lossless compatibility, strict vectors/stack/budgets, all shapes/quadrants, square/circle ratios, DPR/zoom/scroll invariance, immutable copies and storage roundtrip passed');
