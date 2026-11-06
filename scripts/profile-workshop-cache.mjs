// Operation counts, separate from timed benchmarks. Does not measure power.
import assert from'node:assert/strict';import{writeFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import path from'node:path';import{typescriptModuleUrl,importTypescript}from'./lib/import-typescript.mjs';import{workshopPerformanceFixtures}from'./lib/workshop-performance-fixtures.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined,base=opt('--base-url');if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local only');
const before=await typescriptModuleUrl(path.join(opt('--before-root'),'src/lib/nailRenderer.ts')),after=await typescriptModuleUrl('src/lib/nailRenderer.ts'),paint=await typescriptModuleUrl('src/lib/paintRenderer.ts'),{defaultPhotoNails:nails}=await importTypescript('src/lib/defaults.ts'),fixture=(await workshopPerformanceFixtures()).find(f=>f.name==='maximum');
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
try{const p=await browser.newPage();await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());await p.goto(base+'/try-on',{waitUntil:'networkidle'});const result=await p.evaluate(async({before,after,paint,nails,fixture})=>{
 const renderers={before:(await import(before)).drawNails,after:(await import(after)).drawNails},cache=await import(paint),c=document.createElement('canvas');c.width=800;c.height=1040;const x=c.getContext('2d'),rows=[];let counters={};const originals=[];
 for(const key of['fill','stroke','drawImage','createRadialGradient','createLinearGradient']){const fn=CanvasRenderingContext2D.prototype[key];originals.push(()=>CanvasRenderingContext2D.prototype[key]=fn);CanvasRenderingContext2D.prototype[key]=function(...a){counters[key]=(counters[key]??0)+1;return fn.apply(this,a);};}
 const create=document.createElement.bind(document);document.createElement=function(tag,...a){if(tag==='canvas')counters.canvasAllocations=(counters.canvasAllocations??0)+1;return create(tag,...a);};
 try{for(const [version,draw]of Object.entries(renderers))for(const scenario of['alternating-distance','active-ink','active-eraser']){
  cache.clearPaintRenderCache();const fs=fixture.document.fingers;
  for(let i=0;i<12;i++)await draw(x,800,1040,nails,fs[0].base,{fingers:fs,clear:true});counters={};
  for(let n=0;n<30;n++){
   const target=fs[0].layers.findLastIndex(l=>scenario==='active-eraser'?l.tool==='eraser':l.type==='stroke'&&l.tool!=='eraser');
   const art=scenario==='alternating-distance'?fs:fs.map((f,j)=>j?f:{...f,layers:f.layers.map((l,i)=>i===target?{...l,rotation:l.rotation+n*.01}:l)});
   await draw(x,scenario==='alternating-distance'&&n%2?780:800,1040,nails,fs[0].base,{fingers:art,clear:true});
  }rows.push({version,scenario,frames:30,counters:{...counters},...(version==='after'?{cache:cache.paintRenderCacheStats()}:{})});
 }}finally{for(const restore of originals)restore();document.createElement=create;}
 cache.clearPaintRenderCache();return{rows,afterClear:cache.paintRenderCacheStats()};
 },{before,after,paint,nails,fixture});assert.equal(result.afterClear.pixels,0);await writeFile(opt('--output'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
