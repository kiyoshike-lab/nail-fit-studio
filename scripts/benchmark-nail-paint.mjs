// Browser Canvas CPU submission costs. Not camera FPS, GPU completion, or phone hardware.
import{writeFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import path from'node:path';import{typescriptModuleUrl,importTypescript}from'./lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined,base=opt('--base-url')??'http://127.0.0.1:4235';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
const root=opt('--source-root')??'.',source=f=>path.join(root,'src/lib',f),sampleCount=Number(opt('--samples')??120);
if(!Number.isInteger(sampleCount)||sampleCount<30||sampleCount>1000)throw Error('--samples must be 30..1000');
const{defaultDesign,defaultPhotoNails}=await importTypescript(source('defaults.ts')),data=await importTypescript(source('paintData.ts')),url=await typescriptModuleUrl(source('nailRenderer.ts'));
try{const p=await browser.newPage();await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());await p.goto(base+'/try-on',{waitUntil:'networkidle'});
 const rows=await p.evaluate(async({url,design,nails,style,sampleCount})=>{
  const{drawNails}=await import(url),canvas=document.createElement('canvas');canvas.width=800;canvas.height=1040;const ctx=canvas.getContext('2d');
  const make=(count)=>Array.from({length:5},()=>{
    const layers=Array.from({length:count},(_,i)=>({...style,id:`s${i}`,type:'stroke',tool:count===32&&i>=24?'eraser':i%4===0?'holo':i%4===1?'brush':i%4===2?'dots':'pen',x:0,y:0,scale:1,rotation:i*5,mirror:false,opacity:i>=24?.4:1,lineWidth:.025,points:Array.from({length:count===32?128:40},(_,n)=>({x:n/(count===32?127:39)*.6-.3,y:Math.sin(n*.14+i)*.2}))}));
    const parts=Array.from({length:count===32?12:count?1:0},(_,i)=>({id:`p${i}`,kind:'pearl',x:(i%3-1)*.2,y:(Math.floor(i/3)-1.5)*.15,size:.15,color:'#f2e7ee',rotation:0}));return{base:design,opacity:1,effect:'none',layers,parts,order:[...parts.map(p=>p.id),...layers.map(l=>l.id)]};
  });
  const rows=[],quant=(s,q)=>[...s].sort((a,b)=>a-b)[Math.floor((s.length-1)*q)];
  for(const layersPerFinger of[0,3,32])for(const scenario of['cached','distance-change','active-stroke']){
    const fingers=make(layersPerFinger);for(let i=0;i<12;i++)await drawNails(ctx,780,1040,nails,design,{fingers,clear:true});const times=[];
    const samples=sampleCount;
    for(let i=0;i<samples;i++){
      if(i%5===0)await new Promise(requestAnimationFrame);
      const changing=scenario==='active-stroke'&&layersPerFinger?fingers.map((f,j)=>j?f:{...f,layers:f.layers.map((l,k)=>k?l:{...l,points:l.points.map((p,k)=>k===l.points.length-1?{x:p.x,y:p.y+i*.0005}:p)})}):fingers;
      const width=scenario==='distance-change'?i%2?800:780:780,start=performance.now();await drawNails(ctx,width,1040,nails,design,{clear:true,fingers:changing});times.push(performance.now()-start);
    }
    rows.push({layersPerFinger,partsPerFinger:fingers[0].parts.length,pointsPerFinger:fingers[0].layers.reduce((n,l)=>n+l.points.length,0),scenario,samples,p50Ms:quant(times,.5),p90Ms:quant(times,.9),p99Ms:quant(times,.99),maxMs:Math.max(...times)});
  }return rows;
 },{url,design:defaultDesign,nails:defaultPhotoNails,style:data.defaultPaintStyle,sampleCount});
 const report={scope:'Chrome desktop, 5 nails / 780-800x1040 Canvas; cached vs alternating 2.6% width scale vs one active path; CPU submission only, no MediaPipe or physical phone',rows};await writeFile(opt('--output'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
