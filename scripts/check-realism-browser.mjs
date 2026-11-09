// Actual hand photos + immutable poses shared by both renderers. No AI beauty
// score, real-phone or physically calibrated light/3D claim. All outputs LOCAL.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir}from'node:fs/promises';
import path from'node:path';import{pathToFileURL}from'node:url';
import{importTypescript,typescriptModuleUrl}from'./lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
 const base=opt('--base-url'),out=path.resolve(opt('--output-dir'));
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local only');await mkdir(out,{recursive:true});
const before=await typescriptModuleUrl(path.join(opt('--before-root'),'src/lib/nailRenderer.ts')),after=await typescriptModuleUrl('src/lib/nailRenderer.ts');
const{nailStyles}=await importTypescript('src/lib/nailStyles.ts'),{defaultDesign}=await importTypescript('src/lib/defaults.ts'),{partNames}=await importTypescript('src/lib/workshopTypes.ts');
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const photos=[opt('--image'),opt('--image2'),opt('--image3')].filter(Boolean),rows=[],errors=[];
try{
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());await p.goto(base+'/try-on',{waitUntil:'networkidle'});
 for(let photo=0;photo<photos.length;photo++){
  const previous=await p.locator('img[alt="手の写真"]').getAttribute('src');await p.locator('input[type=file]').first().setInputFiles(photos[photo]);
  await p.waitForFunction(previous=>{const im=document.querySelector('img[alt="手の写真"]');return im?.src&&im.getAttribute('src')!==previous&&im.complete&&im.naturalWidth>0;},previous);
  await p.waitForFunction(()=>!document.querySelector('.loading-badge')&&/自動配置|認識できません/.test(document.querySelector('.preview-header')?.textContent??''));await p.waitForTimeout(650);
  const input=await p.evaluate(()=>{const im=document.querySelector('img[alt="手の写真"]'),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return{image:c.toDataURL(),nails:JSON.parse(localStorage.getItem('nail-fit-studio-next.nails.v1')),status:document.querySelector('.preview-header').textContent};});
  const visible=input.nails.filter(n=>(n.visibility??1)>.05).length;
  if(visible<3){rows.push({photo,visible,skipped:true,status:input.status});continue;}
  const result=await p.evaluate(async({before,after,input,styles,base,parts})=>{
   const renderers=[(await import(before)).drawNails,(await import(after)).drawNails],im=new Image();im.src=input.image;await im.decode();
   const cases=[{id:'legacy',base},...styles.map(s=>({id:s.id,base:{...base,color:s.color,tipColor:s.tipColor},surface:s.surface})),...Object.keys(parts).map(kind=>({id:'part-'+kind,base,part:{id:'p',kind,color:kind==='gold-holo'?'#dbbc76':'#e6c7d9',x:0,y:0,size:.42,rotation:0}}))];
   const boards=[],caseRows=[];let board,bx;
   for(let i=0;i<cases.length;i++){
    if(i%4===0){board=document.createElement('canvas');board.width=1000;board.height=4*330;bx=board.getContext('2d');bx.fillStyle='#faf7f5';bx.fillRect(0,0,1000,1320);boards.push(board);}
    const s=cases[i],fingers=input.nails.map(()=>({base:s.base,opacity:1,effect:'none',parts:s.part?[s.part]:[],...(s.surface?{surface:s.surface}:{})}));
    const pair=[];
    for(let version=0;version<2;version++){
     const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);
     await renderers[version](ctx,c.width,c.height,input.nails,s.base,{fingers});pair.push(c);
     const y=i%4*330,x=version*500;bx.fillStyle='#36272d';bx.font='15px sans-serif';bx.fillText(s.id+' / '+(version?'AFTER':'BEFORE'),x+10,y+20);
     const scale=Math.min(480/im.width,205/im.height);bx.drawImage(c,x+(500-im.width*scale)/2,y+28,im.width*scale,im.height*scale);
     // Current geometry, not independent recentered crops. Missing alignment
     // remains visible; no Photoshop-style hand retouching or pose adjustment.
     input.nails.forEach((n,j)=>{const h=n.height/100*c.height,w=n.width/100*c.width,a=(n.rotation-90)*Math.PI/180,cx=n.x/100*c.width+Math.cos(a)*h/2,cy=n.y/100*c.height+Math.sin(a)*h/2,r=Math.max(w*1.5,h*1.2);bx.drawImage(c,cx-r/2,cy-r/2,r,r,x+j*98+5,y+235,90,90);});
    }
    const a=pair[0].getContext('2d').getImageData(0,0,im.width,im.height).data,b=pair[1].getContext('2d').getImageData(0,0,im.width,im.height).data;let changed=0;
    for(let j=0;j<a.length;j++)if(a[j]!==b[j])changed++;
    if(s.id==='matte'&&changed)throw Error('unapproved matte optics changed');
    // Determinism and visibility apply even though intentional visual changes
    // are NOT expected to be pixel-equal to the former renderer.
    const check=document.createElement('canvas');check.width=im.width;check.height=im.height;const cx=check.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0);await renderers[1](cx,im.width,im.height,input.nails,s.base,{fingers});const same=cx.getImageData(0,0,im.width,im.height).data;
    if(same.some((v,j)=>v!==b[j]))throw Error('non-deterministic '+s.id);
    await renderers[1](cx,im.width,im.height,input.nails.map(n=>({...n,visibility:0})),s.base,{fingers,clear:true});if(cx.getImageData(0,0,im.width,im.height).data.some((v,j)=>j%4===3&&v))throw Error('hidden material leaks '+s.id);
    caseRows.push({id:s.id,changedChannels:changed,deterministic:true,hiddenMask:true});
   }
   return{boards:boards.map(c=>c.toDataURL().split(',')[1]),cases:caseRows,size:[im.width,im.height]};
  },{before,after,input,styles:nailStyles,base:defaultDesign,parts:partNames});
  for(let i=0;i<result.boards.length;i++)await writeFile(path.join(out,`hand-${photo}-board-${i}.png`),Buffer.from(result.boards[i],'base64'));
  rows.push({photo,source:photos[photo],visible,size:result.size,cases:result.cases});
 }
 const materials=JSON.parse(await readFile('public/assets/preset-materials-v2.json','utf8')).materials;
 const photoPreservation=await p.evaluate(async({before,after,base,materials})=>{
  const renderers=[(await import(before)).drawNails,(await import(after)).drawNails],rows=[];
  for(const m of materials){const pixels=[];for(const render of renderers){const c=document.createElement('canvas');c.width=300;c.height=400;const x=c.getContext('2d',{willReadFrequently:true});await render(x,300,400,[{x:50,y:85,width:30,height:58,rotation:17}],{...base,realism:1,textureUrl:'/'+m.texture});pixels.push(x.getImageData(0,0,300,400).data);}if(pixels[0].some((v,i)=>v!==pixels[1][i]))throw Error('photo material changed '+m.id);rows.push(m.id);}return rows;
 },{before,after,base:defaultDesign,materials});
 assert.ok(rows.filter(r=>!r.skipped).length>=2,'Need at least two actual hands, not one tuned image');assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'result.json'),JSON.stringify({scope:'before/after same actual images, current model poses held fixed, same native resolution and design; CPU readback canvases, crops only enlarge for QA, no physical phones or aesthetic scoring',rows,photoPreservation,errors},null,2));console.log(JSON.stringify({photos:rows.length,usable:rows.filter(r=>!r.skipped).length,cases:rows.flatMap(r=>r.cases??[]).length,photoPreserved:photoPreservation.length,errors}));
}finally{await browser.close();}
