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
const shared=canvas(),surfaces=[];const cache=new PaintSurfaceCache();for(let n=0;n<25;n++){const s=canvas();surfaces.push(s);cache.add(entry(s,commands,shared));}assert.equal(surfaces[0].width,1);assert.equal(shared.width,100);assert.ok(cache.stats().entries<=20);assert.ok(cache.stats().pixels<=4000000);
cache.clear();assert.equal(shared.width,1);assert.equal(surfaces.at(-1).width,1);assert.equal(cache.stats().pixels,0);
const bounded=new PaintSurfaceCache();for(let i=0;i<30;i++)bounded.add(entry(canvas(800,800)));assert.ok(bounded.stats().pixels<=4000000);assert.ok(bounded.stats().evictions>0);assert.throws(()=>bounded.add(entry(canvas(2001,2001))));bounded.clear();
let lost;const resilient=new PaintSurfaceCache(),lostCanvas={width:100,height:100,addEventListener:(type,fn)=>{assert.equal(type,'contextlost');lost=fn;}};resilient.add(entry(lostCanvas));lost();assert.equal(resilient.stats().pixels,0);assert.equal(lostCanvas.width,1);
console.log('paint-surface-cache: saved-compatible 0/10/30/100/160/220-object fixtures, visual dependency invalidation, eraser suffixes, exact sizes, prefix reuse, shared ownership, LRU/pixel bounds and disposal passed');
