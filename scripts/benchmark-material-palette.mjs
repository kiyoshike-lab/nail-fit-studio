// Local production Chrome, DOM + Canvas submission, NOT phone presentation time.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined,base=opt('--base-url');
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[];
try{
 for(let run=0;run<3;run++){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2}),page=await context.newPage();
  await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
  await page.goto(base+'/create',{waitUntil:'networkidle'});await page.getByRole('button',{name:'拡大して絵を描く',exact:true}).click();
  rows.push(await page.locator('.nail-paint-editor').evaluate(async(root,run)=>{
   const frame=()=>new Promise(requestAnimationFrame),click=async(name,within=root)=>{const b=[...within.querySelectorAll('button')].find(b=>b.textContent===name);if(!b)throw Error(name);const t=performance.now();b.click();await frame();await frame();return performance.now()-t;};
   const openMs=await click('素材'),all38Ms=await click('すべて',root.querySelector('.material-palette'));
   const cs=[...root.querySelectorAll('.material-grid canvas')],painted=cs.filter(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)).length;
   return{run,openMs,all38Ms,count:cs.length,painted,heapMB:performance.memory?performance.memory.usedJSHeapSize/1048576:null};
  },run));assert.equal(rows.at(-1).count,38);assert.equal(rows.at(-1).painted,38);await context.close();
 }
 await writeFile(opt('--output'),JSON.stringify({scope:'3 fresh production contexts; click to two RAF + nonempty Canvas; no physical-screen or baseline timing claim',rows},null,2));console.log(JSON.stringify(rows));
}finally{await browser.close();}
