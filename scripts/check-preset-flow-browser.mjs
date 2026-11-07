// Responsive desktop Chrome, actual photo recognition and still-driven VIDEO.
// No physical phone/camera, no real motion/accuracy/advertising delivery claims.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';import path from 'node:path';
import {importTypescript} from './lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url'),out=path.resolve(opt('--output-dir')),image=path.resolve(opt('--image'));
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');await mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const rows=[],errors=[],w=await importTypescript('src/lib/workshopData.ts');
const canvasPainted=p=>p.waitForFunction(()=>{const c=document.querySelector('.nail-canvas');return c?.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);});
async function setup(width){const context=await browser.newContext({viewport:{width,height:900},hasTouch:true}),p=await context.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());return p;}
try{
 const p=await setup(390);await p.goto(base+'/try-on',{waitUntil:'networkidle'});
 await p.locator('input[type=file]').first().setInputFiles(image);
 await p.waitForFunction(()=>!document.querySelector('.loading-badge')&&document.querySelector('.preview-header')?.textContent.includes('自動配置'));
 await canvasPainted(p);
 // Settings persistence is intentionally debounced 400ms. Wait for the detected
 // snapshot rather than reading the initial hidden placeholders from storage.
 await p.waitForFunction(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.nails.v1'))?.filter(n=>(n.visibility??1)>.05).length===5);
 const nails=await p.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.nails.v1')));assert.equal(nails.length,5);assert.equal(nails.filter(n=>(n.visibility??1)>.05).length,5);
 await p.locator('#design-title').click();await p.locator('.preset-card').nth(2).click();await canvasPainted(p);
 for(const width of [320,375,390,430,1280]){
  await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+width);
  const card=p.locator('.preset-card').nth(width%15);await card.scrollIntoViewIfNeeded();await card.click();
  assert.ok(await card.locator('img').evaluate(i=>i.complete&&i.naturalWidth===180));
  assert.equal(await card.getAttribute('aria-pressed'),'true');await canvasPainted(p);
  await p.screenshot({path:path.join(out,`preset-${width}.png`)});rows.push({case:'responsive preset selection',width,passed:true});
 }
 await p.setViewportSize({width:390,height:900});
 const stored=await p.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.design.v1')));assert.match(stored.textureUrl,/nail_texture_\d{3}_v2_[a-f0-9]{12}.png$/);
 await p.getByRole('button',{name:'ネイルあり / 長押しでBefore',exact:true}).click();
 await p.waitForFunction(()=>{const c=document.querySelector('.nail-canvas');return !c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v);});
 await p.getByRole('button',{name:'Before表示中',exact:true}).click();await canvasPainted(p);
 await p.evaluate(()=>navigator.canShare=()=>false);const download=p.waitForEvent('download');await p.locator('.bottom-nav').getByRole('button',{name:'保存',exact:true}).click();const dl=await download;
 await dl.saveAs(path.join(out,'photo-preset-export.png'));const png=await readFile(path.join(out,'photo-preset-export.png'));
 assert.ok(png.toString('utf8').includes('NailMaterialCredits'));assert.equal(dl.suggestedFilename(),'nail-fit-studio.png');
 await p.locator('#save-title').click();await p.getByRole('button',{name:'お気に入りに追加',exact:true}).click();
 const favorite=await p.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.favorites.v1')));assert.ok(favorite?.length);assert.equal(favorite[0].design.textureUrl,stored.textureUrl);
 await p.reload({waitUntil:'networkidle'});assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.design.v1')).textureUrl),stored.textureUrl);
 rows.push({case:'real photo five nails, before/after, original-prepared-resolution PNG with credits, favorite and reload',passed:true});
 // Separate fresh page: live recognition with a photo-backed stream. Preset
 // changes do not stop/restart the stream or lose the five visible nails.
 const camera=await setup(390);await camera.route('**/__preset_qa.jpg',r=>r.fulfill({path:image,contentType:'image/jpeg'}));
 await camera.goto(base+'/try-on',{waitUntil:'networkidle'});
 await camera.addScriptTag({content:`window.__photoPaints=0;const old=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...a){if(this.canvas.classList.contains('nail-canvas')&&im instanceof HTMLImageElement&&im.src.includes('nail_texture_'))window.__photoPaints++;return old.call(this,im,...a);};`});
 await camera.evaluate(async()=>{const im=new Image();im.src='/__preset_qa.jpg';await im.decode();const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');const s=Math.min(600/im.width,440/im.height);window.__timer=setInterval(()=>{x.fillStyle='#888';x.fillRect(0,0,640,480);x.drawImage(im,320-im.width*s/2,240-im.height*s/2,im.width*s,im.height*s);},33);navigator.mediaDevices.getUserMedia=async()=>{window.__stream=c.captureStream(30);return window.__stream;};navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'local-qa',label:'Still-backed QA'}];});
 await camera.locator('.bottom-nav').getByRole('button',{name:'カメラ',exact:true}).click();
 await camera.waitForFunction(()=>document.querySelector('.detection-status')?.textContent==='手を検出しました');
 await camera.locator('#design-title').click();await camera.locator('.preset-card').nth(2).click();await camera.waitForFunction(()=>window.__photoPaints>=5);
 assert.equal(await camera.evaluate(()=>window.__stream.active),true);await camera.screenshot({path:path.join(out,'still-driven-camera.png')});
 await camera.locator('#save-title').click();await camera.getByRole('button',{name:'写真として固定',exact:true}).click();assert.equal(await camera.evaluate(()=>window.__stream.active),false);await camera.evaluate(()=>clearInterval(window.__timer));await canvasPainted(camera);
 rows.push({case:'actual MediaPipe still-derived VIDEO, photo texture drawn, stream preserved, capture to photo',passed:true});
 for(const schema of [1,2,3,4]){
  const doc=w.createDocument({...stored,textureUrl:'/assets/preset-textures/texture_001.png'});doc.schema=schema;
  doc.fingers=doc.fingers.map(f=>({...f,...(schema>1?{layers:[],order:[]}:{}),...(schema>=3?{layerMeta:{}}:{})}));assert.ok(w.parseDocument(doc));
  const editor=await setup(schema===1?320:1280);await editor.addInitScript(({key,doc})=>{if(!sessionStorage.getItem('qa-seeded')){localStorage.setItem(key,JSON.stringify({schema:1,entries:[{folder:'created',document:doc}]}));sessionStorage.setItem('qa-seeded','1');}},{key:w.WORKSHOP_LIBRARY,doc});
  await editor.goto(base+'/create?id='+doc.id,{waitUntil:'networkidle'});const panel=editor.locator('.workshop-editor');await panel.waitFor();
  await panel.getByLabel('デザイン名',{exact:true}).fill('旧実写の再編集 '+schema);await panel.getByRole('button',{name:'デザインを保存',exact:true}).click();await panel.getByRole('status').filter({hasText:'デザインを保存しました'}).waitFor();
  const saved=await editor.evaluate(k=>JSON.parse(localStorage.getItem(k)).entries[0].document,w.WORKSHOP_LIBRARY);assert.ok(w.parseDocument(saved));assert.equal(saved.fingers[0].base.textureUrl,doc.fingers[0].base.textureUrl);
  await editor.reload({waitUntil:'networkidle'});assert.equal(await editor.locator('.workshop-editor').getByLabel('デザイン名',{exact:true}).inputValue(),'旧実写の再編集 '+schema);
  rows.push({case:'legacy library actual UI save/reedit/reload',schema,passed:true});await editor.context().close();
 }
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'result.json'),JSON.stringify({created:new Date().toISOString(),rows,errors,physicalPhonesTested:false,physicalCameraTested:false},null,2)+'\n');console.log(JSON.stringify({cases:rows.length,errors}));
}finally{await browser.close();}
