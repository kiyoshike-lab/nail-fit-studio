// Full material gate, not a subjective/AI photo-realism score. Local only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {typescriptModuleUrl} from './lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url'),out=path.resolve(opt('--output-dir'));
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
await mkdir(out,{recursive:true});
const payload=JSON.parse(await readFile('public/assets/design-presets.json','utf8'));
const manifest=JSON.parse(await readFile('public/assets/preset-materials-v2.json','utf8'));
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],resources=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));
 let obsoleteManifestRequests=0;
 await page.route('**/assets/design-presets.json',r=>{obsoleteManifestRequests++;return r.abort();});
 await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 await page.goto(base+'/try-on',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'サンプル写真で試す',exact:true}).click();await page.locator('#design-title').click();
 for(let i=0;i<payload.presets.length;i++){
  const preset=payload.presets[i];await page.locator('.preset-card').nth(i).click();
  await page.waitForFunction(expected=>JSON.parse(localStorage.getItem('nail-fit-studio-next.design.v1'))?.textureUrl==='/'+expected,preset.textureImage);
  assert.ok((await page.locator('p.hint[aria-live="polite"]').textContent()).includes(preset.name),'selected preset credit label mismatch');
  await page.locator('.preset-card').nth(i).locator('img').evaluate(async(im,expected)=>{await im.decode();if(!decodeURIComponent(im.currentSrc).includes(expected))throw Error('stale optimized thumbnail URL');},preset.previewImage);
 }
 assert.equal(obsoleteManifestRequests,0,'old cached manifest path must not be reused');
 const designs=manifest.materials.map(e=>({...payload.presets.find(p=>p.textureImage===e.texture),textureUrl:'/'+e.texture}));
 const renderUrl=await typescriptModuleUrl('src/lib/nailRenderer.ts');
 const raster=await page.evaluate(async({url,list})=>{
  const {drawNails}=await import(url);
  const base={color:'#c58a9f',shape:'oval',finish:'gloss',material:'cream',pattern:'patterned',motif:'none',motifColor:'#ffffff',tipColor:'#ffffff',tipAmount:.28,length:1,thickness:.28,realism:1};
  const board=document.createElement('canvas');board.width=1440;board.height=Math.ceil(list.length/6)*330;const bx=board.getContext('2d');bx.fillStyle='#fff9fb';bx.fillRect(0,0,board.width,board.height);
  const rows=[];
  for(let i=0;i<list.length;i++){
   const item=list[i],c=document.createElement('canvas');c.width=240;c.height=300;const cx=c.getContext('2d',{willReadFrequently:true});
   const design={...base,textureUrl:item.textureUrl},pose={x:50,y:92,width:75,height:82,rotation:(i%3-1)*10,visibility:1};
   await drawNails(cx,240,300,[pose],design,{clear:true});
   const data=cx.getImageData(0,0,240,300).data,visible=data.reduce((n,v,j)=>n+(j%4===3&&v>0),0);if(visible<3000)throw Error('blank material '+item.textureUrl);
   const im=new Image();im.src=item.textureUrl;await im.decode();const thumb=new Image();thumb.src='/'+item.previewImage;await thumb.decode();
   if(im.naturalWidth<64||im.naturalHeight<64)throw Error('tiny surface '+item.textureUrl);
   const x=i%6*240,y=Math.floor(i/6)*330;bx.drawImage(c,x,y);bx.fillStyle='#2b1721';bx.font='13px sans-serif';bx.fillText(item.textureUrl.match(/\d{3}/)[0]+'  '+im.naturalWidth+'x'+im.naturalHeight,x+8,y+318);
   const original=c.toDataURL();await drawNails(cx,240,300,[pose],{...design,pattern:'french',motif:'dots',finish:'chrome',material:'glitter'},{clear:true});
   if(c.toDataURL()!==original)throw Error('photo overpaint '+item.textureUrl);
   if(i===0){await drawNails(cx,240,300,[pose],design,{fingers:[{base:design,opacity:1,effect:'dots',parts:[]}],clear:true});if(c.toDataURL()===original)throw Error('explicit saved artwork effect lost');}
   await drawNails(cx,240,300,[{...pose,visibility:0}],design,{clear:true});
   if(cx.getImageData(0,0,240,300).data.some((v,j)=>j%4===3&&v))throw Error('hidden nail leak');
   rows.push({texture:item.textureUrl,native:[im.naturalWidth,im.naturalHeight],visible,thumbnailDecoded:true,photoNotOverprinted:true});
  }return {png:board.toDataURL().split(',')[1],rows};
 },{url:renderUrl,list:designs});
 await writeFile(path.join(out,'all-47-rendered-enlarged.png'),Buffer.from(raster.png,'base64'));
 for(const e of manifest.materials){
  for(const file of [e.texture,e.preview,e.cutout,`assets/preset-textures/texture_${e.id}.png`,`assets/preset-previews/design_${e.id}.jpg`]){
   const r=await page.request.get(base+'/'+file);assert.equal(r.status(),200,file);resources.push({path:file,status:r.status()});
  }
  const bytes=await readFile('public/'+e.texture);assert.equal(hash(bytes),e.textureSha256);
  const old=execFileSync('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'show',`22b537b:public/assets/preset-textures/texture_${e.id}.png`],{maxBuffer:10_000_000});
  assert.notEqual(hash(old),hash(bytes),'old quilt unchanged '+e.id);
 }
 const retry=await browser.newPage();await retry.goto(base+'/try-on',{waitUntil:'networkidle'});let attempts=0;
 await retry.route('**/nail_texture_001_v2*.png',r=>++attempts===1?r.abort():r.continue());
 const recovery=await retry.evaluate(async url=>{
  const{drawNails}=await import(url);const c=document.createElement('canvas');c.width=180;c.height=260;const ctx=c.getContext('2d');
  const d={color:'#ff00ff',shape:'oval',finish:'gloss',material:'cream',pattern:'solid',motif:'none',motifColor:'#ffffff',tipColor:'#ffffff',tipAmount:.28,length:1,thickness:.28,realism:1,textureUrl:'/assets/preset-textures/texture_001.png'};
  const poses=[{x:50,y:90,width:60,height:70,rotation:0}];await drawNails(ctx,180,260,poses,d,{clear:true});const fallback=c.toDataURL();
  await new Promise(r=>setTimeout(r,1600));await drawNails(ctx,180,260,poses,d,{clear:true});return{changed:c.toDataURL()!==fallback,alpha:ctx.getImageData(90,130,1,1).data[3]};
 },renderUrl);assert.equal(attempts,2);assert.ok(recovery.changed&&recovery.alpha>0);
 assert.deepEqual(errors,[]);
 const report={created:new Date().toISOString(),presets:83,materials:47,uniqueSources:new Set(manifest.materials.map(e=>e.sourceId)).size,uniqueSurfaces:new Set(manifest.materials.map(e=>e.textureSha256)).size,resources,raster:raster.rows,recovery,errors,knownQuiltApplied:false,manualReviewRequired:'Inspect all-47-rendered-enlarged.png; not a photo-realism score or a real-phone test.'};
 await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({presets:83,materials:47,resources:resources.length,retry:recovery,errors}));
}finally{await browser.close();}
