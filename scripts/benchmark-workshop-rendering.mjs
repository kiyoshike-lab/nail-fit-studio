// Local Chrome Canvas command/paint submission cost, NOT camera FPS or GPU completion.
import {writeFile} from 'node:fs/promises';import {pathToFileURL}from'node:url';import path from'node:path';
import {typescriptModuleUrl,importTypescript}from'./lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url')??'http://127.0.0.1:4234';if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await browser.newPage({viewport:{width:390,height:844}});await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());await p.goto(base+'/try-on',{waitUntil:'networkidle'});
 const{defaultDesign,defaultPhotoNails}=await importTypescript('src/lib/defaults.ts'),url=await typescriptModuleUrl('src/lib/nailRenderer.ts');
 const results=await p.evaluate(async({url,base,nails})=>{
  const{drawNails}=await import(url),canvas=document.createElement('canvas');canvas.width=780;canvas.height=1040;const ctx=canvas.getContext('2d');
  const rows=[];const quant=(a,q)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*q)];
   for(const partsPerFinger of[0,1,12])for(const light of partsPerFinger===0?[false]:[false,true]){
    const fingers=Array.from({length:5},()=>({base,opacity:1,effect:'none',parts:Array.from({length:partsPerFinger},(_,i)=>({id:String(i),kind:i%3===0?'flower':'silver-holo',x:(i%3-1)*.25,y:(Math.floor(i/3)-1.5)*.17,size:.24,rotation:i*13,color:'#d9dfed'}))}));
    for(let i=0;i<30;i++)await drawNails(ctx,780,1040,nails,base,{clear:true,fingers,lightParts:light});
    const samples=[];
    for(let batch=0;batch<5;batch++){
     await new Promise(requestAnimationFrame);
     for(let i=0;i<100;i++){const start=performance.now();await drawNails(ctx,780,1040,nails,base,{clear:true,fingers,lightParts:light});samples.push(performance.now()-start);}
    }
    rows.push({parts:partsPerFinger*5,light,samples:500,p50Ms:quant(samples,.5),p90Ms:quant(samples,.9),meanMs:samples.reduce((n,x)=>n+x,0)/samples.length});
   }
  return rows;
 },{url,base:defaultDesign,nails:defaultPhotoNails});
 const report={scope:'Chrome desktop, 780x1040 Canvas, no MediaPipe, 500 CPU submission samples/condition after 30 warmup, NOT phone hardware/FPS/GPU completion',results};await writeFile(opt('--output'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
