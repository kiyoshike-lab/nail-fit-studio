// Purpose-specific second pass: page/layout/contrast evidence + a fresh beginner
// journey, not a re-run of the functional runner. NOT physical phone/AT testing.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';import path from 'node:path';
import {importTypescript} from './lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined,base=opt('--base-url'),out=path.resolve(opt('--output-dir'));
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');await mkdir(out,{recursive:true});
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href),browser=await chromium.launch({channel:'chrome',headless:true});
const{guideArticles}=await importTypescript('src/content/guides.ts'),primary=['/','/try-on','/create','/collections','/favorites','/history','/diagnosis','/guide','/contact','/privacy','/terms','/about','/editorial-policy'];
const started=new Date().toISOString(),targetCommit=execFileSync('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),rows=[],issues=[],errors=[],shots=[],statuses=[];
async function screenshot(page,file){
 // Trigger real lazy loading by scrolling, not by changing image attributes.
 await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight*.8){scrollTo(0,y);await new Promise(r=>setTimeout(r,35));}scrollTo(0,0);});
 await page.waitForFunction(()=>Array.from(document.images).every(i=>!i.getClientRects().length||i.complete),null,{timeout:3000}).catch(()=>{});
 await page.screenshot({path:path.join(out,file),fullPage:true,animations:'disabled'});
}
async function scan(page){return page.evaluate(()=>{
 const visible=e=>e.getClientRects().length&&!e.closest('[hidden],[inert]')&&getComputedStyle(e).visibility!=='hidden';
 const clipping=e=>{for(let n=e.parentElement;n&&n!==document.body;n=n.parentElement){if(['auto','scroll','hidden','clip'].includes(getComputedStyle(n).overflowX))return true;}return false;};
 const overflow=[...document.querySelectorAll('main *,header.site-header *')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.width>1&&(r.left<-.5||r.right>innerWidth+.5)&&!clipping(e);}).slice(0,10).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.trim().slice(0,70)}));
 const targets=[...document.querySelectorAll('button:not(:disabled),a.button,.mobile-site-nav a,.header-cta')].filter(visible).map(e=>({name:e.getAttribute('aria-label')??e.textContent.trim(),r:e.getBoundingClientRect()})).filter(x=>x.r.width<24||x.r.height<24).slice(0,12).map(x=>({name:x.name,width:x.r.width,height:x.r.height}));
 const rgb=s=>{const v=s.match(/[\d.]+/g)?.map(Number);return v?.length>=3?[v[0],v[1],v[2],v[3]??1]:null;},over=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])),lum=c=>c.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 const contrast=[];for(const e of document.querySelectorAll('main *,header.site-header *,nav.mobile-site-nav *')){
  if(!visible(e)||e.closest('button:disabled,fieldset:disabled')||!Array.from(e.childNodes).some(n=>n.nodeType===3&&n.textContent.trim()))continue;
  const s=getComputedStyle(e),r=e.getBoundingClientRect();if(r.width===0||r.height===0)continue;
  let bg=[255,255,255],uncertain=false,opacity=1;const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);
  for(const n of chain){const st=getComputedStyle(n);if(st.backgroundImage!=='none')uncertain=true;const c=rgb(st.backgroundColor);if(c)bg=over(c,bg);opacity*=Number(st.opacity);}
  if(uncertain||opacity<.99)continue;const fg=rgb(s.color);if(!fg)continue;const a=lum(over(fg,bg)),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),large=parseFloat(s.fontSize)>=24||parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700,required=large?3:4.5;
  if(ratio+.02<required)contrast.push({text:e.textContent.trim().slice(0,90),cls:e.className,color:s.color,bg:bg.map(Math.round),ratio:Math.round(ratio*100)/100,required});
 }
 return{width:innerWidth,height:innerHeight,rootOverflow:document.documentElement.scrollWidth>innerWidth,h1:document.querySelectorAll('h1').length,overflow,smallTargets:targets,contrast:contrast.slice(0,30),brokenImages:[...document.images].filter(i=>i.complete&&i.src&&i.naturalWidth===0).map(i=>i.getAttribute('src')),unlabelled:[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(visible).filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')).map(e=>e.outerHTML.slice(0,120))};
 });}
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1}),page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 const urls=[...primary,...guideArticles.map(a=>'/guide/'+a.slug)];for(const route of urls){const r=await context.request.get(base+route);statuses.push({route,status:r.status()});assert.equal(r.status(),200,route);}
 const notFound=await context.request.get(base+'/qa-missing-route');assert.equal(notFound.status(),404);statuses.push({route:'/qa-missing-route',status:404});
 for(const route of primary){await page.goto(base+route,{waitUntil:'networkidle'});
  for(const [width,height]of[[320,568],[375,667],[390,844],[430,932],[768,1024],[1024,768],[1440,900],[844,390]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(60);const row={route,...await scan(page)};rows.push(row);
   for(const key of['rootOverflow','overflow','smallTargets','contrast','brokenImages','unlabelled'])if(Array.isArray(row[key])?row[key].length:row[key])issues.push({severity:key==='rootOverflow'||key==='overflow'?'P1':'P2',route,width,kind:key,details:row[key]});
   if(row.h1!==1)issues.push({severity:'P2',route,width,kind:'h1',details:row.h1});
   if([320,390,1440].includes(width)&&['/','/try-on','/create','/collections','/guide','/contact','/diagnosis'].includes(route)){
    const file=`${route==='/'?'home':route.slice(1)}-${width}.png`;await screenshot(page,file);shots.push(file);
   }
  }
 }
 await page.goto(base+'/',{waitUntil:'networkidle'});
 const sceneLinks=await page.locator('.chip-links a').evaluateAll(links=>links.map(a=>({text:a.textContent,href:a.getAttribute('href')})));
 if(args.includes('--strict'))for(const link of sceneLinks){assert.match(link.href,/^\/guide\/[a-z-]+$/);await page.goto(base+link.href,{waitUntil:'networkidle'});assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('.article-page').count(),1);}
 // Deliberately new user, no fixture seeded into storage and no preselected art.
 const beginner=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await beginner.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));await p.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 await p.goto(base+'/',{waitUntil:'networkidle'});await p.locator('.hero-actions').getByRole('link',{name:'自分の手で試す',exact:true}).click();await p.getByRole('button',{name:'サンプル写真で試す',exact:true}).click();await p.getByRole('button',{name:'デザインエディターを開く',exact:true}).click();
 const ed=p.locator('.workshop-editor');await ed.getByLabel('デザイン名',{exact:true}).fill('QA 初めてのネイル');await ed.getByRole('button',{name:'質感・デザインを探す（19種類）',exact:true}).click();const panel=p.locator('.nail-style-panel');await panel.locator('.nail-style-grid button').filter({hasText:'シアー'}).first().click();
 const board=await panel.locator('.nail-style-grid').evaluate(grid=>{const cards=[...grid.querySelectorAll('button')],c=document.createElement('canvas');c.width=600;c.height=Math.ceil(cards.length/5)*150;const x=c.getContext('2d');x.fillStyle='#fcfaf8';x.fillRect(0,0,c.width,c.height);x.font='12px sans-serif';x.fillStyle='#241d20';const hashes=[];cards.forEach((b,i)=>{const image=b.querySelector('canvas');x.drawImage(image,i%5*120+12,Math.floor(i/5)*150,96,128);x.fillText(b.textContent.trim(),i%5*120+4,Math.floor(i/5)*150+144);let h=2166136261;for(const v of image.getContext('2d').getImageData(0,0,image.width,image.height).data)h=Math.imul(h^v,16777619);hashes.push(h>>>0);});return{png:c.toDataURL('image/png').split(',')[1],hashes};});await writeFile(path.join(out,'finishes.png'),Buffer.from(board.png,'base64'));delete board.png;
 await ed.getByRole('button',{name:'質感・デザインを探す（19種類）',exact:true}).click();await ed.getByRole('button',{name:'拡大して絵を描く',exact:true}).click();const paint=p.locator('.nail-paint-editor');await paint.getByRole('button',{name:'画面を広く使う',exact:true}).click();await paint.getByRole('button',{name:'素材',exact:true}).click();await paint.getByRole('button',{name:'基本図形：正円を配置',exact:true}).click();
 await p.locator('.paint-canvas').evaluate(c=>c.focus({preventScroll:true}));await p.keyboard.press('Enter');await paint.getByRole('button',{name:'制作データを保存',exact:true}).click();await paint.getByRole('button',{name:'通常表示に戻る',exact:true}).click();await ed.getByRole('button',{name:'このデザインで試着',exact:true}).click();
 await p.screenshot({path:path.join(out,'beginner-photo.png'),fullPage:true,animations:'disabled'});const storageState=await beginner.storageState();await beginner.close();const returning=await browser.newContext({storageState,viewport:{width:390,height:844}}),q=await returning.newPage();await q.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());await q.goto(base+'/collections',{waitUntil:'networkidle'});await q.getByRole('link',{name:'再編集',exact:true}).click();await q.locator('.workshop-editor').waitFor();assert.equal(await q.getByLabel('デザイン名',{exact:true}).inputValue(),'QA 初めてのネイル');const restored=await q.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.workshop-library.v1')).entries.find(e=>e.document.name==='QA 初めてのネイル').document);assert.equal(restored.schema,4);assert.equal(restored.fingers[0].surface.kind,'sheer');assert.equal(restored.fingers[0].layers.length,1);
 await q.screenshot({path:path.join(out,'returning-editor.png'),fullPage:true,animations:'disabled'});
 const report={purpose:'independent UI/UX/visual pass; computed-text contrast candidates exclude gradients/disabled controls, not a certified accessibility audit',targetCommit,started,ended:new Date().toISOString(),statuses,rows,issues,errors,shots,sceneLinks,beginner:{freshVisit:true,sampleTryOn:true,sheer:true,editableCircle:true,saved:true,closedContext:true,restored:true},finishes:board,unexecuted:['physical iPhone/Android','real OS keyboard/browser chrome','actual ads/GA delivery','assistive-technology screen reader user test']};await writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pages:statuses.length,layouts:rows.length,issues:issues.length,pageErrors:errors.length,beginner:report.beginner}));assert.deepEqual(errors,[]);if(args.includes('--strict'))assert.deepEqual(issues,[]);
}catch(error){await writeFile(path.join(out,'failure.json'),JSON.stringify({targetCommit,started,ended:new Date().toISOString(),rows,issues,errors,error:String(error)},null,2));throw error;}finally{await browser.close();}
