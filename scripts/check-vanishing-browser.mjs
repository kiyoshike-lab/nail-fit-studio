// Actual app + bundled MediaPipe + actual Canvas, with a camera driven by a
// local still image. NOT a physical USB/phone or recorded 3D rotation test.
import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2),option=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
for(const flag of ['--image','--playwright-module'])if(!option(flag))throw Error(`${flag} required`);
const base=option('--base-url')??'http://127.0.0.1:4194';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
const {chromium}=await import(pathToFileURL(path.resolve(option('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  // Observe, don't stub, the real Canvas rendering. Default cream/solid draws
  // two rotations per nail (cuticle shadow + plate). Clear starts a new frame.
  const clear=CanvasRenderingContext2D.prototype.clearRect,rotate=CanvasRenderingContext2D.prototype.rotate;
  CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.classList.contains('nail-canvas'))window.__nailRotations=0;return clear.apply(this,a);};
  CanvasRenderingContext2D.prototype.rotate=function(...a){if(this.canvas.classList.contains('nail-canvas'))window.__nailRotations=(window.__nailRotations??0)+1;return rotate.apply(this,a);};
 });
 await page.route(/googlesyndication|googletagmanager|google-analytics/,route=>route.abort());
 await page.route('**/__qa__/dorsal.jpg',route=>route.fulfill({path:path.resolve(option('--image')),contentType:'image/jpeg'}));
 await page.goto(`${base}/try-on`,{waitUntil:'networkidle'});
 await page.locator('input[type=file]').first().setInputFiles(path.resolve(option('--image')));
 await page.waitForFunction(()=>!document.querySelector('.loading-badge')&&document.querySelector('.preview-header')?.textContent.includes('自動配置'));
 await page.waitForFunction(()=>window.__nailRotations===10);
 await page.waitForTimeout(500);
 const photo=await page.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.nails.v1')));
 assert.equal(photo.filter(n=>n.visibility>0).length,5,'real photo did not show five nails');
 console.log('stage: photo detected and five Canvas nails rendered');
 await page.locator('.setting-block').evaluateAll(elements=>elements.forEach(e=>e.open=true));
 await page.evaluate(async()=>{
  const image=new Image();image.src='/__qa__/dorsal.jpg';await image.decode();
  const c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d');
  window.__zoom=.70;window.__dx=0;window.__blank=false;window.__streams=[];
  window.__cameraTimer=setInterval(()=>{ctx.fillStyle='#777';ctx.fillRect(0,0,640,480);if(!window.__blank){const h=450*window.__zoom,w=h*image.width/image.height;ctx.drawImage(image,320-w/2+window.__dx,240-h/2,w,h);}},33);
  navigator.mediaDevices.getUserMedia=async()=>{const stream=c.captureStream(30);window.__streams.push(stream);return stream;};
  navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'qa-camera',label:'USB QA Camera'}];
 });
 await page.setViewportSize({width:390,height:844});
 await page.locator('.bottom-nav').getByRole('button',{name:'カメラ',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.detection-status')?.textContent==='手を検出しました'&&window.__nailRotations===10);
 await page.waitForTimeout(2000);
 console.log('stage: unmirrored VIDEO rendered five Canvas nails');
 const pose=async()=>({width:Number(await page.getByLabel('幅',{exact:true}).inputValue()),height:Number(await page.getByLabel('この指の長さ',{exact:true}).inputValue()),x:Number(await page.getByLabel('横位置',{exact:true}).inputValue())});
 const far=await pose();
 await page.evaluate(()=>window.__zoom=.98);await page.waitForTimeout(3000);
 await page.waitForFunction(()=>window.__nailRotations===10);const near=await pose();
 assert.ok(near.width/far.width>1.1&&near.height/far.height>1.1,`distance scaling failed ${JSON.stringify({far,near})}`);
 await page.evaluate(()=>window.__dx=35);await page.waitForTimeout(2000);const moved=await pose();assert.ok(moved.x>near.x+2);
 assert.equal(await page.locator('video').evaluate(v=>v.classList.contains('is-mirrored')),false);
 await page.setViewportSize({width:1280,height:900});
 const front=page.getByRole('button',{name:'内カメラ優先にする',exact:true});
 await front.scrollIntoViewIfNeeded();await front.click();
 await page.waitForFunction(()=>document.querySelector('video')?.classList.contains('is-mirrored')&&window.__nailRotations===10);
 assert.equal(await page.evaluate(()=>window.__streams[0].active),false);
 assert.equal(await page.evaluate(()=>window.__streams.at(-1).active),true);
 console.log('stage: mirrored VIDEO rendered five nails; previous stream released');
 await page.evaluate(()=>window.__blank=true);
 await page.waitForFunction(()=>document.querySelector('.detection-status')?.textContent==='手を見失いました');
 await page.waitForTimeout(800);
 assert.equal(await page.locator('.nail-canvas').evaluate(c=>Number(getComputedStyle(c).opacity)),0);
 await page.evaluate(()=>window.__blank=false);
 await page.waitForFunction(()=>document.querySelector('.detection-status')?.textContent==='手を検出しました'&&window.__nailRotations===10);
 await page.locator('details').evaluateAll(elements=>elements.forEach(e=>e.open=true));
 const capture=page.getByRole('button',{name:'写真として固定',exact:true});await capture.scrollIntoViewIfNeeded();await capture.click();
 assert.equal(await page.evaluate(()=>window.__streams.at(-1).active),false);
 await page.evaluate(()=>{navigator.canShare=()=>false;clearInterval(window.__cameraTimer);});
 await page.setViewportSize({width:390,height:844});
 const saved=page.waitForEvent('download');await page.locator('.bottom-nav').getByRole('button',{name:'保存',exact:true}).click();
 assert.equal((await saved).suggestedFilename(),'nail-fit-studio.png');assert.deepEqual(errors,[]);
 if(option('--screenshot'))await page.screenshot({path:option('--screenshot')});
 const report={kind:'headless Chrome + real bundled MediaPipe + Canvas.captureStream of a real dorsal photo; not physical camera or recorded motion',photoNails:5,videoDrawnNails:5,mirroredVideoDrawnNails:5,far,near,moved,errors,
  passed:['photo detection to five actual Canvas nails','VIDEO detection to five actual Canvas nails','distance scale','horizontal tracking','rear-like unmirrored / front-like mirrored preview','camera switch releases old stream','loss and reacquisition','capture and PNG save']};
 if(option('--output'))await writeFile(option('--output'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
