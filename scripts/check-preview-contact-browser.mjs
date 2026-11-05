// Local production UI + real MediaPipe, and a separate mocked-delivery server.
// Not iPhone/Android hardware, not physical motion, NOT an actual email receipt.
import assert from 'node:assert/strict';
import {readFile,writeFile}from'node:fs/promises';
import{pathToFileURL}from'node:url';import path from'node:path';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url')??'http://127.0.0.1:4224',ready=opt('--ready-base-url')??'http://127.0.0.1:4225';
for(const value of[base,ready])if(!['localhost','127.0.0.1'].includes(new URL(value).hostname))throw Error('Local QA only');
for(const flag of['--image','--playwright-module','--output'])if(!opt(flag))throw Error(flag+' required');
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const rows=[],errors=[];const thirdParty=/googlesyndication|googletagmanager|google-analytics/;
async function make(){const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const p=await c.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));await p.route(thirdParty,r=>r.abort());return p;}
try{
 const page=await make();await page.route('**/__qa__/dorsal.jpg',r=>r.fulfill({path:path.resolve(opt('--image')),contentType:'image/jpeg'}));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async s=>{window.__diagnostic=JSON.parse(s);}}});});
 await page.goto(base+'/try-on?diagnostics=1',{waitUntil:'networkidle'});
 const toggle=page.locator('.preview-toggle'),stage=page.locator('.preview-stage');
 assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 await page.locator('input[type=file]').setInputFiles(path.resolve(opt('--image')));
 await page.waitForFunction(()=>!document.querySelector('.loading-badge')&&document.querySelector('.preview-header').textContent.includes('自動配置'));
 await page.waitForTimeout(500);
 await page.evaluate(()=>{window.__originalVideo=document.querySelector('video');window.__originalCanvas=document.querySelector('.nail-canvas');window.__originalImage=document.querySelector('img[alt="手の写真"]');});
 const design=await page.evaluate(()=>localStorage.getItem('nail-fit-studio-next.design.v1'));
 for(const[width,height]of[[320,568],[375,812],[390,844],[430,932]]){
  await page.setViewportSize({width,height});await toggle.scrollIntoViewIfNeeded();
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');const compact=(await stage.boundingBox()).height;assert.equal(compact,84);
  await toggle.tap();assert.equal(await toggle.getAttribute('aria-expanded'),'true');const expanded=(await stage.boundingBox()).height;assert.ok(expanded>compact*2);
  await page.getByRole('button',{name:'ネイルあり / 長押しでBefore',exact:true}).tap();await page.getByRole('button',{name:'Before表示中',exact:true}).tap();
  await toggle.tap();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.ok(await page.evaluate(()=>document.querySelector('video')===window.__originalVideo&&document.querySelector('.nail-canvas')===window.__originalCanvas&&document.querySelector('img[alt="手の写真"]')===window.__originalImage));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('nail-fit-studio-next.design.v1')),design);
  rows.push({case:'photo compact/expanded, compare, stable elements/settings, no overflow',width,height,compact,expanded});
  if(opt('--screenshot-dir'))await page.screenshot({path:path.join(opt('--screenshot-dir'),`compact-${width}.png`)});
 }
 // Thumbnail touches/scrolling do not override compact or start calibration.
 const originalPoses=await page.evaluate(()=>localStorage.getItem('nail-fit-studio-next.nails.v1'));
 await stage.tap();assert.equal(await toggle.getAttribute('aria-expanded'),'false');await page.mouse.wheel(0,80);assert.equal(await toggle.getAttribute('aria-expanded'),'false');await toggle.tap();await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>localStorage.getItem('nail-fit-studio-next.nails.v1')),originalPoses);
 const index=1,pose=JSON.parse(originalPoses)[index],box=await stage.boundingBox(),source=await page.locator('img[alt="手の写真"]').evaluate(i=>({w:i.naturalWidth,h:i.naturalHeight}));
 const scale=Math.min(box.width/source.w,box.height/source.h),fitWidth=source.w*scale,fitHeight=source.h*scale;
 const x=box.x+(box.width-fitWidth)/2+pose.x/100*fitWidth,y=box.y+(box.height-fitHeight)/2+pose.y/100*fitHeight;
 await stage.evaluate(e=>{window.__dragEvents=[];for(const type of['pointerdown','pointermove','pointerup','pointercancel'])e.addEventListener(type,v=>{const r=e.getBoundingClientRect();window.__dragEvents.push({type,x:v.clientX,y:v.clientY,id:v.pointerId,w:r.width,h:r.height});});});
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+12,y,{steps:4});await page.mouse.up();await page.waitForTimeout(500);
 const adjusted=await page.evaluate(i=>JSON.parse(localStorage.getItem('nail-fit-studio-next.nails.v1'))[i],index);
 assert.ok(Math.abs(adjusted.x-(pose.x+12/fitWidth*100))<.3,JSON.stringify({case:'drag/contain coordinates changed after expanding',pose,adjusted,box,fitWidth,fitHeight,x,y,events:await page.evaluate(()=>window.__dragEvents)}));
 rows.push({case:'expanded photo drag follows intrinsic-source contain coordinates',expectedDelta:12/fitWidth*100,actualDelta:adjusted.x-pose.x});
 await page.evaluate(()=>{navigator.canShare=()=>false;});const download=page.waitForEvent('download');await page.locator('.bottom-nav').getByRole('button',{name:'保存',exact:true}).tap();const saved=await download;
 const png=await readFile(await saved.path()),size=await page.locator('img[alt="手の写真"]').evaluate(i=>({w:i.naturalWidth,h:i.naturalHeight}));assert.equal(png.readUInt32BE(16),size.w);assert.equal(png.readUInt32BE(20),size.h);rows.push({case:'export retains full source resolution',...size});
 await toggle.tap();await page.setViewportSize({width:1280,height:900});assert.equal(await toggle.isVisible(),false);assert.ok((await stage.boundingBox()).height>200);rows.push({case:'desktop remains full size',passed:true});
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(async()=>{const im=new Image();im.src='/__qa__/dorsal.jpg';await im.decode();const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');window.__timer=setInterval(()=>{x.fillStyle='#777';x.fillRect(0,0,640,480);const h=430,w=h*im.width/im.height;x.drawImage(im,320-w/2,240-h/2,w,h);},33);window.__streams=[];navigator.mediaDevices.getUserMedia=async()=>{const s=c.captureStream(30);window.__streams.push(s);return s;};navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'qa-camera',label:'QA camera'}];});
 await page.locator('.bottom-nav').getByRole('button',{name:'カメラ',exact:true}).tap();
 await page.waitForFunction(()=>document.querySelector('.tracking-diagnostics')?.textContent.includes('描画呼出 5本'));
 assert.equal(await toggle.getAttribute('aria-expanded'),'true');
 const snapshot=async()=>{await page.getByRole('button',{name:'診断結果をコピー',exact:true}).evaluate(b=>b.click());return page.evaluate(()=>window.__diagnostic);};
 const before=await snapshot();const time=await page.locator('video').evaluate(v=>v.currentTime);
 await toggle.tap();await page.waitForTimeout(1800);const after=await snapshot();
 assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>window.__streams.length),1);assert.equal(await page.evaluate(()=>window.__streams[0].active),true);assert.ok(await page.locator('video').evaluate((v,t)=>v.currentTime>t,time));assert.ok(after.inference.successes>before.inference.successes);assert.equal(after.nails.rendered,5);assert.ok(after.camera.width===640&&after.camera.height===480);assert.equal(after.engine.initializationMs,before.engine.initializationMs);
 await page.locator('details').evaluateAll(ds=>ds.forEach(d=>d.open=true));await page.getByLabel(/^形/).selectOption('round');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 await toggle.tap();await page.waitForTimeout(500);assert.equal((await snapshot()).nails.rendered,5);assert.equal(await page.evaluate(()=>window.__streams.length),1);
 await page.locator('.bottom-nav').getByRole('button',{name:'止める',exact:true}).tap();assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>window.__streams[0].active),false);await page.evaluate(()=>clearInterval(window.__timer));
 rows.push({case:'real VIDEO five, compact keeps same live stream/elements/inference, editor keeps preference, expand five, stop defaults compact',before:before.inference.successes,after:after.inference.successes});
 // Unconfigured real route must not accept messages, or load the CAPTCHA SDK.
 const unready=await make();let challenges=0;unready.on('request',r=>{if(r.url().includes('challenges.cloudflare.com'))challenges++;});await unready.goto(base+'/contact',{waitUntil:'networkidle'});await unready.getByText(/メールフォームは現在準備中/).waitFor();assert.equal(await unready.getByRole('button',{name:'問い合わせを送信',exact:true}).isDisabled(),true);assert.equal(challenges,0);
 const unavailable=await unready.request.post(base+'/api/contact',{headers:{Origin:base},data:{message:'test'}});assert.equal(unavailable.status(),503);rows.push({case:'real unconfigured form disabled and API 503, no challenge loaded',passed:true});
 // CAPTCHA widget is mocked, provider fetch is mocked by the QA Node preload.
 // Requests still traverse the real /api/contact validation/dispatch handler.
 const contact=await make();await contact.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:`window.turnstile={render:(e,o)=>{window.__challenge=o;e.textContent='QA verification';setTimeout(()=>o.callback('qa-valid-turnstile-token'),0);return 'qa-widget';},reset:()=>setTimeout(()=>window.__challenge.callback('qa-valid-turnstile-token'),0),remove:()=>{window.__removed=true;}};`}));
 let posts=0;contact.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/contact'))posts++;});
 await contact.goto(ready+'/contact',{waitUntil:'networkidle'});
 for(const width of[320,375,390,430]){await contact.setViewportSize({width,height:844});assert.ok(await contact.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 const send=contact.getByRole('button',{name:'問い合わせを送信',exact:true}),body=contact.getByLabel('問い合わせ本文（必須）',{exact:true}),email=contact.getByLabel('返信先メールアドレス（返信希望時）',{exact:true});
 await send.click();await contact.getByText('本文を1〜3000文字で入力してください。',{exact:true}).waitFor();assert.equal(posts,0);
 await body.fill('test');await email.fill('invalid');await send.click();await contact.getByText('返信先メールアドレスの形式を確認してください。',{exact:true}).waitFor();assert.equal(posts,0);await email.fill('');
 for(const[text,status]of[['[QA FAIL] 本文は残す',502],['[QA FALSE OK] 成功扱いしない',502],['[QA LIMIT] 上限',429]]){
  await body.fill(text);const response=contact.waitForResponse(r=>r.url().endsWith('/api/contact'));await send.click();assert.equal((await response).status(),status);await contact.locator('.contact-result').waitFor();assert.equal(await contact.locator('.contact-result.is-success').count(),0);assert.equal(await body.inputValue(),text);
 }
 await body.fill('正常な問い合わせ（モック送信）');const sent=contact.waitForResponse(r=>r.url().endsWith('/api/contact'));await contact.locator('form').evaluate(f=>{f.requestSubmit();f.requestSubmit();});assert.equal((await sent).status(),200);await contact.locator('.contact-result.is-success').waitFor();assert.equal(await body.inputValue(),'');assert.equal(posts,4,'double submit was not suppressed');
 assert.equal(await contact.locator('input[type=file]').count(),0);assert.ok(!await contact.evaluate(()=>Object.keys(localStorage).some(k=>/contact/.test(k))));
 await contact.locator('.site-footer a[href="/about"]').click();await contact.waitForURL('**/about');await contact.waitForFunction(()=>window.__removed===true);
 rows.push({case:'mock CAPTCHA/provider through real API; client errors, provider 500/false-ok/quota, retained text, acknowledged success, double-submit, no photo/persistence, cleanup',posts});
 assert.deepEqual(errors,[]);await writeFile(opt('--output'),JSON.stringify({kind:'local production Chrome mobile viewports + still-driven real MediaPipe; Formspree/Turnstile mocks, no delivery or phone verification',rows,errors},null,2));console.log(JSON.stringify({cases:rows.length,errors,mailDelivery:'NOT tested',phoneHardware:'NOT tested'}));
}finally{await browser.close();}
