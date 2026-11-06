// Pixel equality, not subjective realism, physical fit, or hardware phone QA.
import assert from'node:assert/strict';import{writeFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import path from'node:path';import{typescriptModuleUrl,importTypescript}from'./lib/import-typescript.mjs';import{workshopPerformanceFixtures}from'./lib/workshop-performance-fixtures.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined,base=opt('--base-url');if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local only');
const before=await typescriptModuleUrl(path.join(opt('--before-root'),'src/lib/paintRenderer.ts')),after=await typescriptModuleUrl('src/lib/paintRenderer.ts'),fixtures=await workshopPerformanceFixtures(),defaults=await importTypescript('src/lib/defaults.ts');
const beforeNail=await typescriptModuleUrl(path.join(opt('--before-root'),'src/lib/nailRenderer.ts')),afterNail=await typescriptModuleUrl('src/lib/nailRenderer.ts');
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
try{const p=await browser.newPage();await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());await p.goto(base+'/create',{waitUntil:'networkidle'});
 const result=await p.evaluate(async({before,after,beforeNail,afterNail,fixtures,defaults})=>{
  const a=await import(before),b=await import(after),r0=await import(beforeNail),r1=await import(afterNail),rows=[];
  const pair=()=>Array.from({length:2},()=>{const c=document.createElement('canvas');c.width=600;c.height=900;return c;});let cs=pair();
  function equal(label){const x=cs[0].getContext('2d').getImageData(0,0,600,900).data,y=cs[1].getContext('2d').getImageData(0,0,600,900).data;let changed=0,maxDelta=0;for(let i=0;i<x.length;i++)if(x[i]!==y[i]){changed++;maxDelta=Math.max(maxDelta,Math.abs(x[i]-y[i]));}rows.push({label,changedChannels:changed,maxDelta});}
  function draw(label,art,w,h,light=false,brightness=.65){for(let i=0;i<2;i++){const x=cs[i].getContext('2d');x.clearRect(0,0,600,900);x.save();x.translate(300,450);[a,b][i].drawMixedArt(x,w,h,art,light,brightness);x.restore();}equal(label);}
  for(const f of fixtures){const art=f.document.fingers[0];for(const w of[60,120,240])for(const light of[false,true])draw(`${f.name}/${w}/${light}`,art,w,w*1.7,light);
   for(let n=0;n<8;n++){const edited={...art,layers:art.layers.map((l,i)=>i===art.layers.findLastIndex(l=>l.tool!=='eraser')?{...l,rotation:l.rotation+n*2}:l)};draw(`${f.name}/ink-${n}`,edited,120,204);}
   if(art.layers.length){const id=art.layers[0].id;for(const patch of[{visible:false},{opacity:0},{opacity:.3},{locked:true,name:'新しい名前'}])draw(`${f.name}/metadata-${JSON.stringify(patch)}`,{...art,layerMeta:{...art.layerMeta,[id]:{...art.layerMeta[id],...patch}}},120,204);
    draw(`${f.name}/reverse`,{...art,order:[...art.order].reverse()},120,204);draw(`${f.name}/hide-erasers`,{...art,layerMeta:Object.fromEntries(Object.entries(art.layerMeta).map(([id,m])=>[id,{...m,visible:!art.layers.some(l=>l.id===id&&l.tool==='eraser')}]))},120,204);
   }
  }
  const stress=fixtures.find(f=>f.name==='maximum').document.fingers[0],eraser=stress.layers.at(-1);
  for(const opacity of[0,.25,1])draw('eraser-opacity-'+opacity,{...stress,layerMeta:{...stress.layerMeta,[eraser.id]:{...stress.layerMeta[eraser.id],opacity}}},120,204);
  const originalPath=window.Path2D;try{window.Path2D=undefined;draw('Path2D-unavailable',structuredClone(stress),120,204);}finally{window.Path2D=originalPath;}
  const maximum=fixtures.find(f=>f.name==='maximum').document;for(const shape of['natural','round','oval','squoval','almond','coffin','square','stiletto'])for(const length of[.75,1,2.5]){
   const fingers=maximum.fingers.map(f=>({...f,base:{...f.base,shape,length}}));for(let i=0;i<2;i++){const x=cs[i].getContext('2d');await[i?r1.drawNails:r0.drawNails][0](x,600,900,defaults.defaultPhotoNails,fingers[0].base,{fingers,clear:true});}equal(`nail/${shape}/${length}`);
  }
  // Exact prefix/full hits really occurred, not just a no-cache comparison.
  const stats=b.paintRenderCacheStats();return{rows,stats};
 },{before,after,beforeNail,afterNail,fixtures,defaults});
 await writeFile(opt('--output'),JSON.stringify({scope:'Chrome exact RGBA equality vs frozen 10d3da5, all fixture sizes/light modes, edit/erase/metadata/order and nail clips',...result},null,2));
 assert.ok(result.stats.hits>0);assert.ok(result.stats.prefixHits>0);assert.ok(result.stats.pixels<=4000000);assert.deepEqual(result.rows.filter(r=>r.changedChannels),[]);console.log(`${result.rows.length} exact-pixel cases, cache hits=${result.stats.hits}, prefix hits=${result.stats.prefixHits}, retained pixels=${result.stats.pixels}`);
}finally{await browser.close();}
