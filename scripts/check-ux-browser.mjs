// LOCAL UX regression. Desktop responsive/touch emulation is not phone hardware.
import assert from'node:assert/strict';import{writeFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import path from'node:path';import{importTypescript}from'./lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined,base=opt('--base-url'),phase=Number(opt('--phase')??2),rows=[],errors=[];
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
const{defaultDesign,defaultPhotoNails}=await importTypescript('src/lib/defaults.ts');
try{
for(const width of [320,375,390,430,1280]){
 const ctx=await browser.newContext({viewport:{width,height:900},hasTouch:width<600}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 await p.goto(base+'/',{waitUntil:'networkidle'});assert.equal(await p.getByRole('link',{name:'ネイルを作る',exact:true}).getAttribute('href'),'/create');
 const faq=await p.locator('.faq-section summary').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert.ok(faq.every(h=>h>=44));
 for(const route of ['/favorites','/history','/collections']){await p.goto(base+route,{waitUntil:'networkidle'});assert.equal(await p.locator('.saved-navigation a[aria-current=page]').getAttribute('href'),route);const nav=p.locator(width<600?'.mobile-site-nav':'.desktop-nav');assert.equal(await nav.getByRole('link',{name:'保存',exact:true}).getAttribute('aria-current'),'page');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await p.goto(base+'/guide',{waitUntil:'networkidle'});const filters=await p.locator('.filter-chip').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));assert.ok(filters.every(r=>r.w>=44&&r.h>=44),JSON.stringify({width,filters}));await p.getByRole('button',{name:'形',exact:true}).click();assert.equal(await p.getByRole('button',{name:'形',exact:true}).getAttribute('aria-pressed'),'true');
 await p.evaluate(item=>localStorage.setItem('nail-fit-studio-next.favorites.v1',JSON.stringify([item])),{id:'ux-delete',design:defaultDesign,nails:defaultPhotoNails,savedAt:'2026-11-18T00:00:00Z'});await p.goto(base+'/favorites',{waitUntil:'networkidle'});await p.locator('.saved-card').waitFor();const remove=p.getByRole('button',{name:'削除',exact:true});await remove.click();await p.getByRole('group',{name:'試着設定の削除確認'}).waitFor();assert.equal(await p.locator('.saved-card').count(),1);await p.getByRole('button',{name:'削除をやめる',exact:true}).click();assert.equal(await remove.evaluate(e=>e===document.activeElement),true);assert.equal(await p.locator('.saved-card').count(),1);await remove.click();await p.getByRole('button',{name:'削除を確定',exact:true}).click();await p.getByText('まだお気に入りはありません',{exact:true}).waitFor();
 rows.push({width,phase,case:'saved navigation, FAQ/chip targets, selected category, delete cancel/focus/confirm',passed:true});await ctx.close();
}
assert.deepEqual(errors,[]);await writeFile(opt('--output'),JSON.stringify({phase,kind:'local production Chrome; not physical phone tests',rows,errors},null,2));console.log(`${rows.length} UX viewport groups passed (phase ${phase})`);
}finally{await browser.close();}
