// Local QA only. Rasterizes the actual natural-nail Canvas paths against fixed
// source masks, and times both pixel refiners in the same browser. No GT is used
// by either refiner. Requires locally prepared, licensed evaluation data.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {typescriptModuleUrl} from './lib/import-typescript.mjs';
const args=process.argv.slice(2),option=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
for(const flag of ['--cases','--input','--baseline-refiner','--playwright-module','--output'])if(!option(flag))throw Error(`${flag} required`);
const {chromium}=await import(pathToFileURL(path.resolve(option('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 const urls={renderer:await typescriptModuleUrl('src/lib/nailRenderer.ts'),surface:await typescriptModuleUrl('scripts/lib/nail-surface-candidate.ts'),
  geometry:await typescriptModuleUrl('src/lib/nailGeometry.ts'),before:await typescriptModuleUrl(option('--baseline-refiner')),after:await typescriptModuleUrl('src/lib/nailImageRefinement.ts')};
 const cases=JSON.parse(await readFile(option('--cases'),'utf8')),input=JSON.parse(await readFile(option('--input'),'utf8'));
 const result=await page.evaluate(async({urls,cases,input})=>{
  const {buildNailPath}=await import(urls.renderer),{buildSurfacePath}=await import(urls.surface),{buildNailsFromLandmarks}=await import(urls.geometry);
  const beforeRefine=(await import(urls.before)).refineNailsFromPixels,afterRefine=(await import(urls.after)).refineNailsFromPixels;
  const decode=b64=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const rows=[];
  for(const item of cases){
   const canvas=document.createElement('canvas');canvas.width=item.width;canvas.height=item.height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true}),labels=decode(item.labels);
   for(const match of item.matches){
    const values={};
    for(const stage of ['before','after','candidate']){
     const nail=item[stage==='before'?'before':'after'][match.finger],w=nail.width/100*item.width,h=nail.height/100*item.height;
     const a=(nail.rotation-90)*Math.PI/180;
     ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();
     ctx.translate(nail.x/100*item.width+Math.cos(a)*h/2,nail.y/100*item.height+Math.sin(a)*h/2);ctx.rotate(nail.rotation*Math.PI/180);
     const surfaceUsed=stage==='candidate'&&buildSurfacePath(ctx,w,h,1,'natural',item.surfaces?.[match.finger]);
     if(!surfaceUsed)buildNailPath(ctx,w,h,'natural');
     ctx.fillStyle='white';ctx.fill();ctx.restore();
     const pixels=ctx.getImageData(0,0,item.width,item.height).data;let intersection=0,union=0;
     for(let i=0;i<labels.length;i++){const predicted=pixels[i*4+3]>=128,gold=labels[i]===match.label;if(predicted||gold)union++;if(predicted&&gold)intersection++;}
     values[stage]={iou:intersection/Math.max(1,union),surfaceUsed:Boolean(surfaceUsed)};
    }
    rows.push({file:item.file,finger:match.finger,...values});
   }
  }
  const prepared=input.cases.map(item=>({image:{width:item.width,height:item.height,data:new Uint8ClampedArray(decode(item.pixels))},nails:buildNailsFromLandmarks(item.landmarks,false,item.width/item.height)}));
  // Alternate order per pass; first pass warms JIT and is excluded.
  const samples={before:[],after:[]};
  for(let pass=0;pass<4;pass++)for(const stage of pass%2?['after','before']:['before','after'])for(const item of prepared){
   const started=performance.now();(stage==='before'?beforeRefine:afterRefine)(item.image,item.nails,false);
   const ms=performance.now()-started;if(pass)samples[stage].push(ms);
  }
  const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length,stats=xs=>{const s=[...xs].sort((a,b)=>a-b);return {samples:s.length,meanMs:mean(s),p50Ms:s[Math.floor(s.length*.5)],p95Ms:s[Math.floor(s.length*.95)]};};
  return {method:'actual Canvas natural design paths at length=1, alpha>=128, baseline-locked per-component masks; silhouette IoU, not photorealism or anatomical cuticle accuracy',nails:rows.length,
   beforeIoU:mean(rows.map(x=>x.before.iou)),afterIoU:mean(rows.map(x=>x.after.iou)),
   experimentalContourIoU:mean(rows.map(x=>x.candidate.iou)),experimentalContourNails:rows.filter(x=>x.candidate.surfaceUsed).length,
   byFinger:Array.from({length:5},(_,finger)=>{const r=rows.filter(x=>x.finger===finger);return {finger,n:r.length,beforeIoU:mean(r.map(x=>x.before.iou)),afterIoU:mean(r.map(x=>x.after.iou))};}),
   timing:{method:'headless desktop Chrome, alternating warmed pure pixel-refinement calls; not camera FPS or mobile timing',before:stats(samples.before),after:stats(samples.after)},rows};
 },{urls,cases,input});
 await writeFile(option('--output'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,rows:undefined},null,2));
}finally{await browser.close();}
