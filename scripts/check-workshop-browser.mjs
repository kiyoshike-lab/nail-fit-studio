// Production localhost, real MediaPipe + still-derived stream. Not phone hardware.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const args=process.argv.slice(2), opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url')??'http://127.0.0.1:4234';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local QA only');
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const rows=[],errors=[],library='nail-fit-studio-next.workshop-library.v1';
async function make(){const c=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true});const p=await c.newPage();p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());return p;}
const editor=p=>p.locator('.workshop-editor');
async function doc(p){return p.evaluate(key=>JSON.parse(localStorage.getItem(key)).entries[0].document,library);}
async function save(p){await editor(p).getByRole('button',{name:'デザインを保存',exact:true}).click();await editor(p).getByRole('status').filter({hasText:'デザインを保存しました'}).waitFor();}
async function detail(e,text){const s=e.locator('summary',{hasText:text});if(!await s.evaluate(n=>n.parentElement.open))await s.click();}
try{
 const p=await make();await p.goto(base+'/create',{waitUntil:'networkidle'});const e=editor(p);await e.waitFor();await e.getByLabel('デザイン名',{exact:true}).fill('QA 指別ホログラム');
 const names=['親指','人差し指','中指','薬指','小指'],colors=['#b84664','#4074ce','#53a174','#b566c9','#b9873b'];
 const kinds=['silver-holo','crystal','pearl','heart','flower'];
 for(let i=0;i<5;i++){
  await e.getByRole('button',{name:names[i],exact:true}).click();await e.getByLabel('ベースカラー',{exact:true}).fill(colors[i]);
  await detail(e,'パーツを追加・編集');await e.getByRole('combobox',{name:'パーツの種類',exact:true}).selectOption(kinds[i]);await e.getByRole('button',{name:'パーツを追加',exact:true}).click();
 }
 // Drag is a single undo step; redo restores position, not an empty diagram.
 await e.getByRole('button',{name:'親指',exact:true}).click();await e.locator('.workshop-parts button').first().click();
 await e.locator('.workshop-drawing canvas').scrollIntoViewIfNeeded();
 const box=await e.locator('.workshop-drawing canvas').boundingBox();const x=box.x+box.width*.5,y=box.y+box.height*.68;
 await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+box.width*.07,y,{steps:5});await p.mouse.up();
 const moved=Number(await e.getByLabel('パーツ横位置',{exact:true}).inputValue());assert.ok(moved>.1&&moved<.25,`normalized drag ${moved}`);
 await e.getByRole('button',{name:'元に戻す',exact:true}).click();assert.equal(Number(await e.getByLabel('パーツ横位置',{exact:true}).inputValue()),0);
 await e.getByRole('button',{name:'やり直す',exact:true}).click();assert.equal(Number(await e.getByLabel('パーツ横位置',{exact:true}).inputValue()),moved);
 await e.getByRole('button',{name:'複製',exact:true}).click();assert.equal(await e.locator('.workshop-parts button').count(),2);
 await e.getByRole('button',{name:'奥へ',exact:true}).click();await e.getByRole('button',{name:'選択パーツを削除',exact:true}).click();assert.equal(await e.locator('.workshop-parts button').count(),1);
 await detail(e,'ほかの指へコピー・保存');await e.getByRole('combobox',{name:'保存先',exact:true}).selectOption('salon');await save(p);
 const original=await doc(p);assert.deepEqual(original.fingers.map(f=>f.base.color),colors);assert.deepEqual(original.fingers.map(f=>f.parts[0].kind),kinds);assert.ok(Math.abs(original.fingers[0].parts[0].x-moved)<.006,'range input rounds drag position to its .01 step');
 rows.push({case:'five independent bases/parts, drag, duplicate/order/delete, one-step undo/redo, local save',passed:true});
 await p.goto(base+'/collections',{waitUntil:'networkidle'});await p.getByRole('heading',{name:original.name,exact:true}).waitFor();await p.reload({waitUntil:'networkidle'});await p.getByRole('link',{name:'再編集',exact:true}).click();await e.waitFor();assert.equal(await e.getByLabel('ベースカラー',{exact:true}).inputValue(),colors[0]);
 // Copy-all round trip and cancellation/reset are reversible.
 await detail(e,'ほかの指へコピー・保存');assert.equal(await e.getByRole('combobox',{name:'保存先',exact:true}).inputValue(),'salon');await e.getByRole('button',{name:'選択中の指を5本すべてにコピー',exact:true}).click();await save(p);const copied=await doc(p);assert.ok(copied.fingers.every(f=>f.base.color===colors[0]));assert.equal(new Set(copied.fingers.map(f=>f.parts[0].id)).size,5);assert.equal(await p.evaluate(key=>JSON.parse(localStorage.getItem(key)).entries[0].folder,library),'salon','re-save unexpectedly moved collection');
 await e.getByRole('button',{name:'元に戻す',exact:true}).click();await save(p);assert.deepEqual((await doc(p)).fingers,original.fingers);
 await e.getByRole('button',{name:'初期化（取り消せます）',exact:true}).click();await e.getByRole('button',{name:'元に戻す',exact:true}).click();await save(p);assert.deepEqual((await doc(p)).fingers,original.fingers);
 rows.push({case:'reload/re-edit, copy-all independent IDs, undo reset/copy, exact data restored',passed:true});
 for(const width of [320,375,390,430]){
  await p.setViewportSize({width,height:844});await e.getByRole('button',{name:'親指',exact:true}).click();await detail(e,'パーツを追加・編集');await e.locator('.workshop-parts button').first().click();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`editor overflow ${width}`);
  for(const name of ['パーツを追加','デザインを保存','このデザインで試着'])assert.ok(await e.getByRole('button',{name,exact:true}).evaluate(b=>b.getBoundingClientRect().height>=44));
  await e.getByLabel('パーツ横位置',{exact:true}).focus();const before=Number(await e.getByLabel('パーツ横位置',{exact:true}).inputValue());await p.keyboard.press('ArrowRight');assert.ok(Number(await e.getByLabel('パーツ横位置',{exact:true}).inputValue())>before);await e.getByRole('button',{name:'元に戻す',exact:true}).click();
  if(width===320){
   const canvas=e.locator('.workshop-drawing canvas');await canvas.scrollIntoViewIfNeeded();const r=await canvas.boundingBox(),cdp=await p.context().newCDPSession(p);
   const x=r.x+r.width*.5,y=r.y+r.height*.68;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+r.width*.1,y}]});await p.waitForTimeout(100);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.ok(Number(await e.getByLabel('パーツ横位置',{exact:true}).inputValue())>before,'touch drag did not move selected part');await e.getByRole('button',{name:'元に戻す',exact:true}).click();
   await canvas.scrollIntoViewIfNeeded();const r2=await canvas.boundingBox(),x2=r2.x+r2.width*.5,y2=r2.y+r2.height*.68;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x2,y:y2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x2+r2.width*.1,y:y2}]});await p.waitForTimeout(100);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   assert.equal(Number(await e.getByLabel('パーツ横位置',{exact:true}).inputValue()),before,'touch cancellation lost starting pose');assert.ok(await e.getByRole('button',{name:'やり直す',exact:true}).isEnabled(),'cancel lost redo history');await cdp.detach();
   rows.push({case:'Chrome emulated touch drag + touch cancellation preserves redo',passed:true});
  }
  rows.push({case:'editor width, keyboard range, 44px primary taps',width,passed:true});
 }
 if(opt('--screenshot'))await p.screenshot({path:opt('--screenshot'),fullPage:true});
 await p.setViewportSize({width:1280,height:900});await e.getByRole('button',{name:'このデザインで試着',exact:true}).click();await p.waitForURL('**/try-on?draft=1');await p.getByText('保存した5本のデザインを読み込みました。写真かカメラを入れて試せます。',{exact:true}).waitFor();
 await p.locator('input[type=file]').first().setInputFiles(opt('--image'));await p.waitForFunction(()=>document.querySelector('.preview-stage img')?.naturalWidth>0);await p.waitForTimeout(3500);
 const pixels=()=>p.locator('.nail-canvas').evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<a.length;i+=4)if(a[i]>10)n++;return n;});
 assert.ok(await pixels()>100,'custom photo no painting');await p.getByRole('button',{name:'ネイルあり / 長押しでBefore',exact:true}).click();await p.waitForTimeout(350);assert.equal(await pixels(),0);await p.getByRole('button',{name:'Before表示中',exact:true}).click();await p.waitForTimeout(350);assert.ok(await pixels()>100);
 await detail(p,'保存・仕上げ');await p.getByRole('button',{name:'お気に入りに追加',exact:true}).click();const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.favorites.v1'))[0]);assert.deepEqual(saved.artwork.fingers,original.fingers);
 await p.evaluate(()=>navigator.canShare=()=>false);const download=p.waitForEvent('download');await p.getByRole('button',{name:'画像を保存',exact:true}).click();assert.equal((await download).suggestedFilename(),'nail-fit-studio.png');
 assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.history.v1'))[0].artwork.fingers.every(f=>f.parts.length)));
 await p.goto(base+'/favorites',{waitUntil:'networkidle'});await p.locator('.saved-card').getByRole('link',{name:'試す',exact:true}).click();await p.waitForURL('**/try-on?look=**');await p.getByText('保存した5本のデザインを読み込みました。写真かカメラを入れて試せます。',{exact:true}).waitFor();await p.getByRole('button',{name:'5本のデザインを編集',exact:true}).click();await editor(p).waitFor();assert.equal(await editor(p).getByLabel('ベースカラー',{exact:true}).inputValue(),colors[0]);await editor(p).getByRole('button',{name:'開いた時の状態に戻す',exact:true}).click();
 rows.push({case:'real MediaPipe photo + custom layers, Before/After, PNG download, full artwork favorite/history/retry',passed:true});
 // Keep the very same MediaStream across editor opening / painting / save / cancel.
 await p.goto(base+'/try-on?draft=1&diagnostics=1',{waitUntil:'networkidle'});const source='data:image/jpeg;base64,'+(await readFile(opt('--image'))).toString('base64');
 await p.evaluate(async src=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');window.__timer=setInterval(()=>{x.fillStyle='#777';x.fillRect(0,0,640,480);const h=430,w=h*i.width/i.height;x.drawImage(i,320-w/2,240-h/2,w,h);},33);window.__gumCalls=0;navigator.mediaDevices.getUserMedia=async()=>{window.__gumCalls++;window.__stream=c.captureStream(30);return window.__stream;};navigator.mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'qa',label:'QA camera'}];},source);
 await p.getByRole('button',{name:'カメラで試す',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.tracking-diagnostics')?.textContent.includes('描画呼出 5本'));
 await p.getByRole('button',{name:'5本のデザインを編集',exact:true}).click();await editor(p).waitFor();await detail(editor(p),'パーツを追加・編集');await editor(p).getByRole('button',{name:'パーツを追加',exact:true}).click();await editor(p).getByRole('button',{name:'このデザインで試着',exact:true}).click();
 assert.ok(await p.evaluate(()=>window.__gumCalls===1&&document.querySelector('video').srcObject===window.__stream&&window.__stream.active));
 await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'収納する',exact:true}).click();await p.waitForTimeout(200);assert.ok(await p.evaluate(()=>window.__stream.active&&document.querySelector('video').srcObject===window.__stream));
 await p.getByRole('button',{name:'プレビューを広げる',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.tracking-diagnostics')?.textContent.includes('描画呼出 5本'));
 await p.locator('.bottom-nav').getByRole('button',{name:'止める',exact:true}).click();assert.equal(await p.evaluate(()=>window.__stream.active),false);await p.evaluate(()=>clearInterval(window.__timer));
 rows.push({case:'real MediaPipe VIDEO, custom parts, same stream during edit and compact/expand, proper stop',passed:true});
 const denied=await make();await denied.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('quota','QuotaExceededError');};});await denied.goto(base+'/create',{waitUntil:'networkidle'});await editor(denied).waitFor();await editor(denied).getByRole('button',{name:'デザインを保存',exact:true}).click();assert.match(await editor(denied).getByRole('status').innerText(),/保存できません/);await editor(denied).getByRole('button',{name:'このデザインで試着',exact:true}).click();assert.ok(denied.url().endsWith('/create'));assert.match(await editor(denied).getByRole('status').innerText(),/保存できません/);
 await denied.goto(base+'/try-on',{waitUntil:'networkidle'});await denied.getByRole('button',{name:'デザインエディターを開く',exact:true}).click();await editor(denied).waitFor();await detail(editor(denied),'パーツを追加・編集');await editor(denied).getByRole('button',{name:'パーツを追加',exact:true}).click();await editor(denied).getByRole('button',{name:'このデザインで試着',exact:true}).click();assert.equal(await editor(denied).count(),0);assert.match(await denied.locator('.toast').innerText(),/下書きは保存できませんでした/);await denied.getByRole('button',{name:'5本のデザインを編集',exact:true}).click();await editor(denied).waitFor();await detail(editor(denied),'パーツを追加・編集');assert.equal(await editor(denied).locator('.workshop-parts button').count(),1);
 const corrupt=await make();await corrupt.addInitScript(key=>localStorage.setItem(key,'{"schema":99}'),library);await corrupt.goto(base+'/create',{waitUntil:'networkidle'});await editor(corrupt).waitFor();await editor(corrupt).getByRole('button',{name:'デザインを保存',exact:true}).click();assert.match(await editor(corrupt).getByRole('status').innerText(),/保存できません/);assert.equal(await corrupt.evaluate(key=>localStorage.getItem(key),library),'{"schema":99}');
 rows.push({case:'denied/future storage fail-closed, no false save/try-on navigation',passed:true});
 const noCanvas=await make();await noCanvas.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;window.__noCanvas=true;HTMLCanvasElement.prototype.getContext=function(...args){if(window.__noCanvas&&this.classList.contains('artwork-canvas'))return null;return get.apply(this,args);};});await noCanvas.goto(base+'/create',{waitUntil:'networkidle'});await editor(noCanvas).getByRole('alert').first().waitFor();await editor(noCanvas).getByLabel('デザイン名',{exact:true}).fill('Canvas復帰テスト');await noCanvas.evaluate(()=>window.__noCanvas=false);for(let retry=0;retry<3&&await editor(noCanvas).getByRole('button',{name:'図の表示を再試行',exact:true}).count();retry++){await editor(noCanvas).getByRole('button',{name:'図の表示を再試行',exact:true}).first().click();await noCanvas.waitForTimeout(100);}await noCanvas.waitForFunction(()=>!document.querySelector('.workshop-editor [role=alert]'));assert.equal(await editor(noCanvas).getByLabel('デザイン名',{exact:true}).inputValue(),'Canvas復帰テスト');
 rows.push({case:'Canvas unavailable: truthful error, retry succeeds, editor data retained',passed:true});assert.deepEqual(errors,[]);
 await writeFile(opt('--output'),JSON.stringify({scope:'desktop Chrome, responsive widths, keyboard, real model with still-derived stream; NOT iPhone/Android hardware or real moving fingers',rows,errors},null,2));console.log(JSON.stringify(rows,null,2));
}finally{await browser.close();}
