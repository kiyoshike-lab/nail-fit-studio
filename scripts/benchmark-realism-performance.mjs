// Independent instrumentation and timings: --profile adds overhead and MUST
// NOT be used as the before/after latency benchmark. Local browser only.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';import{pathToFileURL}from'node:url';
import{typescriptModuleUrl,importTypescript}from'./lib/import-typescript.mjs';
import{realismPerformanceFixtures}from'./lib/realism-performance-fixtures.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url'),root=opt('--source-root')??'.',runs=Number(opt('--runs')??3),samples=Number(opt('--samples')??120),profile=args.includes('--profile');
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));assert.ok(runs>=1&&runs<=5&&samples>=30&&samples<=300);
const fixtures=(await realismPerformanceFixtures()).filter(f=>!opt('--cases')||opt('--cases').split(',').includes(f.id)),url=await typescriptModuleUrl(path.join(root,'src/lib/nailRenderer.ts')),{defaultPhotoNails}=await importTypescript('src/lib/defaults.ts');
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());await page.goto(base+'/try-on',{waitUntil:'networkidle'});
 const cdp=await page.context().newCDPSession(page);if(profile){await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});await cdp.send('Profiler.start');}
 const result=await page.evaluate(async({url,fixtures,nails,runs,samples,profile})=>{
  const{drawNails}=await import(url),canvas=document.createElement('canvas');canvas.width=800;canvas.height=1040;const ctx=canvas.getContext('2d'),rows=[];
  const frame=()=>new Promise(requestAnimationFrame),quant=(a,p)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*p)],stats=a=>({samples:a.length,p50:quant(a,.5),p90:quant(a,.9),p99:quant(a,.99),max:Math.max(...a)});
  const counters={},setters={},originals=[];let measuring=false,canvasCreated=0,pathsCreated=0;
  if(profile){
   for(const key of ['createLinearGradient','createRadialGradient','addColorStop','beginPath','fill','stroke','clip','save','restore','translate','rotate','scale','setTransform','transform','drawImage','clearRect','fillRect','arc','ellipse','moveTo','lineTo','bezierCurveTo','quadraticCurveTo']){
    const proto=key==='addColorStop'?CanvasGradient.prototype:CanvasRenderingContext2D.prototype,old=proto[key];if(!old)continue;
    proto[key]=function(...a){if(!measuring)return old.apply(this,a);const start=performance.now();try{return old.apply(this,a);}finally{const c=counters[key]??={calls:0,ms:0};c.calls++;c.ms+=performance.now()-start;}};originals.push(()=>proto[key]=old);
   }
   for(const key of ['shadowBlur','filter','globalCompositeOperation']){const p=CanvasRenderingContext2D.prototype,d=Object.getOwnPropertyDescriptor(p,key);if(!d?.set)continue;Object.defineProperty(p,key,{...d,set(v){if(measuring){const k=key+'='+v;setters[k]=(setters[k]??0)+1;}return d.set.call(this,v);}});originals.push(()=>Object.defineProperty(p,key,d));}
   const create=document.createElement;document.createElement=function(...a){if(measuring&&a[0]==='canvas')canvasCreated++;return create.apply(this,a);};originals.push(()=>document.createElement=create);
   const Path=window.Path2D;window.Path2D=new Proxy(Path,{construct(t,a){if(measuring)pathsCreated++;return Reflect.construct(t,a);}});originals.push(()=>window.Path2D=Path);
  }
  try{for(let run=0;run<runs;run++)for(const f of fixtures)for(const scenario of ['cached','continuous-distance',...(f.id==='E'?['active-ink','active-eraser']:[])]){
   const fingers=f.document.fingers,design=fingers[0].base;
   for(let i=0;i<12;i++)await drawNails(ctx,800,1040,nails,design,{fingers,clear:true});
   for(const k of Object.keys(counters))delete counters[k];for(const k of Object.keys(setters))delete setters[k];canvasCreated=pathsCreated=0;
   const times=[],intervals=[];let last=await frame();measuring=true;
   for(let n=0;n<samples;n++){
    const t=await frame();intervals.push(t-last);last=t;
    const w=scenario==='continuous-distance'?760+n*.37:800;
    const target=fingers[0].layers.findLastIndex(l=>l.type==='stroke'&&(scenario==='active-eraser'?l.tool==='eraser':l.tool!=='eraser'));
    const art=scenario.startsWith('active-')?fingers.map((f,j)=>j?f:{...f,layers:f.layers.map((l,i)=>i===target?{...l,points:l.points.map((p,k)=>k===l.points.length-1?{x:p.x,y:p.y+n*.00001}:p)}:l)}):fingers;
    const start=performance.now();await drawNails(ctx,w,1040,nails,design,{fingers:art,clear:true});times.push(performance.now()-start);
   }measuring=false;
   rows.push({run,case:f.id,scenario,drawMs:stats(times),rafIntervalMs:stats(intervals),rafFps:1000*samples/intervals.reduce((s,x)=>s+x,0),heapMiB:performance.memory?.usedJSHeapSize/1048576??null,...profile?{api:structuredClone(counters),setters:structuredClone(setters),canvasCreated,pathsCreated}:{}});
  }}finally{for(const undo of originals.reverse())undo();}
  return{rows,userAgent:navigator.userAgent};
 },{url,fixtures,nails:defaultPhotoNails,runs,samples,profile});
 if(profile){const{profile:p}=await cdp.send('Profiler.stop'),ids=new Map(p.nodes.map(n=>[n.id,n])),own=new Map();for(let i=0;i<p.samples.length;i++){const n=ids.get(p.samples[i]),name=n.callFrame.functionName||'(anonymous)';own.set(name,(own.get(name)??0)+p.timeDeltas[i]/1000);}result.cpuSelfMs=[...own].sort((a,b)=>b[1]-a[1]).slice(0,40);result.cpuSampledDurationMs=(p.endTime-p.startTime)/1000;}
 await writeFile(opt('--output'),JSON.stringify({scope:profile?'instrumented Canvas API + CDP CPU diagnostic; not latency benchmark':'unmodified renderer CPU submission/RAF/JS heap; production localhost, not phone/GPU completion',root,runs,samples,profile,...result},null,2));console.log(JSON.stringify({rows:result.rows.length,profile}));
}finally{await browser.close();}
