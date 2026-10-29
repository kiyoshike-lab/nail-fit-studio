// Optional local browser QA. No Playwright application dependency, no external
// upload, no claim that viewport emulation is a real iPhone/Android camera test.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
for(const flag of ['--back-image','--palm-image','--playwright-module'])if(!option(flag))throw Error(`${flag} is required`);
const baseUrl=option('--base-url')??'http://127.0.0.1:4191';
if(!['localhost','127.0.0.1'].includes(new URL(baseUrl).hostname))throw Error('Only a local QA server may be used');
const {chromium}=await import(pathToFileURL(path.resolve(option('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route(/googlesyndication|googletagmanager|google-analytics/,route=>route.abort());
 await page.goto(`${baseUrl}/try-on`,{waitUntil:'networkidle'});
 if(args.includes('--production')){
  assert.equal(await page.locator('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]').count(),1);
  assert.equal(await page.locator('meta[name="google-adsense-account"]').getAttribute('content'),'ca-pub-6994120027205290');
  assert.equal(await page.locator('script[src*="googletagmanager.com/gtag/js?id=G-CLEJWK7RF3"]').count(),1);
  assert.ok((await page.locator('#google-analytics').textContent()).includes("gtag('config','G-CLEJWK7RF3'"));
  assert.equal((await (await page.request.get(`${baseUrl}/ads.txt`)).text()).trim(),'google.com, pub-6994120027205290, DIRECT, f08c47fec0942fa0');
 }
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.setViewportSize({width:390,height:844});
 const pixels=()=>page.locator('.nail-canvas').evaluate(c=>{
  const rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let painted=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i]>0)painted++;return painted;
 });
 async function upload(file){
  const previous=await page.locator('img[alt="手の写真"]').getAttribute('src');
  await page.locator('input[type=file]').first().setInputFiles(path.resolve(file));
  await page.waitForFunction(old=>document.querySelector('img[alt="手の写真"]')?.getAttribute('src')!==old,previous);
  await page.waitForFunction(()=>!document.querySelector('.loading-badge')&&document.querySelector('.preview-header')?.textContent.includes('自動配置'),null,{timeout:60000});
  await page.waitForTimeout(500);
 }
 await upload(option('--back-image'));
 if(args.includes('--production')){
  assert.equal(await page.getByRole('checkbox',{name:'爪位置デバッグ'}).count(),0);
  assert.equal(await page.locator('canvas[aria-label="開発用の爪位置比較"]').count(),0);
 }
 const backPixels=await pixels();assert.ok(backPixels>0,'reference dorsal photo has no nail rendering');
 // Native pointer Before/After is checked on desktop. The mobile sticky preview
 // can overlap this legacy control during automated scrolling; do not bypass
 // that with force-click and misreport it as a successful mobile tap test.
 await page.setViewportSize({width:1280,height:844});
 const before=page.getByRole('button',{name:'ネイルあり / 長押しでBefore',exact:true});
 await before.evaluate(el=>window.scrollBy({top:el.getBoundingClientRect().top-650,behavior:'instant'}));await before.click();
 await page.waitForTimeout(400);assert.equal(await pixels(),0,'Before still painted nails');
 await page.getByRole('button',{name:'Before表示中',exact:true}).click();
 await page.waitForTimeout(400);assert.ok(await pixels()>0,'After did not recover');
 const hold=page.getByRole('button',{name:'ネイルあり / 長押しでBefore',exact:true});
 await hold.hover();await page.mouse.down();await page.waitForTimeout(300);
 assert.equal(await pixels(),0,'long press did not show Before');
 await page.mouse.up();await page.waitForTimeout(400);
 assert.ok(await pixels()>0,'long press click toggled back to Before on release');
 await page.setViewportSize({width:390,height:844});
 // GPU/CPU can differ on this overlaid curled-palm reference. Visible proposals
 // must be partial/current-boundary-clipped, not old dorsal poses. This is not GT.
 await upload(option('--palm-image'));
 const palmNails=await page.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.nails.v1')));
 assert.ok(palmNails.every(n=>n.visibility===0||(n.visibilityState==='partial'&&n.clipContour?.length>=3)),JSON.stringify({palmNails,status:await page.locator('.preview-header').textContent()}));
 const palmPixels=await pixels();
 await page.locator('.setting-block').evaluateAll(elements=>elements.forEach(el=>el.open=true));
 const x=page.getByLabel('横位置',{exact:true});await x.focus();await x.press('ArrowRight');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.nails.v1')??'[]').filter(n=>n.visibilityState==='manual').length===1);
 await page.waitForTimeout(400);assert.ok(await pixels()>0,'explicit photo manual placement could not override uncertainty');
 await page.locator('.bottom-nav').getByRole('button',{name:'自動補正',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.nails.v1')??'[]').every(n=>n.visibilityState!=='manual'));
 const refitted=await page.evaluate(()=>JSON.parse(localStorage.getItem('nail-fit-studio-next.nails.v1')));
 assert.ok(refitted.every(n=>n.visibility===0||(n.visibilityState==='partial'&&n.clipContour?.length>=3)),'auto fit failed to restore visibility gating');
 await page.evaluate(()=>{navigator.canShare=()=>false;});
 const download=page.waitForEvent('download');
 await page.locator('.bottom-nav').getByRole('button',{name:'保存',exact:true}).click();
 assert.equal((await download).suggestedFilename(),'nail-fit-studio.png');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d');x.fillStyle='#ddd';x.fillRect(0,0,320,240);return c.toDataURL().split(',')[1];});
 await page.locator('input[type=file]').first().setInputFiles({name:'blank.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.waitForFunction(()=>document.querySelector('.preview-header')?.textContent.includes('手を認識できませんでした'),null,{timeout:60000});
 await page.waitForTimeout(300);assert.equal(await pixels(),0,'no-hand photo reused saved manual nails');
 await page.setViewportSize({width:1280,height:844});
 await page.getByRole('button',{name:'サンプル写真で試す',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.preview-header')?.textContent.includes('サンプルの手に仮配置'));
 await page.waitForTimeout(500);assert.ok(await pixels()>0,'explicit illustration demo lost its sample poses');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({kind:'headless Chrome static-image UI regression, NOT physical camera or labelled nail accuracy',backPixels,palmPixels,palmStates:palmNails.map(n=>n.visibilityState),errors,
  passed:['320/390/1280 overflow','dorsal rendering','Before/After tap and hold (desktop pointer)','new palm hides saved poses','explicit manual photo adjustment','auto-fit restores gating','PNG download','no-hand photo stays hidden','illustration demo preserved']},null,2));
}finally{await browser.close();}
