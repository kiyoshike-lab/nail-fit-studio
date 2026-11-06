// Actual hydration + sample photo + controls, with untrusted persisted settings.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';import path from 'node:path';
const args=process.argv.slice(2),opt=n=>args[args.indexOf(n)+1],base=opt('--base-url'),out=path.resolve(opt('--output-dir'));
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local QA only');await mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
const dk='nail-fit-studio-next.design.v1',nk='nail-fit-studio-next.nails.v1',rows=[];
const cases=[['null design',dk,'null'],['wrong design',dk,'{"color":3,"length":"long"}'],['broken JSON',dk,'not-json'],['null nails',nk,'null'],['wrong nails',nk,'[null,{},3]']];
try{
 for(const [name,key,raw] of cases){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
  await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
  await p.addInitScript(({key,raw})=>{if(!sessionStorage.getItem('qa-seeded')){localStorage.setItem(key,raw);sessionStorage.setItem('qa-seeded','1');}},{key,raw});
  await p.goto(base+'/try-on',{waitUntil:'networkidle'});await p.waitForTimeout(200);
  const usable=await p.getByRole('button',{name:'サンプル写真で試す',exact:true}).isVisible();
  const preserved=await p.evaluate(({key,raw})=>localStorage.getItem(key)===raw,{key,raw});
  let sample=false;if(usable&&args.includes('--assert-fixed')){
   await p.getByRole('button',{name:'サンプル写真で試す',exact:true}).click();
   await p.waitForFunction(()=>{const c=document.querySelector('.nail-canvas'),i=document.querySelector('img[alt="手の写真"]');return i?.naturalWidth>0&&c?.width>0&&c.height>0&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);});sample=true;
  }
  rows.push({name,usable,preserved,sample,errors});if(args.includes('--assert-fixed')){assert.equal(usable,true,name);assert.equal(preserved,true,name+' source overwritten');assert.equal(sample,true,name+' photo unusable');assert.deepEqual(errors,[],name);}
  await context.close();
 }
 const c=await browser.newContext(),p=await c.newPage();await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 await p.goto(base+'/try-on?shape=bogus&pattern=bogus&color=%23123456&length=garbage',{waitUntil:'networkidle'});await p.waitForTimeout(300);
 const stored=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),dk);rows.push({name:'untrusted query',stored});
 if(args.includes('--assert-fixed')){assert.equal(stored.color,'#123456');assert.equal(stored.shape,'oval');assert.equal(stored.pattern,'solid');assert.equal(stored.length,1);}
 await c.close();
 for(const raw of ['{}','{"tags":3}','"bad-result"']){
  const c=await browser.newContext(),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
  await p.addInitScript(raw=>localStorage.setItem('nail-fit-studio-next.diagnosis.v1',raw),raw);await p.goto(base+'/diagnosis',{waitUntil:'networkidle'});await p.waitForTimeout(150);
  const usable=await p.locator('.diagnosis-card').isVisible(),preserved=await p.evaluate(raw=>localStorage.getItem('nail-fit-studio-next.diagnosis.v1')===raw,raw);rows.push({name:'corrupt diagnosis',raw,usable,preserved,errors});
  if(args.includes('--assert-fixed')){assert.equal(usable,true);assert.equal(preserved,true);assert.deepEqual(errors,[]);}await c.close();
 }
 const context=await browser.newContext(),p2=await context.newPage();p2.on('dialog',d=>d.accept());await p2.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 await p2.goto(base+'/try-on',{waitUntil:'networkidle'});await p2.getByRole('button',{name:'デザインエディターを開く',exact:true}).click();const ed=p2.locator('.workshop-editor');
 await ed.getByLabel('ベースカラー',{exact:true}).fill('#123456');await p2.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.color==='#123456',dk);
 await ed.getByRole('button',{name:'開いた時の状態に戻す',exact:true}).click();await p2.waitForTimeout(150);
 const resetColor=await p2.evaluate(k=>JSON.parse(localStorage.getItem(k))?.color,dk);rows.push({name:'cancel inline editor restores persisted initial design',resetColor});
 if(args.includes('--assert-fixed')){assert.equal(resetColor,'#d9829b');await p2.reload({waitUntil:'networkidle'});assert.equal(await p2.getByLabel('カラー',{exact:true}).inputValue(),'#d9829b');}await context.close();
}finally{await browser.close();await writeFile(path.join(out,'result.json'),JSON.stringify({rows,ended:new Date().toISOString()},null,2));console.log(JSON.stringify(rows));}
