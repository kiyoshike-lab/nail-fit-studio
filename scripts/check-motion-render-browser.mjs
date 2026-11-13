// Exact dynamic geometry/pool reuse, NOT a latency benchmark: pixel readbacks
// alter Canvas scheduling. Do not count these frames as the 217 fixed cases.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';import{pathToFileURL}from'node:url';
import{typescriptModuleUrl,importTypescript}from'./lib/import-typescript.mjs';
import{workshopPerformanceFixtures}from'./lib/workshop-performance-fixtures.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined,base=opt('--base-url');
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const before=await typescriptModuleUrl(path.join(opt('--before-root'),'src/lib/nailRenderer.ts')),after=await typescriptModuleUrl('src/lib/nailRenderer.ts');
const{defaultPhotoNails:nails}=await importTypescript('src/lib/defaults.ts'),fingers=(await workshopPerformanceFixtures()).find(f=>f.name==='maximum').document.fingers;
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await browser.newPage();await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());await p.goto(base+'/create',{waitUntil:'networkidle'});
 const result=await p.evaluate(async({before,after,nails,fingers})=>{
  const mods=[await import(before),await import(after)],cs=mods.map(()=>{const c=document.createElement('canvas');c.width=800;c.height=1040;return c;}),xs=cs.map(c=>c.getContext('2d',{willReadFrequently:true}));let changed=0;
  for(let n=0;n<240;n++){
   const scale=.78+.48*(1-Math.cos(n*.086))/2,poses=nails.map((p,i)=>({...p,x:p.x+1.5*Math.sin(n*.05),y:p.y+2*Math.cos(n*.033),rotation:p.rotation+15*Math.sin(n*.04),width:p.width*scale*(1+.01*Math.sin(n*.037+i)),height:p.height*scale*(1+.012*Math.cos(n*.029+i))}));
   for(let k=0;k<2;k++)await mods[k].drawNails(xs[k],800,1040,poses,fingers[0].base,{fingers,clear:true});
   const a=xs[0].getImageData(0,0,800,1040).data,b=xs[1].getImageData(0,0,800,1040).data;let diff=0;for(let j=0;j<a.length;j++)if(a[j]!==b[j])diff++;changed+=diff;if(diff)throw Error('motion frame '+n+' changed '+diff+' channels');
  }
  return{frames:240,changedChannels:changed,scope:'exact RGBA at 800x1040; per-finger scale/aspect + XY + rotation; repeated readback, NOT timing or physical camera QA'};
 },{before,after,nails,fingers});
 assert.equal(result.changedChannels,0);await writeFile(opt('--output'),JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}
