import assert from 'node:assert/strict';import{writeFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import path from'node:path';import{importTypescript}from'./lib/import-typescript.mjs';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
if(!opt('--playwright-module')||!opt('--output'))throw Error('--playwright-module and --output required');
const base=opt('--base-url')??'http://localhost:4210',origin=new URL(base).origin;
if(!['localhost','127.0.0.1','nail-fit-studio.vercel.app'].includes(new URL(base).hostname))throw Error('Only local QA or the public official site is allowed');
const expectBrand=args.includes('--expect-brand'),local=['localhost','127.0.0.1'].includes(new URL(base).hostname);
const {guideArticles}=await importTypescript('src/content/guides.ts');
const {chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true});const rows=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 await page.goto(base,{waitUntil:'networkidle'});
 const routes=['/','/try-on','/diagnosis','/guide','/about','/contact','/privacy','/terms','/editorial-policy','/favorites','/history',...guideArticles.map(a=>'/guide/'+a.slug)];
 for(const route of routes){
  const response=await page.request.get(origin+route,{headers:{'User-Agent':'Googlebot'}});assert.equal(response.status(),200,route);
  assert.ok(!/noindex/i.test(response.headers()['x-robots-tag']??''),route);
  const row=await page.evaluate(html=>{const d=new DOMParser().parseFromString(html,'text/html');const meta=n=>d.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content;
   const links=[...d.querySelectorAll('a[href]')].map(a=>({href:a.getAttribute('href'),label:a.getAttribute('aria-label')??a.textContent.trim()}));
   return{title:d.title,description:meta('description'),robots:meta('robots'),canonical:d.querySelector('link[rel="canonical"]')?.getAttribute('href'),h1:[...d.querySelectorAll('h1')].map(n=>n.textContent),lead:d.querySelector('.home-hero .lead')?.textContent,eyebrow:d.querySelector('.home-hero .eyebrow')?.textContent,links,jsonLd:[...d.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>{const j=JSON.parse(s.textContent);return j['@graph']??[j];})};},await response.text());
  assert.equal(row.h1.length,1,route);assert.equal(new URL(row.canonical).href,new URL(route,'https://nail-fit-studio.vercel.app').href,route);
  assert.equal(/noindex/.test(row.robots??''),['/favorites','/history'].includes(route));
  row.path=route;row.internalTargets=[...new Set(row.links.filter(l=>l.href?.startsWith('/')).map(l=>new URL(l.href,origin).pathname))];
  assert.ok(row.internalTargets.includes('/'),'no home return link '+route);
  if(route==='/'){
   const w=row.jsonLd.filter(n=>n['@type']==='WebSite');assert.equal(w.length,1);assert.equal(w[0].name,'Nail Fit Studio');assert.equal(new URL(w[0].url).href,'https://nail-fit-studio.vercel.app/');
   row.website=w[0];row.brandedHomeLinks=row.links.filter(l=>l.href==='/'&&l.label==='Nail Fit Studio ホーム').length;
   if(expectBrand){assert.ok(row.lead.startsWith('Nail Fit Studioは、'));assert.ok(row.eyebrow.includes('Nail Fit Studio')&&row.eyebrow.includes('無料ネイル試着'));assert.equal(row.brandedHomeLinks,2);assert.equal(w[0]['@id'],'https://nail-fit-studio.vercel.app/#website');assert.equal(w[0].alternateName,undefined);}
  }
  rows.push(row);
 }
 const graph=new Map(rows.map(r=>[r.path,r.internalTargets]));const seen=new Set(),queue=['/'];for(let i=0;i<queue.length;i++){const u=queue[i];if(seen.has(u))continue;seen.add(u);for(const link of graph.get(u)??[])if(graph.has(link)&&!seen.has(link))queue.push(link);}
 const indexable=rows.filter(r=>!['/favorites','/history'].includes(r.path));assert.ok(indexable.every(r=>seen.has(r.path)),'indexable orphan route');
 assert.ok(['/try-on','/diagnosis','/guide'].every(r=>graph.get('/').includes(r)));assert.equal(rows.find(r=>r.path==='/guide').internalTargets.filter(r=>r.startsWith('/guide/')).length,30);
 for(const r of rows.filter(r=>r.path.startsWith('/guide/')))assert.ok(r.internalTargets.includes('/try-on')&&r.internalTargets.includes('/diagnosis'));
 if(local&&expectBrand){await page.goto(base+'/guide/how-to-choose-nail-shape',{waitUntil:'networkidle'});await page.locator('.site-footer').getByRole('link',{name:'Nail Fit Studio ホーム',exact:true}).click();await page.waitForURL(origin+'/');assert.ok((await page.locator('.home-hero .lead').innerText()).startsWith('Nail Fit Studioは、'));}
 assert.deepEqual(errors,[]);
 const report={checkedAt:new Date().toISOString(),kind:local?'local production HTML/navigation QA':'read-only public HTTP/SSR audit, Googlebot User-Agent only; not verified Google crawler visits or ranking',base,expectBrand,indexablePages:indexable.length,guidePages:30,indexableReachableFromHome:indexable.every(r=>seen.has(r.path)),errors,rows};
 await writeFile(opt('--output'),JSON.stringify(report,null,2));console.log(JSON.stringify({pages:rows.length,indexable:indexable.length,guides:30,orphanPages:0,expectBrand,errors}));
}finally{await browser.close();}
