// Local production QA, not a physical phone, real camera, or field performance study.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {importTypescript} from './lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url')??'http://127.0.0.1:4212';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true});
const after=args.includes('--assert-fixed'),rows=[],problems=[];
const prepare=async()=>{const c=await browser.newContext({viewport:{width:390,height:844}});const p=await c.newPage();await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());return p;};
try{
 const page=await prepare();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/','/try-on','/diagnosis','/favorites','/history','/guide','/about','/contact','/privacy','/terms','/editorial-policy']){
  await page.goto(base+route,{waitUntil:'networkidle'});
  for(const [width,height]of[[320,568],[390,844],[844,390],[1280,900]]){
   await page.setViewportSize({width,height});
   const info=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,h1:document.querySelectorAll('h1').length,missingLabels:[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')).map(e=>e.outerHTML.slice(0,160))}));
   assert.equal(info.overflow,false,route+width);assert.equal(info.h1,1,route);assert.equal(info.missingLabels.length,0,route);rows.push({route,width,height,...info});
  }
 }
 assert.deepEqual(errors,[]);
 await page.setViewportSize({width:1280,height:900});await page.goto(base+'/try-on',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'サンプル写真で試す',exact:true}).click();
 for(const [width,height]of[[320,568],[390,844],[844,390]]){
  await page.setViewportSize({width,height});const button=page.getByRole('button',{name:'ネイルあり / 長押しでBefore',exact:true});await button.scrollIntoViewIfNeeded();
  const hit=await button.evaluate(b=>{const r=b.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{clickable:top===b||b.contains(top),blockedBy:top?.className,previewPosition:getComputedStyle(document.querySelector('.preview-card')).position};});
  rows.push({case:'Before control hit test',width,height,...hit});if(!hit.clickable)problems.push({case:'mobile Before control covered',width,height});
  if(after)assert.ok(hit.clickable,JSON.stringify(hit));
  if(after){await button.click();assert.equal(await page.getByRole('button',{name:'Before表示中',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'Before表示中',exact:true}).click();}
 }
 // A storage denial must not be reported as a successful favorite.
 const denied=await prepare();await denied.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('QA','QuotaExceededError');};});await denied.goto(base+'/try-on',{waitUntil:'networkidle'});await denied.setViewportSize({width:1280,height:900});
 await denied.getByRole('button',{name:'サンプル写真で試す',exact:true}).click();await denied.getByText('保存・仕上げ',{exact:true}).click();
 const favorite=denied.getByRole('button',{name:'お気に入りに追加',exact:true});await favorite.evaluate(e=>window.scrollBy(0,e.getBoundingClientRect().top-650));await favorite.click();
 const message=await denied.locator('.toast').innerText();rows.push({case:'storage denied favorite',message});if(message.includes('追加しました'))problems.push({case:'false save success'});if(after)assert.match(message,/保存できません|追加できません/);
 if(after){await denied.evaluate(()=>{navigator.canShare=()=>false;});const download=denied.waitForEvent('download');await denied.getByRole('button',{name:'画像を保存',exact:true}).click();assert.equal((await download).suggestedFilename(),'nail-fit-studio.png');assert.match(await denied.locator('.toast').innerText(),/履歴は保存できませんでした/);rows.push({case:'PNG still downloadable when history storage fails, truthful notice',passed:true});}
 const corrupt=await prepare(),corruptErrors=[];corrupt.on('pageerror',e=>corruptErrors.push(e.message));await corrupt.addInitScript(()=>localStorage.setItem('nail-fit-studio-next.favorites.v1',JSON.stringify([null,{id:'bad',design:null}])));await corrupt.goto(base+'/favorites',{waitUntil:'networkidle'});await corrupt.waitForTimeout(400);
 rows.push({case:'malformed favorites',errors:corruptErrors});if(corruptErrors.length)problems.push({case:'malformed favorites crash'});if(after){assert.deepEqual(corruptErrors,[]);await corrupt.getByText('まだお気に入りはありません',{exact:true}).waitFor();}
 if(after){
  const {defaultDesign,defaultPhotoNails}=await importTypescript('src/lib/defaults.ts');
  const saved=await prepare();await saved.addInitScript(item=>{localStorage.setItem('nail-fit-studio-next.favorites.v1',JSON.stringify([item]));const set=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){if(window.__denyWrite)throw new DOMException('quota','QuotaExceededError');return set.apply(this,args);};},{id:'legacy',design:defaultDesign,nails:defaultPhotoNails,savedAt:'2026-10-31T12:00:00Z'});
  await saved.goto(base+'/favorites',{waitUntil:'networkidle'});await saved.locator('.saved-card').waitFor();await saved.evaluate(()=>window.__denyWrite=true);await saved.getByRole('button',{name:'削除',exact:true}).click();assert.equal(await saved.locator('.saved-card').count(),1);assert.match(await saved.locator('.toast').innerText(),/削除を保存できません/);
  await saved.evaluate(()=>window.__denyWrite=false);await saved.getByRole('button',{name:'削除',exact:true}).click();await saved.getByText('まだお気に入りはありません',{exact:true}).waitFor();assert.equal(await saved.locator('.toast').innerText(),'削除しました');rows.push({case:'legacy item, denied deletion retained, successful last deletion announced',passed:true});
  const diagnosis=await prepare();await diagnosis.goto(base+'/diagnosis',{waitUntil:'networkidle'});for(let i=0;i<10&&await diagnosis.locator('.option-list').count();i++)await diagnosis.locator('.option-list button').first().click();await diagnosis.getByRole('link',{name:'この条件で試着する',exact:true}).waitFor();await diagnosis.reload({waitUntil:'networkidle'});await diagnosis.getByRole('link',{name:'この条件で試着する',exact:true}).click();await diagnosis.waitForURL('**/try-on?**');rows.push({case:'diagnosis completion, persisted result, try-on navigation',passed:true});
  await page.setViewportSize({width:390,height:844});await page.getByRole('link',{name:'プレビューに戻る',exact:true}).click();await page.waitForTimeout(400);assert.ok(await page.locator('#nail-preview').evaluate(e=>e.getBoundingClientRect().top>=0));rows.push({case:'settings return to preview',passed:true});
  await page.getByRole('button',{name:'ネイルあり / 長押しでBefore',exact:true}).focus();await page.keyboard.press('Space');await page.getByRole('button',{name:'Before表示中',exact:true}).waitFor();await page.keyboard.press('Space');await page.getByRole('button',{name:'ネイルあり / 長押しでBefore',exact:true}).waitFor();rows.push({case:'native keyboard comparison toggle',passed:true});
  await page.setViewportSize({width:1280,height:900});await page.locator('#design-title').click();await page.locator('.preset-card').first().click();assert.equal(await page.locator('.preset-card').first().getAttribute('aria-pressed'),'true');assert.ok(await page.locator('.preset-card img').first().evaluate(i=>i.complete&&i.naturalWidth>0));
  await page.getByText('保存・仕上げ',{exact:true}).click();await page.getByRole('button',{name:'お気に入りに追加',exact:true}).click();assert.equal(await page.locator('.toast').innerText(),'お気に入りに追加しました');await page.goto(base+'/favorites',{waitUntil:'networkidle'});await page.locator('.saved-card').waitFor();await page.locator('.saved-card').getByRole('link',{name:'試す',exact:true}).click();await page.waitForURL('**/try-on?**');rows.push({case:'preset preview, selected state, real favorite save and retry link',passed:true});
 }
 // Invalid image decoding must remain retryable.
 await page.setViewportSize({width:1280,height:900});await page.locator('input[type=file]').setInputFiles({name:'broken.jpg',mimeType:'image/jpeg',buffer:Buffer.from('not a jpeg')});await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('画像を準備できません'));rows.push({case:'invalid image retry',passed:true});
 const report={kind:'headless Chrome, local production, ads/GA network blocked, not physical phone QA',after,rows,problems,errors};
 await writeFile(opt('--output'),JSON.stringify(report,null,2));console.log(JSON.stringify({pages:11,layouts:44,problems,errors}));
}finally{await browser.close();}
