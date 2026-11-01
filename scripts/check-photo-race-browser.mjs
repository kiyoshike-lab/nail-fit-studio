import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url')??'http://127.0.0.1:4212';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const b=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await b.newPage({viewport:{width:1280,height:900}});await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 await p.addInitScript(()=>{const original=createImageBitmap;window.createImageBitmap=async(...a)=>{if(a[0].name==='slow.png')await new Promise(r=>setTimeout(r,1200));return original(...a);};const create=URL.createObjectURL,revoke=URL.revokeObjectURL;window.__created=[];window.__revoked=[];URL.createObjectURL=(...a)=>{const u=create(...a);window.__created.push(u);return u;};URL.revokeObjectURL=u=>{window.__revoked.push(u);revoke(u);};});
 await p.goto(base+'/try-on',{waitUntil:'networkidle'});
 const img=await p.evaluate(()=>{const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c.toDataURL().split(',')[1];};return[make(640,480),make(480,640)];});
 const file=(i,name)=>({name,mimeType:'image/png',buffer:Buffer.from(img[i],'base64')});
 await p.locator('input[type=file]').setInputFiles(file(0,'slow.png'));await p.locator('input[type=file]').setInputFiles(file(1,'latest.png'));
 await p.waitForTimeout(2200);
 const result=await p.locator('img[alt="手の写真"]').evaluate(i=>({latestWidthExpected:480,actualWidth:i.naturalWidth,latestSelectionRetained:i.naturalWidth===480}));
 if(args.includes('--assert-fixed'))assert.equal(result.latestSelectionRetained,true);
 await p.locator('input[type=file]').setInputFiles(file(0,'slow.png'));await p.getByRole('button',{name:'サンプル写真で試す',exact:true}).click();await p.waitForTimeout(2200);
 result.sampleNotOverwritten=await p.locator('img[alt="手の写真"]').evaluate(i=>i.src.startsWith('data:image/svg+xml'));
 if(args.includes('--assert-fixed'))assert.equal(result.sampleNotOverwritten,true);
 if(args.includes('--assert-fixed')){
  await p.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('QA','NotAllowedError');};});await p.locator('input[type=file]').setInputFiles(file(0,'slow.png'));await p.setViewportSize({width:390,height:844});await p.locator('.bottom-nav').getByRole('button',{name:'カメラ',exact:true}).click();await p.waitForTimeout(2200);
  result.bottomCameraErrorNotOverwritten=await p.locator('img[alt="手の写真"]').evaluate(i=>i.src.startsWith('data:image/svg+xml')&&i.classList.contains('is-hidden'));assert.equal(result.bottomCameraErrorNotOverwritten,true);
  await p.setViewportSize({width:1280,height:900});const initial=await p.evaluate(()=>window.__created.length);await p.locator('input[type=file]').setInputFiles(file(0,'slow.png'));await p.getByRole('link',{name:'Nail Fit Studio ホーム',exact:true}).first().click();await p.waitForURL(base+'/');await p.waitForTimeout(2200);
  result.unmountedPhotoUrlsReleased=await p.evaluate(n=>window.__created.slice(n).length>0&&window.__created.slice(n).every(u=>window.__revoked.includes(u)),initial);assert.equal(result.unmountedPhotoUrlsReleased,true);
 }
 await writeFile(opt('--output'),JSON.stringify(result,null,2));console.log(result);
}finally{await b.close();}
