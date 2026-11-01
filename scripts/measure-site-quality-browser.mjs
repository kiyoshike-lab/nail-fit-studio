// Repeatable local lab measurements, not hardware-camera startup or phone FPS.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url')??'http://127.0.0.1:4212';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const navigation=[];
try{
 for(const route of ['/','/try-on'])for(let run=0;run<3;run++){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
  await page.goto(base+route,{waitUntil:'networkidle'});
  navigation.push({route,run,...await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return{ttfbMs:n.responseStart,domContentLoadedMs:n.domContentLoadedEventEnd,loadMs:n.loadEventEnd,fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,transferredBytes:performance.getEntriesByType('resource').reduce((s,r)=>s+r.transferSize,0)};})});
  await context.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(90000);
 const errors=[],imagePosts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).origin===new URL(base).origin)imagePosts.push({path:new URL(r.url()).pathname,bytes:r.postDataBuffer()?.length??0});});
 await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 await page.route('**/__quality__/hand.jpg',r=>r.fulfill({path:path.resolve(opt('--image')),contentType:'image/jpeg'}));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__diagnostic=JSON.parse(text);}}});});
 await page.goto(base+'/try-on?diagnostics=1',{waitUntil:'networkidle'});await page.locator('.tracking-diagnostics').waitFor();
 await page.evaluate(async()=>{
  const image=new Image();image.src='/__quality__/hand.jpg';await image.decode();const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');window.__blank=false;window.__stream=null;
  window.__timer=setInterval(()=>{x.fillStyle='#777';x.fillRect(0,0,640,480);if(!window.__blank){const h=430,w=h*image.width/image.height;x.drawImage(image,320-w/2,240-h/2,w,h);}},33);
  navigator.mediaDevices.getUserMedia=async()=>{window.__stream=c.captureStream(30);return window.__stream;};navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'qa',label:'QA Camera'}];
 });
 const started=Date.now();await page.locator('.bottom-nav').getByRole('button',{name:'カメラ',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0&&!document.querySelector('video').paused);const videoReadyMs=Date.now()-started;
 await page.waitForFunction(()=>document.querySelector('.tracking-diagnostics')?.textContent.includes('描画呼出 5本'));const firstFiveMs=Date.now()-started;
 const copy=async()=>{await page.getByRole('button',{name:'診断結果をコピー',exact:true}).evaluate(e=>e.click());return page.evaluate(()=>window.__diagnostic);};
 const targetFrames=Number(opt('--frames')??12),steady=[];
 let snapshot=await copy();while(snapshot.inference.successes<targetFrames){await page.waitForTimeout(800);snapshot=await copy();if(snapshot.profile.frames>=12)steady.push({frames:snapshot.profile.frames,drawFps:snapshot.nails.drawFps,detectionFps:snapshot.performance.detectionFps,modelMs:snapshot.profile.latest?.modelMs,pixelsMs:snapshot.profile.latest?.pixelsMs,totalMs:snapshot.profile.latest?.totalMs,drawMs:snapshot.nails.drawMs});}
 let heapAfterGcBytes=null;
 if(args.includes('--collect-gc')){const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');heapAfterGcBytes=(await cdp.send('Runtime.getHeapUsage')).usedSize;await cdp.detach();}
 await page.evaluate(()=>window.__blank=true);await page.waitForFunction(()=>document.querySelector('.detection-status')?.textContent==='手を見失いました');await page.waitForTimeout(500);
 const recoveryStart=Date.now();await page.evaluate(()=>window.__blank=false);await page.waitForFunction(()=>document.querySelector('.detection-status')?.textContent==='手を検出しました');const recoveryMs=Date.now()-recoveryStart;
 await page.locator('.bottom-nav').getByRole('button',{name:'止める',exact:true}).click();assert.equal(await page.evaluate(()=>window.__stream.active),false);await page.evaluate(()=>clearInterval(window.__timer));
 assert.deepEqual(errors,[]);assert.deepEqual(imagePosts,[]);
 const report={kind:'local production headless desktop Chrome; software GPU; 640x480 still-photo captureStream; no network throttling, ads/GA blocked; not iPhone/Android or physical camera timing',navigation,camera:{syntheticVideoReadyMs:videoReadyMs,firstFiveMs,recoveryMs,snapshot,steady,heapAfterGcBytes},imagePostRequests:imagePosts,errors};
 await writeFile(opt('--output'),JSON.stringify(report,null,2));console.log(JSON.stringify({navigation,videoReadyMs,firstFiveMs,recoveryMs,initMs:snapshot.engine.initializationMs,frames:snapshot.profile.frames,timings:snapshot.profile.timings,drawMs:snapshot.nails.drawMs,drawFps:snapshot.nails.drawFps,performance:snapshot.performance,errors},null,2));
}finally{await browser.close();}
