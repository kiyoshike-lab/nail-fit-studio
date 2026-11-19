// Local production-mode Chrome. No physical phones, camera or publication.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {importTypescript} from './lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1];
const base=opt('--base-url'),out=opt('--output-dir');
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const {showcaseExamples,showcaseImage,showcaseUrl,findShowcase}=await importTypescript('src/lib/showcaseCatalog.ts');
const {createShowcaseDesign}=await importTypescript('src/lib/showcaseDesigns.ts');
const {showcaseHand,withShowcaseMasks}=await importTypescript('src/lib/showcaseHands.ts');
const {parseDocument,WORKSHOP_LIBRARY}=await importTypescript('src/lib/workshopData.ts');
const rows=[],layouts=[],errors=[],modelLoads=[];
assert.equal(showcaseExamples.length,12);
assert.equal(new Set(showcaseExamples.map(v=>v.id)).size,12);
assert.equal(findShowcase('https://example.test/'),undefined);
const b=await chromium.launch({channel:'chrome',headless:true});
await mkdir(out,{recursive:true});
try{
 const p=await b.newPage({viewport:{width:1280,height:900}});
 p.setDefaultTimeout(40000);
 p.on('pageerror',error=>errors.push(error.message));
 p.on('request',r=>{if(/\/mediapipe\/|\/model-assets\//.test(r.url()))modelLoads.push(r.url());});
 await p.route('**/*',r=>['http:','https:'].includes(new URL(r.request().url()).protocol)&&new URL(r.request().url()).origin!==new URL(base).origin?r.abort():r.continue());
 await p.goto(base+'/',{waitUntil:'networkidle'});
 assert.equal(await p.locator('.example-hero img').getAttribute('width'),'1122');
 assert.equal(await p.locator('.popular-section .design-tile:visible').count(),4);
 await p.locator('.example-more summary').click();
 const cards=p.locator('.popular-section .design-tile');
 assert.equal(await cards.count(),12);
 for(const width of [320,375,390,430,1280]){
  await p.setViewportSize({width,height:900});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const card of await cards.all()){
   await card.scrollIntoViewIfNeeded();
   const img=card.locator('img');await img.evaluate(i=>i.decode());
   assert.equal(await img.evaluate(i=>getComputedStyle(i).objectFit),'contain');
  }
  layouts.push(width);
  if([390,1280].includes(width))await p.locator('.popular-section').screenshot({path:path.join(out,`all-${width}.png`)});
 }
 await cards.first().click();
 await p.waitForURL('**/try-on?example=office');
 for(const example of showcaseExamples){
  const expected=createShowcaseDesign(example);assert.ok(parseDocument(expected));
  const hand=showcaseHand(example.hand);
  const calibrated=withShowcaseMasks(hand.src,hand.nails,[1,1,1,1,1]);
  const extended=withShowcaseMasks(hand.src,hand.nails,[1.55,1,1,1,1]);
  assert.ok(calibrated.every(n=>n.clipContour?.length>=3));assert.equal(extended[0].clipContour,undefined);
  assert.strictEqual(withShowcaseMasks('blob:own-photo',hand.nails,[1,1,1,1,1]),hand.nails);
  if(example.id!=='office')await p.goto(base+showcaseUrl(example),{waitUntil:'networkidle'});
  await p.getByRole('heading',{name:example.name,exact:true}).waitFor();
  const context=p.locator('.preview-stage img');
  await context.evaluate(i=>i.decode());
  assert.equal(await context.getAttribute('src'),hand.src);
  await p.getByText(/表示中：生成した手写真/).waitFor();
  await p.getByText('保存・仕上げ',{exact:true}).click();
  await p.evaluate(()=>navigator.canShare=()=>false);
  const ready=p.waitForEvent('download');await p.getByRole('button',{name:'画像を保存',exact:true}).click();
  const dl=await ready, png=await readFile(await dl.path());
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1122,1402]);
  const history=await p.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.history.v1'))[0]);
  assert.deepEqual(history.artwork.fingers,expected.fingers);assert.ok(parseDocument(history.artwork));
  assert.equal(history.nails.length,hand.nails.length);
  history.nails.forEach((nail,index)=>{
   const {rotation,...rest}=nail,{rotation:expectedRotation,...expectedRest}=hand.nails[index];
   assert.deepEqual(rest,expectedRest);
   assert.ok(Math.abs(rotation-expectedRotation)<1e-10,'rotation rounding must be subpixel');
  });
  const comparison=await p.evaluate(async({gallery,data})=>{
   const image=new Image();image.src=data;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   const encoded=canvas.toDataURL('image/webp',.85);
   const presented=new Image();presented.src=gallery;await presented.decode();
   const actual=new Image();actual.src=encoded;await actual.decode();
   ctx.drawImage(presented,0,0);const a=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   ctx.drawImage(actual,0,0);const b=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let count=0,sum=0,max=0;
   for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d)count++;sum+=d;max=Math.max(max,d);}
   return {changedChannels:count,meanAbsoluteChannelDiff:sum/a.length,max};
  },{gallery:showcaseImage(example),data:'data:image/png;base64,'+png.toString('base64')});
  assert.ok(comparison.meanAbsoluteChannelDiff<.15,JSON.stringify({example,comparison}));
  rows.push({id:example.id,partCount:expected.fingers.flatMap(f=>f.parts).length,comparison});
  if(example.id==='wonhong'){
   await p.getByRole('button',{name:'5本のデザインを編集',exact:true}).click();
   const editor=p.locator('.workshop-editor');await editor.waitFor();
   await editor.getByRole('button',{name:'デザインを保存',exact:true}).click();
   const actual=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)).entries[0].document,WORKSHOP_LIBRARY);
   assert.deepEqual(actual.fingers,expected.fingers);
   await p.goto(base+'/create?id='+encodeURIComponent(actual.id),{waitUntil:'networkidle'});
   const reopened=p.locator('.workshop-editor');
   await reopened.waitFor();
   assert.equal(await reopened.getByLabel('デザイン名',{exact:true}).inputValue(),example.name);
   await reopened.getByRole('group',{name:'制作する指'}).getByRole('button',{name:'人差し指',exact:true}).click();
   await reopened.getByText('パーツを追加・編集',{exact:true}).click();
   await reopened.getByText(/^2\/\d+個。/).waitFor();
   rows.at(-1).savedAndReopened=true;
  }
 }
 assert.equal(modelLoads.length,0,'demo must not initialize MediaPipe');
 await p.goto(base+showcaseUrl(showcaseExamples[0]),{waitUntil:'networkidle'});
 await p.locator('.preview-stage img').evaluate(i=>i.decode());
 await p.locator('.intro-actions input[type=file]').setInputFiles(opt('--image'));
 await p.waitForFunction(()=>{const i=document.querySelector('.preview-stage img');return i?.src.startsWith('blob:')&&i?.naturalWidth>0});
 await p.waitForFunction(()=>!document.querySelector('.loading-badge')&&/自動配置/.test(document.querySelector('.preview-header')?.textContent??''));
 const photo=await p.locator('.preview-stage img').getAttribute('src');
 await p.locator('.photo-design-picker>summary').click();
 await p.getByLabel('5本の作例から選ぶ',{exact:true}).selectOption('pearl');
 await p.getByRole('heading',{name:'シャンパンパール',exact:true}).waitFor();
 assert.equal(await p.locator('.preview-stage img').getAttribute('src'),photo);
 assert.ok(modelLoads.length>0,'user photos still use the model');
 assert.deepEqual(errors,[]);
}finally{await writeFile(path.join(out,'result.json'),JSON.stringify({rows,layouts,errors,modelLoadsAfterUpload:modelLoads.length},null,2));await b.close();}
console.log(`${rows.length} gallery/export comparisons and ${layouts.length} widths verified`);
