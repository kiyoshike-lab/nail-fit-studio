import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
if(!opt('--playwright-module')||!opt('--image'))throw Error('--playwright-module and --image required');
const base=opt('--base-url')??'http://localhost:4210';if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const rows=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();
 page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 await page.route('**/__qa__/hand.jpg',r=>r.fulfill({path:path.resolve(opt('--image')),contentType:'image/jpeg'}));
 await page.goto(`${base}/try-on`,{waitUntil:'networkidle'});await page.waitForTimeout(800);assert.equal(await page.locator('.tracking-diagnostics').count(),0,'diagnostics always visible');
 await page.goto(`${base}/try-on?diagnostics=1`,{waitUntil:'networkidle'});await page.locator('.tracking-diagnostics').waitFor();
 const copy=async()=>{await page.getByRole('button',{name:'診断結果をコピー',exact:true}).click();return JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()));};
 for(const width of[320,390,430,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`horizontal overflow ${width}`);rows.push({width,overflow:false});}
 await page.setViewportSize({width:390,height:844});
 // Camera success + real MediaPipe VIDEO on Canvas.captureStream. Not a physical device.
 await page.evaluate(async()=>{
  const image=new Image();image.src='/__qa__/hand.jpg';await image.decode();const c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d');window.__blank=false;window.__streams=[];
  window.__timer=setInterval(()=>{ctx.fillStyle='#777';ctx.fillRect(0,0,640,480);if(!window.__blank){const h=430,w=h*image.width/image.height;ctx.drawImage(image,320-w/2,240-h/2,w,h);}},33);
  navigator.mediaDevices.getUserMedia=async()=>{const s=c.captureStream(30);window.__streams.push(s);return s;};
  navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'sensitive-test-device',label:'PRIVATE_CAMERA_LABEL'}];
 });
 await page.locator('.bottom-nav').getByRole('button',{name:'カメラ',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.tracking-diagnostics')?.textContent.includes('描画呼出 5本'));
 let snapshot=await copy();for(let retry=0;retry<5&&(snapshot.inference.landmarks!==21||snapshot.nails.rendered!==5);retry++){await page.waitForTimeout(400);snapshot=await copy();}assert.equal(snapshot.inference.landmarks,21,JSON.stringify(snapshot));assert.equal(snapshot.nails.rendered,5);assert.equal(snapshot.nails.manual,false);assert.ok(snapshot.inference.actualIntervalMs>=0);assert.equal(snapshot.camera.width,640);assert.ok(snapshot.inference.successes>0);assert.ok(snapshot.engine.initializationMs>=0);
 const diagnostic=JSON.stringify(snapshot);assert.ok(!/PRIVATE_CAMERA_LABEL|sensitive-test-device|data:image|landmarks":\[|token=/.test(diagnostic),'private data in copy');
 rows.push({case:'real model + VIDEO + draw',snapshot});
 await page.evaluate(()=>window.__blank=true);
 await page.waitForFunction(()=>document.querySelector('.preview-header')?.textContent.includes('手を認識できませんでした'));
 await page.getByRole('button',{name:'自動認識を再試行',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.__streams.at(-1).active),true);snapshot=await copy();assert.equal(snapshot.stage,'D-no-hands');rows.push({case:'no hand guidance, stream remains active',snapshot});
 await page.getByRole('button',{name:'自動認識を再試行',exact:true}).click();await page.evaluate(()=>window.__blank=false);
 await page.waitForFunction(()=>document.querySelector('.tracking-diagnostics')?.textContent.includes('描画呼出 5本'));
 assert.equal(await page.evaluate(()=>window.__streams.length),1,'recognition retry restarted camera');rows.push({case:'retry recovers five nails without new stream',passed:true});
 await page.locator('video').evaluate(v=>v.pause());
 await page.waitForFunction(()=>document.querySelector('.preview-header')?.textContent.includes('動画フレームを待っています'));
 await page.getByRole('button',{name:'自動認識を再試行',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.tracking-diagnostics')?.textContent.includes('描画呼出 5本')&&!document.querySelector('video').paused);
 assert.equal(await page.evaluate(()=>window.__streams.length),1);rows.push({case:'paused video resumes on recognition retry without stream restart',passed:true});
 await page.locator('.bottom-nav').getByRole('button',{name:'止める',exact:true}).click();assert.equal(await page.evaluate(()=>window.__streams.at(-1).active),false);
 await page.evaluate(()=>{clearInterval(window.__timer);navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('PRIVATE_TOKEN','NotAllowedError');};});
 await page.locator('.bottom-nav').getByRole('button',{name:'カメラ',exact:true}).click();await page.waitForTimeout(800);snapshot=await copy();assert.equal(snapshot.stage,'A-camera');assert.equal(snapshot.lastError.name,'NotAllowedError');assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_TOKEN'));
 rows.push({case:'permission denial',snapshot});assert.deepEqual(errors,[]);
 if(opt('--output'))await writeFile(opt('--output'),JSON.stringify({kind:'headless desktop Chrome; mobile widths, real model + still-driven captureStream, not iPhone/Android hardware',rows,errors},null,2));
 console.log(JSON.stringify({layouts:4,diagnosticsOptIn:true,copy:true,realModelVideoNails:5,noHandRetry:true,cameraDenial:true,errors}));
}finally{await browser.close();}
