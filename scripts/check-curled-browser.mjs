// Real bundled model + real renderer. All camera frames originate from local
// stills; this is NOT physical 3D rotation, phone-camera or labelled-mask accuracy.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2),option=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
for(const flag of ['--curled-image','--back-image','--palm-image','--playwright-module','--output'])if(!option(flag))throw Error(`${flag} required`);
const base=option('--base-url')??'http://127.0.0.1:4198';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
const {chromium}=await import(pathToFileURL(path.resolve(option('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const clear=CanvasRenderingContext2D.prototype.clearRect,rotate=CanvasRenderingContext2D.prototype.rotate,draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.classList.contains('nail-canvas'))window.__rotations=0;return clear.apply(this,a);};
  CanvasRenderingContext2D.prototype.rotate=function(...a){if(this.canvas.classList.contains('nail-canvas'))window.__rotations=(window.__rotations??0)+1;return rotate.apply(this,a);};
  CanvasRenderingContext2D.prototype.drawImage=function(source,...a){if(source instanceof HTMLVideoElement&&this.canvas.width===640&&this.canvas.height===480)window.__samples=(window.__samples??0)+1;return draw.call(this,source,...a);};
 });
 await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 for(const name of ['curled','back','palm'])await page.route(`**/__curled_qa__/${name}.png`,r=>r.fulfill({path:path.resolve(option(`--${name==='curled'?'curled':name==='back'?'back':'palm'}-image`)),contentType:name==='back'?'image/jpeg':'image/png'}));
 await page.goto(base+'/try-on',{waitUntil:'networkidle'});
 await page.locator('input[type=file]').first().setInputFiles(path.resolve(option('--curled-image')));
 await page.waitForFunction(()=>!document.querySelector('.loading-badge')&&document.querySelector('.preview-header')?.textContent.includes('自動配置'));
 await page.waitForTimeout(500);
 const photo=await page.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.nails.v1')));
 const photoCount=photo.filter(n=>n.visibility>.05).length;assert.ok(photoCount>=3,'curled photo lost most supported nail fragments');
 assert.ok(photo.every(n=>!n.visibility||(n.visibilityState==='partial'&&n.clipContour?.length>=3)),'palm-side nail was painted without a bounded current mask');
 await page.waitForFunction(count=>window.__rotations===count*2,photoCount);
 if(option('--screenshot'))await page.screenshot({path:option('--screenshot')});
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.getByRole('button',{name:'ネイルあり / 長押しでBefore',exact:true}).click();
 await page.waitForFunction(()=>{const c=document.querySelector('.nail-canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i])return false;return true;});
 await page.getByRole('button',{name:'Before表示中',exact:true}).click();
 await page.waitForFunction(()=>{const c=document.querySelector('.nail-canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i])return true;return false;});
 await page.evaluate(()=>{navigator.canShare=()=>false;});await page.setViewportSize({width:390,height:844});
 const download=page.waitForEvent('download');await page.locator('.bottom-nav').getByRole('button',{name:'保存',exact:true}).click();assert.equal((await download).suggestedFilename(),'nail-fit-studio.png');
 await page.evaluate(async()=>{
  const images={};for(const name of ['curled','back','palm']){const im=new Image();im.src='/__curled_qa__/'+name+'.png';await im.decode();images[name]=im;}
  const c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d');window.__scene='curled';window.__samples=0;
  window.__timer=setInterval(()=>{ctx.fillStyle='#777';ctx.fillRect(0,0,640,480);const im=images[window.__scene],s=Math.min(600/im.width,440/im.height);ctx.drawImage(im,320-im.width*s/2,240-im.height*s/2,im.width*s,im.height*s);},33);
  navigator.mediaDevices.getUserMedia=async()=>{window.__stream=c.captureStream(30);return window.__stream;};
  navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'curled-qa',label:'Local still-frame QA camera'}];
 });
 await page.locator('.bottom-nav').getByRole('button',{name:'カメラ',exact:true}).click();
 await page.waitForFunction(()=>window.__samples>=6&&document.querySelector('.detection-status')?.textContent==='手を検出しました'&&window.__rotations>=2);
 await page.waitForTimeout(1000);
 const videoCounts=[];for(let i=0;i<10;i++){videoCounts.push(await page.evaluate(()=>window.__rotations/2));await page.waitForTimeout(100);}
 assert.ok(videoCounts.some(n=>n>=2),'curled VIDEO lost most supported nail fragments');
 await page.evaluate(()=>window.__scene='palm');await page.waitForTimeout(2000);
 await page.waitForFunction(()=>document.querySelector('.detection-status')?.textContent==='手を検出しました'&&window.__rotations===0);
 const palmCount=await page.evaluate(()=>window.__rotations/2);assert.equal(palmCount,0);
 await page.evaluate(()=>window.__scene='back');
 await page.waitForFunction(()=>document.querySelector('.detection-status')?.textContent==='手を検出しました'&&window.__rotations===10);
 await page.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
 const capture=page.getByRole('button',{name:'写真として固定',exact:true});await capture.scrollIntoViewIfNeeded();await capture.click();
 assert.equal(await page.evaluate(()=>window.__stream.active),false);await page.evaluate(()=>clearInterval(window.__timer));assert.deepEqual(errors,[]);
 const report={kind:'headless Chrome, actual self-hosted MediaPipe/Canvas, still-driven VIDEO; not a physical camera/recorded rotation or independent accuracy benchmark',photoCount,photoStates:photo.map(n=>n.visibilityState),videoCounts,palmCount,dorsalRecovered:5,errors,
  passed:['curled photo current clipped cores','actual Canvas painting','320/390/1280 widths','Before/After','curled PNG save','curled still-driven VIDEO','open-palm reference suppressed','dorsal five recovered','capture releases stream']};
 await writeFile(option('--output'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
