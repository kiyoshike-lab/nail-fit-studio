// LOCAL UX regression. Desktop responsive/touch emulation is not phone hardware.
import assert from'node:assert/strict';import{writeFile,mkdir}from'node:fs/promises';import{pathToFileURL}from'node:url';import path from'node:path';import{importTypescript}from'./lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined,base=opt('--base-url'),phase=Number(opt('--phase')??2),rows=[],errors=[];
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
const{defaultDesign,defaultPhotoNails}=await importTypescript('src/lib/defaults.ts');
const geometry=await importTypescript('src/lib/paintGeometry.ts');
if(opt('--screenshot-dir'))await mkdir(opt('--screenshot-dir'),{recursive:true});
try{
for(const width of [320,375,390,430,1280]){
 const ctx=await browser.newContext({viewport:{width,height:900},hasTouch:width<600}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 await p.goto(base+'/',{waitUntil:'networkidle'});assert.equal(await p.getByRole('link',{name:'ネイルを作る',exact:true}).getAttribute('href'),'/create');
 const faq=await p.locator('.faq-section summary').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert.ok(faq.every(h=>h>=44));
 for(const route of ['/favorites','/history','/collections']){await p.goto(base+route,{waitUntil:'networkidle'});assert.equal(await p.locator('.saved-navigation a[aria-current=page]').getAttribute('href'),route);const nav=p.locator(width<600?'.mobile-site-nav':'.desktop-nav');assert.equal(await nav.getByRole('link',{name:'保存',exact:true}).getAttribute('aria-current'),'page');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await p.goto(base+'/guide',{waitUntil:'networkidle'});const filters=await p.locator('.filter-chip').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));assert.ok(filters.every(r=>r.w>=44&&r.h>=44),JSON.stringify({width,filters}));await p.getByRole('button',{name:'形',exact:true}).click();assert.equal(await p.getByRole('button',{name:'形',exact:true}).getAttribute('aria-pressed'),'true');
 await p.evaluate(item=>localStorage.setItem('nail-fit-studio-next.favorites.v1',JSON.stringify([item])),{id:'ux-delete',design:defaultDesign,nails:defaultPhotoNails,savedAt:'2026-11-18T00:00:00Z'});await p.goto(base+'/favorites',{waitUntil:'networkidle'});await p.locator('.saved-card').waitFor();const remove=p.getByRole('button',{name:'削除',exact:true});await remove.click();await p.getByRole('group',{name:'試着設定の削除確認'}).waitFor();assert.equal(await p.locator('.saved-card').count(),1);await p.getByRole('button',{name:'削除をやめる',exact:true}).click();assert.equal(await remove.evaluate(e=>e===document.activeElement),true);assert.equal(await p.locator('.saved-card').count(),1);await remove.click();await p.getByRole('button',{name:'削除を確定',exact:true}).click();await p.getByText('まだお気に入りはありません',{exact:true}).waitFor();
 rows.push({width,phase,case:'saved navigation, FAQ/chip targets, selected category, delete cancel/focus/confirm',passed:true});
 if(phase>=3){
  await p.goto(base+'/create',{waitUntil:'networkidle'});await p.getByRole('button',{name:'拡大して絵を描く',exact:true}).click();await p.locator('.paint-canvas').waitFor();
  const quick=p.getByLabel(/^すぐ使うツール/),modes=p.locator('.paint-mode-controls');
  await quick.selectOption('brush');await modes.getByRole('button',{name:'移動',exact:true}).click();await modes.getByRole('button',{name:'描く',exact:true}).click();assert.equal(await quick.inputValue(),'brush');
  await quick.selectOption('square');await modes.getByRole('button',{name:'移動',exact:true}).click();await modes.getByRole('button',{name:'図形',exact:true}).click();assert.equal(await quick.inputValue(),'square');
  const layout=await p.locator('.paint-workspace').evaluate(e=>{const a=e.querySelector('.paint-canvas-column').getBoundingClientRect(),b=e.querySelector('.paint-options').getBoundingClientRect(),s=e.querySelector('.paint-options-scroll');return{canvas:a.toJSON(),panel:b.toJSON(),scrollHeight:s.clientHeight,viewport:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1};});
  assert.equal(layout.overflow,false);if(width>=1000)assert.ok(layout.panel.x>=layout.canvas.right-1);else assert.ok(layout.scrollHeight<=layout.viewport*.4+1);
  await quick.selectOption('pen');await p.locator('.paint-viewport').scrollIntoViewIfNeeded();await p.waitForTimeout(180);
  if(opt('--screenshot-dir')&&[390,1280].includes(width))await p.screenshot({path:path.join(opt('--screenshot-dir'),`paint-after-${width}.png`)});
  await quick.selectOption('square');await p.getByRole('button',{name:'全体表示',exact:true}).click();await p.locator('.paint-viewport').scrollIntoViewIfNeeded();await p.waitForTimeout(150);
  const info=await p.locator('.paint-canvas').evaluate(c=>({r:c.getBoundingClientRect().toJSON(),size:{width:c.width,height:c.height}}));const a=geometry.paintToClient({x:-.08,y:-.08},info.r,info.size,defaultDesign),b=geometry.paintToClient({x:.08,y:.08},info.r,info.size,defaultDesign);
  await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:8});await p.mouse.up();await p.locator('.paint-layer-list button').first().click();
  const horizontal=p.getByLabel('レイヤーの横位置',{exact:true}),initial=Number(await horizontal.inputValue());await p.locator('.paint-number-options>summary').click();const number=p.getByLabel(/^横位置を数値入力/);await number.fill('0.12');await number.press('Enter');assert.equal(Number(await horizontal.inputValue()),.12);
  await number.fill('9');await number.press('Enter');await p.locator('.editor-number-field .field-error').waitFor();assert.equal(Number(await horizontal.inputValue()),.12);
  await number.fill('0.2');await number.press('Control+z');assert.equal(Number(await horizontal.inputValue()),.12);await number.press('Escape');
  const undo=p.getByRole('button',{name:'描画を元に戻す',exact:true});await undo.focus();await undo.press('Control+z');assert.ok(Math.abs(Number(await horizontal.inputValue())-initial)<1e-7,'editor shortcut ran twice or number history split');await undo.press('Control+Shift+z');assert.equal(Number(await horizontal.inputValue()),.12);
  await p.getByRole('button',{name:'制作データを保存',exact:true}).click();rows.push({width,case:'responsive workspace, remembered tools, numeric validation, single undo/redo and text-input shortcut isolation',layout,passed:true});
 }
 await ctx.close();
}
assert.deepEqual(errors,[]);await writeFile(opt('--output'),JSON.stringify({phase,kind:'local production Chrome; not physical phone tests',rows,errors},null,2));console.log(`${rows.length} UX viewport groups passed (phase ${phase})`);
}finally{await browser.close();}
