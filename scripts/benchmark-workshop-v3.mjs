// Same renderer paths/data, production localhost. RAF is a scheduling proxy,
// not physical presentation; Canvas CPU submission is not GPU completion.
import assert from 'node:assert/strict';import{writeFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import path from'node:path';
import{importTypescript,typescriptModuleUrl}from'./lib/import-typescript.mjs';import{workshopPerformanceFixtures}from'./lib/workshop-performance-fixtures.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined,base=opt('--base-url'),runs=Number(opt('--runs')??3),samples=Number(opt('--samples')??120),root=opt('--source-root')??'.';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local only');if(!Number.isInteger(samples)||samples<30||samples>300||!Number.isInteger(runs)||runs<1||runs>5)throw Error('Invalid benchmark bounds');
const fixtures=await workshopPerformanceFixtures(),url=await typescriptModuleUrl(path.join(root,'src/lib/nailRenderer.ts')),data=await importTypescript('src/lib/defaults.ts'),storage=await typescriptModuleUrl('src/lib/workshopData.ts');
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());await page.goto(base+'/try-on',{waitUntil:'networkidle'});
 const result=await page.evaluate(async({url,fixtures,nails,storage,runs,samples})=>{
  const {drawNails}=await import(url),w=await import(storage),c=document.createElement('canvas');c.width=800;c.height=1040;const ctx=c.getContext('2d'),rows=[],q=(a,p)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*p)],stats=a=>({samples:a.length,p50:q(a,.5),p90:q(a,.9),p99:q(a,.99),max:Math.max(...a)}),frame=()=>new Promise(requestAnimationFrame);
  for(let run=0;run<runs;run++)for(const f of fixtures){
   const fs=f.document.fingers,design=fs[0].base;
   for(const scenario of ['cached','alternating-distance','continuous-distance','active-ink','active-eraser']){
    for(let n=0;n<12;n++)await drawNails(ctx,800,1040,nails,design,{fingers:fs,clear:true});const times=[],intervals=[];let last=await frame();
    for(let n=0;n<samples;n++){
     const t=await frame();intervals.push(t-last);last=t;
     const width=scenario==='alternating-distance'?n%2?800:780:scenario==='continuous-distance'?760+n*.37:800;
     const target=fs[0].layers.findLastIndex(l=>l.type==='stroke'&&(scenario==='active-eraser'?l.tool==='eraser':l.tool!=='eraser'));
     const art=scenario.startsWith('active-')&&target>=0?fs.map((a,j)=>j!==0?a:{...a,layers:a.layers.map((l,i)=>i===target?{...l,points:l.points.map((p,k)=>k===l.points.length-1?{x:p.x,y:p.y+n*.00001}:p)}:l)}):fs;
     const start=performance.now();await drawNails(ctx,width,1040,nails,design,{fingers:art,clear:true});times.push(performance.now()-start);
    }
    rows.push({run,fixture:f.name,scenario,drawMs:stats(times),rafIntervalMs:stats(intervals),rafFps:1000*samples/intervals.reduce((a,b)=>a+b,0),intervalsOver25Ms:intervals.filter(x=>x>25).length,heapMiB:performance.memory?.usedJSHeapSize/1048576??null});
   }
   const save=[],read=[];for(let n=0;n<12;n++){let t=performance.now();if(!w.saveWorkshopDocument(f.document,'created'))throw Error('Real save failed '+f.name);save.push(performance.now()-t);t=performance.now();if(!w.readWorkshopLibrary().entries.some(e=>e.document.id===f.document.id))throw Error('Read failed');read.push(performance.now()-t);localStorage.removeItem(w.WORKSHOP_LIBRARY);}
   rows.push({run,fixture:f.name,scenario:'storage',saveMs:stats(save),readMs:stats(read),serializedCharacters:f.serializedCharacters});
  }return {rows,ua:navigator.userAgent,dpr:devicePixelRatio};
 },{url,fixtures,nails:data.defaultPhotoNails,storage,runs,samples});
 assert.equal(result.rows.length,runs*fixtures.length*6);await writeFile(opt('--output'),JSON.stringify({scope:'production localhost, desktop Chrome; same saved-compatible fixtures, 800x1040 Canvas/5 nails; no hardware phone/physical motion/power claim',sourceRoot:root,fixtures:fixtures.map(f=>({name:f.name,serializedCharacters:f.serializedCharacters,layersPerFinger:f.layersPerFinger,partsPerFinger:f.partsPerFinger,pointsPerFinger:f.pointsPerFinger})),...result},null,2));console.log(JSON.stringify({rows:result.rows.length,fixtures:fixtures.map(f=>({name:f.name,serializedCharacters:f.serializedCharacters,layersPerFinger:f.layersPerFinger,partsPerFinger:f.partsPerFinger,pointsPerFinger:f.pointsPerFinger}))}));
}finally{await browser.close();}
