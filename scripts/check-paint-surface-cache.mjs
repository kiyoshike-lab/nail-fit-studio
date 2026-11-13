import assert from 'node:assert/strict';import{importTypescript}from'./lib/import-typescript.mjs';import{workshopPerformanceFixtures}from'./lib/workshop-performance-fixtures.mjs';
const{PaintSurfaceCache,paintCommands,samePaintCommands}=await importTypescript('src/lib/paintSurfaceCache.ts'),fixtures=await workshopPerformanceFixtures();
const f=fixtures.find(x=>x.name==='maximum').document.fingers[0],commands=paintCommands(f);assert.equal(commands.length,36);assert.equal(commands.at(-1).erasers.length,8);assert.equal(commands[0].erasers.length,0,'parts must not be erased');
assert.ok(samePaintCommands(commands,paintCommands({...f,base:{...f.base,color:'#112233'},layerMeta:Object.fromEntries(Object.entries(f.layerMeta).map(([id,m])=>[id,{...m,name:'名前の変更',locked:true}]))})));
for(const patch of [{visible:false},{opacity:.5}]){const id=f.layers[0].id;assert.equal(samePaintCommands(commands,paintCommands({...f,layerMeta:{...f.layerMeta,[id]:{...f.layerMeta[id],...patch}}})),false);}
const eraser=f.layers.at(-1),modified=paintCommands({...f,layers:f.layers.map(l=>l===eraser?{...l,rotation:l.rotation+1}:l)});assert.equal(samePaintCommands(commands,modified),false);assert.equal(samePaintCommands(commands,modified,12),true);assert.equal(samePaintCommands(commands,modified,13),false,'later eraser invalidates earlier ink, not just itself');
assert.equal(samePaintCommands(commands,commands.slice(0,-1)),false);
const c=new PaintSurfaceCache(),canvas=(w=100,h=100)=>({width:w,height:h}),entry=(surface,cs=commands,prefix)=>({surface,commands:cs,prefix,w:80,h:140,light:false,brightness:.7});
const first=canvas(),prefix=canvas();c.add(entry(first,commands,prefix));assert.equal(c.find(commands,80,140,false,.7).surface,first);
assert.equal(c.find(commands,81,140,false,.7).surface,undefined);assert.equal(c.find(commands,80,140,true,.7).surface,undefined);assert.equal(c.find(commands,80,140,false,.6).surface,undefined);
const active=commands.map((x,i)=>i===commands.length-1?{...x,object:{...x.object,rotation:77}}:x);assert.equal(c.find(active,80,140,false,.7).prefix,prefix);assert.equal(c.find(active,80,140,false,.7,false).prefix,undefined);
// Several exact sizes can coexist, including an identical visual wrapper.
c.add({...entry(canvas()),w:81});assert.equal(c.find(commands,80,140,false,.7).surface,first);
// Shared prefix remains valid after evicting the entry that originally owned it.
const shared=canvas(),surfaces=[];const cache=new PaintSurfaceCache(4_000_000,20);for(let n=0;n<25;n++){const s=canvas();surfaces.push(s);cache.add(entry(s,commands,shared));}assert.equal(surfaces[0].width,1);assert.equal(shared.width,100);assert.ok(cache.stats().entries<=20);assert.ok(cache.stats().pixels<=4000000);
cache.clear();assert.equal(shared.width,1);assert.equal(surfaces.at(-1).width,1);assert.equal(cache.stats().pixels,0);
const bounded=new PaintSurfaceCache();for(let i=0;i<30;i++)bounded.add(entry(canvas(800,800)));assert.ok(bounded.stats().pixels<=4000000);assert.ok(bounded.stats().evictions>0);assert.throws(()=>bounded.add(entry(canvas(2001,2001))));bounded.clear();
let lost;const resilient=new PaintSurfaceCache(),lostCanvas={width:100,height:100,addEventListener:(type,fn)=>{assert.equal(type,'contextlost');lost=fn;}};resilient.add(entry(lostCanvas));lost();assert.equal(resilient.stats().pixels,0);assert.equal(lostCanvas.width,1);
console.log('paint-surface-cache: saved-compatible 0/10/30/100/160/220-object fixtures, visual dependency invalidation, eraser suffixes, exact sizes, prefix reuse, shared ownership, LRU/pixel bounds and disposal passed');
assert.equal(paintCommands(f),commands,'immutable recipe is reused independently of destination geometry');
const mutableWrapper={...f},initial=paintCommands(mutableWrapper);mutableWrapper.layerMeta={...f.layerMeta,[f.layers[0].id]:{...f.layerMeta[f.layers[0].id],opacity:.2}};assert.notEqual(paintCommands(mutableWrapper),initial,'dependency replacement invalidates memo even with a reused wrapper');
const lazy=new PaintSurfaceCache();lazy.add(entry(canvas()));assert.equal(lazy.find(active,80,140,false,.7).retainPrefix,true,'first actual last-object edit requests a prefix');assert.equal(lazy.find(commands,81,140,false,.7).retainPrefix,false,'new distance does not request a prefix');
const diversity=new PaintSurfaceCache();for(let i=0;i<600;i++)diversity.add({...entry(canvas(10,10)),w:80+i/10});assert.equal(diversity.stats().entries,512);assert.ok(diversity.stats().pixels<=4_000_000);diversity.clear();
const versions=new PaintSurfaceCache();for(let i=0;i<40;i++)versions.add(entry(canvas()));assert.equal(versions.stats().entries,16,'editing history cannot occupy all geometric slots');versions.clear();

// The stamp raster cache has its own smaller budget/count, not an unbounded
// texture collection. Default limits above must remain unchanged.
const stamps=new PaintSurfaceCache(20_000,2),small=[];
for(let i=0;i<3;i++){small.push(canvas());stamps.add(entry(small.at(-1)));}
assert.equal(small[0].width,1);assert.equal(stamps.stats().entries,2);assert.equal(stamps.stats().maxPixels,20_000);stamps.clear();assert.equal(stamps.stats().pixels,0);
const{drawPaintLayer,clearPaintRenderCache}=await importTypescript('src/lib/paintRenderer.ts');
const points=[{x:0,y:0},{x:.2,y:.1},{x:.1,y:.4}],layer={...f.layers.find(l=>l.tool==='dots'),points};
let log=[],hypots=0;const ctx=new Proxy({},{get:(_,k)=>(...a)=>log.push([k,...a]),set:(_,k,v)=>{log.push([k,v]);return true;}}),hypot=Math.hypot;
try{Math.hypot=(...a)=>{hypots++;return hypot(...a);};
 drawPaintLayer(ctx,80,140,layer);const first=JSON.stringify(log),cost=hypots;assert.ok(cost>0);log=[];
 drawPaintLayer(ctx,80,140,layer);assert.equal(hypots,cost,'same immutable stroke must reuse stamp positions');assert.equal(JSON.stringify(log),first,'same exact commands/coordinates');
 drawPaintLayer(ctx,120,200,{...layer,rotation:30,x:.1,scale:.8,color:'#123456',opacity:.2});assert.equal(hypots,cost,'size/pose/color/alpha use live paint state, not stale cached positions');
 drawPaintLayer(ctx,80,140,{...layer,spacing:layer.spacing+.2});assert.ok(hypots>cost,'spacing invalidates positions');let last=hypots;
 drawPaintLayer(ctx,80,140,{...layer,points:points.map(p=>({...p}))});assert.ok(hypots>last,'point identity invalidates positions');last=hypots;
 clearPaintRenderCache();drawPaintLayer(ctx,80,140,layer);assert.ok(hypots>last,'lifecycle cleanup clears positions');
}finally{Math.hypot=hypot;clearPaintRenderCache();}
console.log('stamp caches: exact commands, point/spacing invalidation, bounded raster storage and lifecycle cleanup passed');

const pool=await importTypescript('src/lib/paintScratchPool.ts'),previousDocument=globalThis.document;
let clears=0,lostScratch;
try{
 globalThis.document={createElement:()=>({width:0,height:0,addEventListener:(_,fn)=>{lostScratch=fn;},getContext:()=>({clearRect:()=>clears++,isContextLost:()=>false})})};
 const a=pool.takePaintScratch(80,140);pool.returnPaintScratch(a);
 const b=pool.takePaintScratch(80,140);assert.equal(a,b);assert.equal(clears,1,'exact-size buffers are cleared before reuse');assert.equal(pool.paintScratchStats().pixels,0,'borrowed image is not free');
 pool.returnPaintScratch(b);assert.notEqual(pool.takePaintScratch(81,140),b,'distance change cannot resample a scratch image');
 for(let n=0;n<40;n++)pool.returnPaintScratch(pool.takePaintScratch(90+n,160));
 assert.ok(pool.paintScratchStats().entries<=24);assert.ok(pool.paintScratchStats().pixels<=1_000_000);
 const huge=pool.takePaintScratch(1001,1001);pool.returnPaintScratch(huge);assert.equal(huge.width,1,'oversized buffers are released, not retained');
 lostScratch();assert.equal(pool.paintScratchStats().pixels,0);assert.equal(b.width,1,'context loss clears pooled buffers');
}finally{pool.clearPaintScratch();if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
console.log('scratch pool: exact-size reuse/clear, geometry isolation, count/pixel limits, oversize disposal and context loss passed');
