// Freeze the old renderer with typescriptModuleUrl BEFORE editing. Only local
// fixture photographs; outputs stay outside the repo (not redistributable assets).
import assert from 'node:assert/strict';import{readFile,writeFile,mkdir}from'node:fs/promises';import path from'node:path';import{pathToFileURL}from'node:url';
import{typescriptModuleUrl,importTypescript}from'./lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined,base=opt('--base-url'),out=path.resolve(opt('--output-dir'));
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
await mkdir(out,{recursive:true});const before=await readFile(opt('--before-renderer'),'utf8'),after=await typescriptModuleUrl('src/lib/nailRenderer.ts');
const{defaultDesign,defaultPhotoNails}=await importTypescript('src/lib/defaults.ts'),{nailStyles}=await importTypescript('src/lib/nailStyles.ts'),data=await importTypescript('src/lib/paintData.ts');
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);let browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={scope:'Same Chrome process; frozen e51e164 renderer versus current. Identical source/poses/design/ink/light/resolution. New surface parameters are ignored by old renderer. CPU submission only, not GPU completion, real camera FPS, physical accuracy or phone hardware.',photos:[],benchmarks:[]};
try{let page=await browser.newPage();page.setDefaultTimeout(60000);await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 for(const [index,file]of[opt('--image'),opt('--image2')].filter(Boolean).entries()){
  await page.goto(base+'/try-on',{waitUntil:'networkidle'});await page.locator('input[type=file]').first().setInputFiles(file);await page.waitForFunction(()=>document.querySelector('img[alt="手の写真"]')?.naturalWidth>0&&!document.querySelector('.loading-badge')&&document.querySelector('.preview-header')?.textContent.includes('自動配置'));await page.waitForTimeout(400);
  const nails=await page.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.nails.v1')));assert.ok(nails?.length===5);assert.ok(nails.some(n=>n.visibility===undefined||n.visibility>.05),'no visible nails in comparison');await writeFile(path.join(out,`photo-${index+1}-poses.json`),JSON.stringify(nails,null,2));const image='data:image/jpeg;base64,'+(await readFile(file)).toString('base64');
  for(const kind of['color','sheer','french']){
   const result=await page.evaluate(async({before,after,image,nails,kind,design,style})=>{
    const renderers=[(await import(before)).drawNails,(await import(after)).drawNails],im=new Image();im.src=image;await im.decode();const w=im.naturalWidth,h=im.naturalHeight;
    const base={...design,material:kind==='sheer'?'sheer':'cream',finish:kind==='sheer'?'sheer':'gloss',pattern:kind==='french'?'french':'solid',color:'#bd6d88',tipColor:'#fff3ee'};
    const layer={id:'ink',type:'shape',tool:'circle',color:'#963454',strokeColor:'#963454',secondary:'#fff3ee',opacity:1,lineWidth:.03,fill:true,stroke:false,spacing:1,width:.28,height:.28,x:0,y:0,rotation:0,scale:1,mirror:false,bend:0};
    const art={base,opacity:1,effect:'none',parts:[],layers:[layer],order:['ink'],surface:style},images=[];
    for(const draw of renderers){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(im,0,0);await draw(x,w,h,nails,base,{fingers:Array.from({length:5},()=>art)});images.push(c);}
    const board=document.createElement('canvas');board.width=w*3;board.height=h+42;const x=board.getContext('2d');x.fillStyle='#fcf7f9';x.fillRect(0,0,board.width,board.height);x.font='16px sans-serif';x.fillStyle='#382b31';['元の写真','改修前 e51e164','新しい質感モデル'].forEach((label,i)=>x.fillText(label,i*w+8,26));x.drawImage(im,0,42);images.forEach((c,i)=>x.drawImage(c,(i+1)*w,42));
    return{png:board.toDataURL('image/png').split(',')[1],width:w,height:h,visible:nails.filter(n=>n.visibility===undefined||n.visibility>.05).length};
   },{before,after,image,nails,kind,design:defaultDesign,style:nailStyles.find(s=>s.id===kind).surface});
   const name=`photo-${index+1}-${kind}-comparison.png`;await writeFile(path.join(out,name),Buffer.from(result.png,'base64'));report.photos.push({file:path.basename(file),kind,comparison:name,width:result.width,height:result.height,visibleNails:result.visible});
  }
 }
 // Model/photo QA uses SwiftShader for deterministic MediaPipe. Benchmark 2D
 // Canvas in a fresh default Chrome process, just like benchmark-nail-paint.
 // Otherwise SwiftShader GPU queue saturation dominates this CPU-submit metric.
 await browser.close();browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});page=await browser.newPage();await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());await page.goto(base+'/create',{waitUntil:'networkidle'});
 // Alternate execution order across rounds. No concurrent unit/build workloads.
 report.benchmarks=await page.evaluate(async({before,after,design,nails,style,surface})=>{
  const renderers={before:(await import(before)).drawNails,after:(await import(after)).drawNails},canvas=document.createElement('canvas');canvas.width=800;canvas.height=1040;const ctx=canvas.getContext('2d'),rows=[];
  const q=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.ceil((xs.length-1)*p)];
  const make=count=>Array.from({length:5},()=>{
   const layers=Array.from({length:count},(_,i)=>({...style,id:`l${i}`,type:'stroke',tool:count===32&&i>=24?'eraser':i%4===0?'holo':i%4===1?'brush':i%4===2?'dots':'pen',x:0,y:0,scale:1,rotation:i*5,mirror:false,opacity:i>=24?.4:1,lineWidth:.025,points:Array.from({length:count===32?128:40},(_,n)=>({x:n/(count===32?127:39)*.6-.3,y:Math.sin(n*.14+i)*.2}))}));
   const parts=Array.from({length:count===32?12:count?1:0},(_,i)=>({id:`p${i}`,kind:'pearl',x:(i%3-1)*.2,y:(Math.floor(i/3)-1.5)*.15,size:.15,color:'#f2e7ee',rotation:0}));return{base:design,opacity:1,effect:'none',surface,parts,layers,order:[...parts.map(p=>p.id),...layers.map(l=>l.id)]};
  });
  async function measure(run,count,scenario,version){
   const fingers=make(count),draw=renderers[version==='after-flash'?'after':version];if(version==='after-flash')fingers.forEach(f=>f.surface={...f.surface,kind:'flash'});for(let i=0;i<12;i++)await draw(ctx,780,1040,nails,design,{fingers,clear:true});const times=[];
   for(let i=0;i<120;i++){if(i%5===0)await new Promise(requestAnimationFrame);const changing=scenario==='active-stroke'&&count?fingers.map((f,j)=>j?f:{...f,layers:f.layers.map((l,k)=>k?l:{...l,points:l.points.map((p,k)=>k===l.points.length-1?{x:p.x,y:p.y+i*.0005}:p)})}):fingers;
    const start=performance.now();await draw(ctx,scenario==='distance-change'&&i%2?800:780,1040,nails,design,{fingers:changing,clear:true});times.push(performance.now()-start);
   }rows.push({run,version,layersPerFinger:count,partsPerFinger:count===32?12:count?1:0,scenario,samples:120,p50Ms:q(times,.5),p90Ms:q(times,.9),p99Ms:q(times,.99),maxMs:Math.max(...times)});
  }
  for(let run=0;run<3;run++)for(const count of[0,3,32])for(const scenario of['cached','distance-change','active-stroke'])for(const version of run%2?['after','before']:['before','after'])await measure(run,count,scenario,version);
  for(const count of[3,32])for(const scenario of['cached','distance-change'])await measure(0,count,scenario,'after-flash');
  return rows;
 },{before,after,design:defaultDesign,nails:defaultPhotoNails,style:data.defaultPaintStyle,surface:nailStyles.find(s=>s.id==='color').surface});
 await writeFile(path.join(out,'gel-comparison.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({photos:report.photos,benchmarkRows:report.benchmarks.length},null,2));
}finally{await browser.close();}
