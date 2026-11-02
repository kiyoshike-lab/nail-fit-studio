// Repeatable local production lab. CDP throttling/SwiftShader are NOT phone hardware.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url')??'http://127.0.0.1:4220',runs=Number(opt('--runs')??3);
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local production only');
if(!opt('--playwright-module')||!opt('--output'))throw Error('--playwright-module and --output required');
if(!args.includes('--nav-only')&&!opt('--image'))throw Error('--image required for camera QA');
if(!Number.isInteger(runs)||runs<1||runs>20)throw Error('--runs must be 1..20');
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const imageData=opt('--image')?'data:image/jpeg;base64,'+(await readFile(opt('--image'))).toString('base64'):'';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const navigation=[],camera=[],errors=[];
async function setup(cpu=1){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 // Playwright route() disables HTTP cache. Block third parties via CDP instead
 // so the second visit really exercises the browser's cache/revalidation path.
 await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['*googlesyndication.com/*','*googletagmanager.com/*','*google-analytics.com/*','*doubleclick.net/*']});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:1250000,uploadThroughput:625000,connectionType:'cellular4g'});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(90000);
 await page.addInitScript(()=>{
  window.__lcp=null;window.__blockingMs=0;
  new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp={ms:e.startTime,url:e.url,tag:e.element?.tagName};}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries())window.__blockingMs+=Math.max(0,e.duration-50);}).observe({type:'longtask',buffered:true});
 });return {context,page,cdp};
}
try{
 if(!args.includes('--camera-only'))for(let run=0;run<runs;run++)for(const route of ['/','/try-on']){
  const {context,page}=await setup(4);await page.goto(base+route,{waitUntil:'networkidle'});await page.waitForTimeout(800);
  navigation.push({run,route,...await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0],resources=performance.getEntriesByType('resource');return{
   ttfbMs:n.responseStart,dclMs:n.domContentLoadedEventEnd,fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,lcp:window.__lcp,blockingMs:window.__blockingMs,
   js:resources.filter(r=>/\.js(?:\?|$)/.test(r.name)).map(r=>({path:new URL(r.name).pathname,encoded:r.encodedBodySize,decoded:r.decodedBodySize,start:r.startTime,end:r.responseEnd})),
   presetNodes:document.querySelectorAll('.preset-card').length,mediaRequests:resources.filter(r=>r.name.includes('/mediapipe/')).length};})});await context.close();
 }
 if(!args.includes('--nav-only'))for(let run=0;run<runs;run++){
  const {context,page}=await setup(1);
  await page.addInitScript(()=>{
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async s=>{window.__snapshot=JSON.parse(s);}}});
   window.__wasm=[];
   for(const key of ['instantiate','instantiateStreaming']){const original=WebAssembly[key];if(!original)continue;WebAssembly[key]=function(...args){const start=performance.now(),size=args[0]?.byteLength??null;const result=original.apply(this,args);if(result?.then)return result.then(value=>{window.__wasm.push({api:key,size,ms:performance.now()-start,start});return value;},e=>{window.__wasm.push({api:key,size,ms:performance.now()-start,start,failed:true});throw e;});return result;};}
   const clear=CanvasRenderingContext2D.prototype.clearRect,rotate=CanvasRenderingContext2D.prototype.rotate;
   CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.classList.contains('nail-canvas'))window.__rotations=0;return clear.apply(this,a);};
   CanvasRenderingContext2D.prototype.rotate=function(...a){if(this.canvas.classList.contains('nail-canvas')&&++window.__rotations===10&&window.__start&&!window.__firstFive&&this.globalAlpha>.05&&Number(getComputedStyle(this.canvas).opacity)>.05&&document.querySelector('.detection-status')?.textContent==='手を検出しました')window.__firstFive=performance.now();return rotate.apply(this,a);};
   document.addEventListener('playing',()=>{if(window.__start&&!window.__videoReady)window.__videoReady=performance.now();},true);
   new MutationObserver(()=>{if(window.__start&&!window.__firstHand&&document.querySelector('.detection-status')?.textContent==='手を検出しました')window.__firstHand=performance.now();}).observe(document,{subtree:true,childList:true,characterData:true});
  });
  for(const cache of ['cold','warm']){
   await page.goto(base+'/try-on?diagnostics=1',{waitUntil:'networkidle'});await page.locator('.tracking-diagnostics').waitFor();
   await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');window.__timer=setInterval(()=>{x.fillStyle='#777';x.fillRect(0,0,640,480);const h=430,w=h*image.width/image.height;x.drawImage(image,320-w/2,240-h/2,w,h);},33);navigator.mediaDevices.getUserMedia=async()=>{window.__gum=performance.now();const s=c.captureStream(30);window.__stream=s;return s;};navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'qa',label:'QA Camera'}];window.__start=performance.now();},imageData);
   await page.locator('.bottom-nav').getByRole('button',{name:'カメラ',exact:true}).click();
   await page.waitForFunction(()=>window.__firstFive>0);await page.waitForFunction(()=>document.querySelector('.tracking-diagnostics')?.textContent.includes('描画呼出 5本'));
   const read=async()=>{await page.getByRole('button',{name:'診断結果をコピー',exact:true}).evaluate(e=>e.click());return page.evaluate(()=>window.__snapshot);};
   let snapshot=await read();for(let retry=0;retry<60&&snapshot.inference.successes<12;retry++){await page.waitForTimeout(500);snapshot=await read();}
   assert.ok(snapshot.inference.successes>=12,'tracking stopped before a steady-state sample');
   const row={run,cache,snapshot,...await page.evaluate(()=>({getUserMediaMs:window.__gum-window.__start,videoReadyMs:window.__videoReady-window.__start,firstHandUiMs:window.__firstHand-window.__start,firstFiveMs:window.__firstFive-window.__start,wasm:window.__wasm,
    resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('/mediapipe/')).map(r=>({path:new URL(r.name).pathname,start:r.startTime-window.__start,end:r.responseEnd-window.__start,duration:r.duration,encoded:r.encodedBodySize,decoded:r.decodedBodySize,transfer:r.transferSize}))}))};
   assert.ok(row.firstFiveMs>=row.firstHandUiMs&&row.firstFiveMs>Math.max(...row.resources.map(r=>r.end)),'counted invisible pre-detection manual poses');camera.push(row);console.log(`camera ${run} ${cache}: visible-five=${row.firstFiveMs.toFixed(0)}ms`);
   await page.locator('.bottom-nav').getByRole('button',{name:'止める',exact:true}).click();await page.evaluate(()=>clearInterval(window.__timer));
  }await context.close();
 }
 assert.deepEqual(errors,[]);const report={kind:'production on localhost, 10Mbps/80ms; navigation CPU4x, camera CPU1x/SwiftShader/still-derived 640x480 stream; ads/GA blocked, not physical phone or field speed',base,runs,navigation,camera,errors};
 await writeFile(opt('--output'),JSON.stringify(report,null,2));console.log(JSON.stringify({navigation:navigation.map(n=>({...n,js:n.js.reduce((s,r)=>s+r.encoded,0)})),camera:camera.map(c=>({run:c.run,cache:c.cache,firstHandUiMs:c.firstHandUiMs,firstFiveMs:c.firstFiveMs,engineMs:c.snapshot.engine.initializationMs,resources:c.resources,wasm:c.wasm})),errors},null,2));
}finally{await browser.close();}
