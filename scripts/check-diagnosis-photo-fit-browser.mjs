// Local Chrome, real PHOTO MediaPipe. Responsive widths are not phone hardware.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {importTypescript} from './lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1];
const base=opt('--base-url'),out=opt('--output-dir');
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const {createDocument,WORKSHOP_LIBRARY,WORKSHOP_DRAFT}=await importTypescript('src/lib/workshopData.ts');
const {defaultDesign,defaultPhotoNails}=await importTypescript('src/lib/defaults.ts');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],external=[],posts=[],sdkMetricsBlocked=[],rows=[];
const nailsKey='nail-fit-studio-next.nails.v1',designKey='nail-fit-studio-next.design.v1',favoriteKey='nail-fit-studio-next.favorites.v1';
const file=key=>opt(key);
await mkdir(out,{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 p.setDefaultTimeout(60000);
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).hostname!=='odml.pa.googleapis.com')posts.push(new URL(r.url()).pathname);});
 await p.route('**/*',r=>{
   const url=new URL(r.request().url());
   if(url.hostname==='odml.pa.googleapis.com'&&url.pathname==='/v1/log'){sdkMetricsBlocked.push(url.pathname);return r.abort();}
   if(url.protocol.startsWith('http')&&url.origin!==new URL(base).origin){external.push(url.hostname);return r.abort();}
   return r.continue();
 });
 await p.goto(base+'/diagnosis',{waitUntil:'networkidle'});
 for(const choice of ['韓国風・ちゅるん','ピンク・ローズ','デート・お出かけ','さりげなく華やか','短め','丸みのある形','ほとんどない','分からない'])await p.getByRole('button',{name:choice,exact:true}).click();
 const cta=p.getByRole('link',{name:'この条件で試着する',exact:true});
 await cta.waitFor();assert.match(await cta.getAttribute('href'),/material=jelly/);
 await p.reload({waitUntil:'networkidle'});await cta.waitFor();
 const diagnosisKey='nail-fit-studio-next.diagnosis.v1',diagnosis=await p.evaluate(k=>localStorage.getItem(k),diagnosisKey);
 await p.locator('.diagnosis-photo-review > summary').click();
 const optional=p.locator('.diagnosis-photo-review input[type=file]');
 assert.equal(await optional.count(),0);
 await p.getByLabel('計測データの送信を了承して写真を分析する',{exact:true}).check();
 await optional.setInputFiles(file('--image'));
 await p.waitForFunction(()=>/写真で確認できた項目|手の甲が正面/.test(document.querySelector('.diagnosis-photo-review [role=status]')?.textContent??''));
 assert.equal(await p.evaluate(k=>localStorage.getItem(k),diagnosisKey),diagnosis);
 await p.screenshot({path:path.join(out,'diagnosis-390.png'),fullPage:true});
 rows.push({case:'eight answers, persist/reload, optional local photo',observations:await p.locator('.diagnosis-photo-review').innerText()});
 await cta.click();await p.waitForURL('**/try-on?**');await p.locator('.photo-fit-panel').waitFor();
 await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.material==='jelly',designKey);
 const upload=p.locator('.intro-actions input[type=file]'),fit=p.getByLabel('自爪の輪郭内に収める',{exact:true});
 await p.getByText('はみ出しが気になるとき',{exact:true}).click();
 assert.equal(await fit.isChecked(),false,'diagnosis must not auto-enable clipping');
 await fit.check();
 const canvas=p.locator('.nail-canvas');
 const geometryOnly=nail=>Object.fromEntries(Object.entries(nail).filter(([k])=>k!=='clipContour'&&k!=='clipHoles'));
 const rgb=()=>canvas.evaluate(c=>{const v=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let alpha=0;for(let i=3;i<v.length;i+=4)if(v[i]>10)alpha++;return alpha;});
 async function settled(){await fit.waitFor();await p.waitForFunction(()=>!document.querySelector('.loading-badge')&&/自動配置|認識できません|合わせ直しました/.test(document.querySelector('.preview-header')?.textContent??''));await p.waitForTimeout(550);}
 async function photo(filePath){
   const previous=await p.locator('.preview-stage img').getAttribute('src');
   await upload.setInputFiles(filePath);
   await p.waitForFunction(old=>{const image=document.querySelector('.preview-stage img');return image?.naturalWidth>0&&image.getAttribute('src')!==old;},previous);
   await settled();return p.evaluate(k=>JSON.parse(localStorage.getItem(k)),nailsKey);
 }
 for(const [key,width] of [['--image',390],['--image2',1280]]){
   await p.setViewportSize({width,height:900});
   const fitted=await photo(file(key));assert.equal(await fit.isChecked(),true);
   assert.equal(fitted.length,5);assert.ok(fitted.some(f=>f.visibility>0));
   if(width<600&&await p.getByRole('button',{name:'プレビューを広げる',exact:true}).isVisible()) await p.getByRole('button',{name:'プレビューを広げる',exact:true}).click();
   const withMask=await rgb();
   await fit.uncheck();await p.waitForFunction(()=>!document.querySelector('.loading-badge'));await p.waitForTimeout(550);
   const regular=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),nailsKey),withoutMask=await rgb();
   assert.deepEqual(fitted.map(geometryOnly),regular.map(geometryOnly));
   if(key==='--image2'){
     assert.ok(fitted.some(n=>n.visibilityState==='visible'&&n.clipContour),'provide a supported full-boundary fixture');
     assert.ok(withMask<withoutMask,'full mask should remove outside paint');
   }
   await p.screenshot({path:path.join(out,`regular-${width}.png`)});
   rows.push({case:'same PHOTO pose/visibility; optional masks',fixture:path.basename(file(key)),width,visible:fitted.filter(n=>n.visibility>0).length,
     fullMasks:fitted.flatMap((n,i)=>n.visibilityState==='visible'&&n.clipContour?[i]:[]),alphaOver10:{withoutMask,withMask}});
   await fit.check();await settled();
   await p.screenshot({path:path.join(out,`fitted-${width}.png`)});
 }
 const currentPhoto=await p.locator('.preview-stage img').getAttribute('src');
 const picker=p.locator('.photo-fit-panel');
 const doc=createDocument();doc.name='QA 保存作品';doc.fingers[0].base.color='#323456';
 const draft=createDocument();draft.name='QA 制作中';
 const library=JSON.stringify({schema:1,entries:[{folder:'created',document:doc}]}), draftRaw=JSON.stringify(draft);
 const favorite=JSON.stringify([{id:'qa-legacy',savedAt:'2026-11-19T00:00:00Z',design:{...defaultDesign,color:'#735080'},nails:defaultPhotoNails}]);
 await p.evaluate(items=>{for(const [k,v] of items)localStorage.setItem(k,v);},[[WORKSHOP_LIBRARY,library],[WORKSHOP_DRAFT,draftRaw],[favoriteKey,favorite]]);
 await picker.locator('.photo-design-picker > summary').click();
 const preset=picker.getByLabel('テンプレートから選ぶ',{exact:true});await p.waitForFunction(()=>document.querySelector('.photo-fit-panel select')?.options.length>1);
 await preset.selectOption({index:1});await picker.getByText(/を反映しました/).waitFor();
 const text=picker.getByLabel('テキストで指定',{exact:true});await text.fill('黒フレンチにシルバーラメ');
 await picker.getByRole('button',{name:'テキスト指定を反映',exact:true}).click();
 await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.tipColor==='#201c24',designKey);
 assert.equal((await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),designKey)).material,'glitter');
 const saved=picker.getByLabel('保存済み・制作中から選ぶ',{exact:true});
 for(const [name,verify] of [['制作中：QA 制作中',async()=>p.getByRole('heading',{name:'QA 制作中',exact:true}).waitFor()],
  ['作品：QA 保存作品',async()=>p.getByRole('heading',{name:'QA 保存作品',exact:true}).waitFor()]]){
   await saved.selectOption({label:name});await verify();
 }
 const legacy=await saved.locator('option').evaluateAll(es=>es.find(e=>e.textContent.includes('お気に入り：'))?.value);
 await saved.selectOption(legacy);await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.color==='#735080',designKey);
 await saved.selectOption({label:'作品：QA 保存作品'});
 assert.equal(await p.locator('.preview-stage img').getAttribute('src'),currentPhoto);
 assert.deepEqual(await p.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),[WORKSHOP_LIBRARY,WORKSHOP_DRAFT,favoriteKey]),[library,draftRaw,favorite]);
 for(const width of [320,375,390,430,1280]){
   await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.ok(await text.evaluate(e=>e.getBoundingClientRect().height>=44));
 }
 await p.setViewportSize({width:1280,height:900});
 await p.getByRole('button',{name:'ネイルあり / 長押しでBefore',exact:true}).click();
 await p.waitForFunction(()=>getComputedStyle(document.querySelector('.nail-canvas')).opacity==='0'||!document.querySelector('.nail-canvas').getContext('2d').getImageData(0,0,document.querySelector('.nail-canvas').width,document.querySelector('.nail-canvas').height).data.some(n=>n));
 await p.getByRole('button',{name:'Before表示中',exact:true}).click();await p.waitForTimeout(350);assert.ok(await rgb()>0);
 await p.getByText('保存・仕上げ',{exact:true}).click();await p.evaluate(()=>navigator.canShare=()=>false);
 const download=p.waitForEvent('download');await p.getByRole('button',{name:'画像を保存',exact:true}).click();
 const png=await readFile(await (await download).path()),size=await p.locator('.preview-stage img').evaluate(i=>[i.naturalWidth,i.naturalHeight]);
 assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],size);
 await p.getByRole('button',{name:'5本のデザインを編集',exact:true}).click();await p.locator('.workshop-editor').waitFor();
 assert.equal(await p.locator('.workshop-editor').getByLabel('ベースカラー',{exact:true}).inputValue(),'#323456');
 assert.equal(await p.locator('.preview-stage img').getAttribute('src'),currentPhoto);
 rows.push({case:'preset/text/draft/collection/legacy, retain photo and saved bytes, responsive, before/after, native PNG, re-edit',size,passed:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(posts,[]);
} finally {
 await writeFile(path.join(out,'result.json'),JSON.stringify({scope:'local Chrome responsive + real PHOTO inference; not phone or labelled fit accuracy',rows,errors,external,posts,sdkMetricsBlocked},null,2));
 await browser.close();
}
console.log(JSON.stringify({rows,errors,external,posts}));
