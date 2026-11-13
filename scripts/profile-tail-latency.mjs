// Local, frame-level tail analysis. Diagnostic API wrappers/heap sampling are
// deliberately separate from uninstrumented latency runs. Never changes FPS,
// geometry precision, renderer resolution, artwork, or application scheduling.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';import{pathToFileURL}from'node:url';
import{typescriptModuleUrl,importTypescript}from'./lib/import-typescript.mjs';
import{workshopPerformanceFixtures}from'./lib/workshop-performance-fixtures.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url'),root=opt('--source-root')??'.',frames=Number(opt('--frames')??1200),pace=Number(opt('--pace-ms')??16.6667),scenario=opt('--scenario')??'distance',motion=opt('--motion')??'periodic',diagnostic=args.includes('--diagnostic'),out=opt('--output');
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));assert.ok(Number.isInteger(frames)&&frames>=300&&frames<=6000);assert.ok(pace>=0&&pace<=34);assert.ok(['cached','distance','eraser'].includes(scenario));
assert.ok(['periodic','jitter'].includes(motion));
const fixture=(await workshopPerformanceFixtures()).find(f=>f.name==='maximum'),{defaultPhotoNails}=await importTypescript('src/lib/defaults.ts');
let url=await typescriptModuleUrl(path.join(root,'src/lib/nailRenderer.ts')),paintUrl=await typescriptModuleUrl(path.join(root,'src/lib/paintRenderer.ts'));
const shim=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
if(diagnostic){
 const cache=await typescriptModuleUrl(path.join(root,'src/lib/paintSurfaceCache.ts'));
 const wrapped=shim(`import{PaintSurfaceCache as Base}from"${cache}";export{paintCommands,samePaintCommands}from"${cache}";export class PaintSurfaceCache extends Base{find(...a){return window.__tailPhase('cacheFind',()=>{const r=super.find(...a);window.__tailCount(r.surface?'cacheHit':r.prefix?'prefixHit':'cacheMiss');return r;});}add(...a){return window.__tailPhase('cacheAdd',()=>super.add(...a));}}`);
 const paint=await typescriptModuleUrl(path.join(root,'src/lib/paintRenderer.ts'),{'./paintSurfaceCache':wrapped});
 paintUrl=paint;
 const paintWrap=shim(`import*as p from"${paint}";export const drawMixedArt=(...a)=>window.__tailPhase('art',()=>p.drawMixedArt(...a));export const drawVisibleParts=(...a)=>p.drawVisibleParts(...a);`);
 url=await typescriptModuleUrl(path.join(root,'src/lib/nailRenderer.ts'),{'./paintRenderer':paintWrap});
}
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());await page.goto(base+'/try-on',{waitUntil:'networkidle'});
 const cdp=await page.context().newCDPSession(page);let sampling=false,includesCollected=false;
 await page.evaluate(async({url,paintUrl})=>{const source=await(await fetch(url)).text(),blob=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));window.__tailRenderer=(await import(blob)).drawNails;window.__tailStats=(await import(paintUrl)).paintRenderCacheStats;URL.revokeObjectURL(blob);},{url,paintUrl});
 if(diagnostic){await cdp.send('HeapProfiler.enable');try{await cdp.send('HeapProfiler.startSampling',{samplingInterval:32768,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});includesCollected=true;}catch{await cdp.send('HeapProfiler.startSampling',{samplingInterval:32768});}sampling=true;}
 await cdp.send('Tracing.start',{transferMode:'ReturnAsStream',traceConfig:{recordMode:'recordAsMuchAsPossible',includedCategories:['devtools.timeline','v8','v8.gc','blink.user_timing','disabled-by-default-v8.gc']}});
 const heapBefore=await cdp.send('Runtime.getHeapUsage');
 const result=await page.evaluate(async({fixture,nails,frames,pace,scenario,motion,diagnostic})=>{
  const c=document.createElement('canvas');c.width=800;c.height=1040;const ctx=c.getContext('2d'),draw=window.__tailRenderer;
  const names=['drawImage','clearRect','fill','stroke','clip','createLinearGradient','createRadialGradient','getImageData','putImageData','canvasCreate','canvasResize','pathCreate','imageDataCreate','cacheFind','cacheAdd','art','cacheHit','prefixHit','cacheMiss','save','restore','transform','gradientStop'];
  const times=new Float64Array(frames*names.length),counts=new Uint32Array(frames*names.length),draws=new Float64Array(frames),prep=new Float64Array(frames),starts=new Float64Array(frames),intervals=new Float64Array(frames),heaps=new Float64Array(frames),scales=new Float64Array(frames),undo=[];
  const ids=new Map(names.map((n,i)=>[n,i])),slowCalls=diagnostic?Array.from({length:frames},()=>[]):null;let current=-1;
  window.__tailCount=name=>{if(current>=0)counts[current*names.length+ids.get(name)]++;};
  window.__tailPhase=(name,fn)=>{if(current<0)return fn();const at=current*names.length+ids.get(name),t=performance.now();counts[at]++;try{return fn();}finally{times[at]+=performance.now()-t;}};
  if(diagnostic){
   for(const method of ['drawImage','clearRect','fill','stroke','clip','createLinearGradient','createRadialGradient','getImageData','putImageData','save','restore']){const p=CanvasRenderingContext2D.prototype,old=p[method];p[method]=function(...a){return window.__tailPhase(method,()=>{const t=performance.now(),v=old.apply(this,a),ms=performance.now()-t;if(current>=0&&ms>5&&slowCalls[current].length<4)slowCalls[current].push({method,ms,source:[a[0]?.width,a[0]?.height],destination:[this.canvas.width,this.canvas.height],stack:new Error().stack.split('\n').slice(1,7).map(s=>({name:s.trim().split(' (')[0].replace(/data:.*/,'[compiled module]'),location:s.match(/:(\d+):(\d+)\)?$/)?.slice(1)}))});return v;});};undo.push(()=>p[method]=old);}
   for(const method of ['translate','rotate','scale','transform','setTransform']){const p=CanvasRenderingContext2D.prototype,old=p[method];p[method]=function(...a){return window.__tailPhase('transform',()=>old.apply(this,a));};undo.push(()=>p[method]=old);}
   const stop=CanvasGradient.prototype.addColorStop;CanvasGradient.prototype.addColorStop=function(...a){return window.__tailPhase('gradientStop',()=>stop.apply(this,a));};undo.push(()=>CanvasGradient.prototype.addColorStop=stop);
   const create=document.createElement;document.createElement=function(...a){if(a[0]==='canvas')return window.__tailPhase('canvasCreate',()=>create.apply(this,a));return create.apply(this,a);};undo.push(()=>document.createElement=create);
   for(const key of ['width','height']){const p=HTMLCanvasElement.prototype,d=Object.getOwnPropertyDescriptor(p,key);Object.defineProperty(p,key,{...d,set(v){return window.__tailPhase('canvasResize',()=>d.set.call(this,v));}});undo.push(()=>Object.defineProperty(p,key,d));}
   for(const name of ['Path2D','ImageData']){const original=window[name];window[name]=new Proxy(original,{construct(t,a){return window.__tailPhase(name==='Path2D'?'pathCreate':'imageDataCreate',()=>Reflect.construct(t,a));}});undo.push(()=>window[name]=original);}
  }
  const fingers=fixture.document.fingers,design=fingers[0].base,poses=nails.map(n=>({...n}));
  for(let i=0;i<24;i++)await draw(ctx,800,1040,poses,design,{fingers,clear:true});
  const raf=()=>new Promise(requestAnimationFrame),sleep=ms=>new Promise(r=>setTimeout(r,ms));let previous=performance.now(),due=previous;const wallStart=previous;
  try{for(let n=0;n<frames;n++){
   if(pace){const wait=due-performance.now();if(wait>0)await sleep(wait);}await raf();
   const entered=performance.now();intervals[n]=entered-previous;previous=entered;due=Math.max(due+pace,entered);
   const t=performance.now(),phase=n/frames*Math.PI*2*5+(motion==='jitter'?.13*Math.sin(n*.013):0),scale=scenario==='distance'?.78+.48*(1-Math.cos(phase))/2:1;scales[n]=scale;
   for(let i=0;i<poses.length;i++){poses[i].width=nails[i].width*scale*(scenario==='distance'&&motion==='jitter'?1+.01*Math.sin(n*.051+i):1);poses[i].height=nails[i].height*scale*(scenario==='distance'&&motion==='jitter'?1+.012*Math.cos(n*.039+i):1);if(nails[i].anchorHeight!==undefined)poses[i].anchorHeight=nails[i].anchorHeight*scale;}
   const art=scenario==='eraser'?fingers.map((f,i)=>i?f:{...f,layers:f.layers.map((l,j)=>j===f.layers.length-1?{...l,points:l.points.map((p,k)=>k===l.points.length-1?{x:p.x,y:p.y+Math.sin(n*.02)*.01}:p)}:l)}):fingers;
   prep[n]=performance.now()-t;performance.mark('tail-start:'+n);current=n;starts[n]=performance.now();
   await draw(ctx,800,1040,poses,design,{fingers:art,clear:true});draws[n]=performance.now()-starts[n];current=-1;performance.mark('tail-end:'+n);
   heaps[n]=performance.memory?.usedJSHeapSize??0;
  }}finally{current=-1;for(const f of undo.reverse())f();}
  const elapsedMs=performance.now()-wallStart;return{elapsedMs,cacheStats:window.__tailStats(),names,frames:Array.from(draws,(drawMs,i)=>({i,drawMs,prepMs:prep[i],startMs:starts[i],intervalMs:intervals[i],scale:scales[i],heapBytes:heaps[i],...diagnostic?{slowCalls:slowCalls[i],phases:Object.fromEntries(names.map((n,j)=>[n,{calls:counts[i*names.length+j],ms:times[i*names.length+j]}]).filter(([,v])=>v.calls))}:{}})),ua:navigator.userAgent,paceMs:pace};
 },{fixture,nails:defaultPhotoNails,frames,pace,scenario,motion,diagnostic});
 const heapAfter=await cdp.send('Runtime.getHeapUsage');
 if(sampling){const{profile}=await cdp.send('HeapProfiler.stopSampling'),sizes=new Map();const visit=(n,stack)=>{const name=n.callFrame.functionName||'(anonymous)',s=[...stack,name];if(n.selfSize)sizes.set(s.slice(-5).join(' > '),(sizes.get(s.slice(-5).join(' > '))??0)+n.selfSize);for(const ch of n.children??[])visit(ch,s);};visit(profile.head,[]);result.sampledAllocations=[...sizes].sort((a,b)=>b[1]-a[1]).slice(0,25);result.samplingIncludesCollected=includesCollected;}
 const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const{stream}=await complete;let raw='';while(true){const r=await cdp.send('IO.read',{handle:stream});raw+=r.base64Encoded?Buffer.from(r.data,'base64').toString('utf8'):r.data;if(r.eof)break;}await cdp.send('IO.close',{handle:stream});
 const trace=JSON.parse(raw).traceEvents,marks=new Map();for(const e of trace){const m=/^tail-(start|end):(\d+)$/.exec(e.name);if(m){const row=marks.get(+m[2])??{};row[m[1]]=e.ts;row.pid=e.pid;row.tid=e.tid;marks.set(+m[2],row);}}
 const gc=trace.filter(e=>['MinorGC','MajorGC'].includes(e.name)&&e.ph==='X'),gcNames=[...new Set(trace.filter(e=>/GC|Scavenge/i.test(e.name)).map(e=>e.name))];
 assert.equal(marks.size,frames,'trace dropped frame markers');assert.ok([...marks.values()].every(m=>m.start!==undefined&&m.end!==undefined),'trace missing frame boundary');
 for(const r of result.frames){const m=marks.get(r.i);r.gcEvents=[];if(!m?.start||!m?.end)continue;for(const e of gc)if(e.pid===m.pid&&e.tid===m.tid&&e.ts<m.end&&e.ts+e.dur>m.start)r.gcEvents.push({name:e.name,overlapMs:(Math.min(e.ts+e.dur,m.end)-Math.max(e.ts,m.start))/1000});}
 const sorted=result.frames.map(r=>r.drawMs).sort((a,b)=>a-b),q=p=>sorted[Math.floor((sorted.length-1)*p)],long=Object.fromEntries([16.7,25,33,50].map(t=>['over'+t+'Ms',sorted.filter(v=>v>t).length]));
 const first=marks.get(0),last=marks.get(frames-1),timedGc=gc.filter(e=>first&&last&&e.pid===first.pid&&e.tid===first.tid&&e.ts<last.end&&e.ts+e.dur>first.start);
 const summary={frames,min:sorted[0],p50:q(.5),p90:q(.9),p95:q(.95),p99:q(.99),max:sorted.at(-1),longFrames:long,observedJsHeapPeakBytes:Math.max(...result.frames.map(r=>r.heapBytes)),heapSampleSource:'performance.memory (coarse) after each draw, excludes native/GPU; reporting allocations only in heapAfter',heapBefore,heapAfter,gcEvents:timedGc.length,gcNames,gcOverlapLongFrames:result.frames.filter(r=>r.drawMs>16.7&&r.gcEvents.length).length,effectiveSubmissionFps:1000*frames/result.elapsedMs,elapsedMs:result.elapsedMs};
 const slowest=[...result.frames].sort((a,b)=>b.drawMs-a.drawMs).slice(0,Math.max(12,Math.ceil(frames*.01)));
 await writeFile(out,JSON.stringify({scope:diagnostic?'instrumented per-frame diagnostics, overhead included; not the latency acceptance run':'renderer CPU submission with GC trace, no native API wrappers; not GPU presentation or hardware phones',scenario,motion,root,diagnostic,summary,slowest,...result},null,2));
 // Trace is private QA evidence. Strip huge data: script URLs, keep event data.
 await writeFile(out+'.trace.json',JSON.stringify({traceEvents:trace},(k,v)=>typeof v==='string'&&v.startsWith('data:')?'[local compiled module]':v));console.log(JSON.stringify(summary));
}finally{await browser.close();}
