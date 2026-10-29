// Optional production-HTML / desktop and mobile-width QA. This does not submit
// URLs to Google or prove real search rankings, LINE/X caches or phone behavior.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {importTypescript} from './lib/import-typescript.mjs';
const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
if(!option('--playwright-module'))throw Error('--playwright-module <QA Playwright/index.mjs> is required');
const base=option('--base-url')??'http://127.0.0.1:4193';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Only local QA servers may be tested');
const {SITE_URL,SITE_NAME,HOME_TITLE,SITE_DESCRIPTION,SHARE_TITLE,SHARE_DESCRIPTION,SEO_UPDATED_AT}=await importTypescript('src/lib/site.ts');
const {socialImage}=await importTypescript('src/lib/seo.ts');
const {guideArticles}=await importTypescript('src/content/guides.ts');
const {chromium}=await import(pathToFileURL(path.resolve(option('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true});
const normalize=url=>new URL(url).href;
const rows=[],errors=[],layouts=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.route(/googlesyndication|googletagmanager|google-analytics/,route=>route.abort());
 await page.goto(`${base}/`,{waitUntil:'networkidle'});
 const routes=['/','/try-on','/diagnosis','/guide','/about','/contact','/editorial-policy','/privacy','/terms','/favorites','/history',...guideArticles.map(a=>`/guide/${a.slug}`)];
 for(const route of routes){
  const response=await page.request.get(`${base}${route}`,{headers:{'User-Agent':'Googlebot'}});
  assert.equal(response.status(),200,route);
  const head=await page.evaluate(html=>{
   const doc=new DOMParser().parseFromString(html,'text/html'),meta=name=>doc.head.querySelector(`meta[name="${name}"],meta[property="${name}"]`)?.content;
   return{lang:doc.documentElement.lang,titles:[...doc.head.querySelectorAll('title')].map(t=>t.textContent),
    description:meta('description'),descriptionCount:doc.head.querySelectorAll('meta[name="description"]').length,
    canonicals:[...doc.head.querySelectorAll('link[rel="canonical"]')].map(link=>link.href),
    ogTitle:meta('og:title'),ogDescription:meta('og:description'),ogImage:meta('og:image'),ogAlt:meta('og:image:alt'),ogUrl:meta('og:url'),ogLocale:meta('og:locale'),
    twitter:meta('twitter:card'),twitterTitle:meta('twitter:title'),twitterDescription:meta('twitter:description'),twitterImage:meta('twitter:image'),robots:meta('robots'),
    jsonLd:[...doc.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent))};
  },await response.text());
  assert.equal(head.lang,'ja',route);assert.equal(head.titles.length,1,route);assert.equal(head.descriptionCount,1,route);
  assert.equal((head.titles[0].match(/Nail Fit Studio/g)??[]).length,1,route);assert.ok(!head.titles[0].includes('2.0'),route);
  assert.match(head.description,/[ぁ-んァ-ヶ一-龠]/,route);assert.equal(head.canonicals.length,1,route);
  const canonical=new URL(route,SITE_URL).href;
  assert.equal(normalize(head.canonicals[0]),canonical,route);assert.equal(normalize(head.ogUrl),canonical,route);
  assert.equal(head.ogLocale,'ja_JP');assert.equal(head.twitter,'summary_large_image');
  assert.equal(head.ogImage,new URL(socialImage.url,SITE_URL).href,route);assert.equal(head.twitterImage,head.ogImage,route);assert.equal(head.ogAlt,socialImage.alt);
  const article=guideArticles.find(a=>`/guide/${a.slug}`===route);
  if(article){
   assert.equal(head.titles[0],`${article.title}｜${SITE_NAME}`);assert.equal(head.description,article.description);
   assert.equal(head.ogTitle,article.title);assert.equal(head.twitterTitle,article.title);
   const schema=head.jsonLd.find(j=>j['@type']==='Article');assert.ok(schema,route);assert.equal(schema.headline,article.title);assert.equal(schema.dateModified,article.updatedAt);
   assert.equal(schema.mainEntityOfPage,canonical);assert.ok(head.jsonLd.some(j=>j['@type']==='BreadcrumbList'));
  }else{
   assert.equal(head.ogTitle,SHARE_TITLE,route);assert.equal(head.twitterTitle,SHARE_TITLE,route);
   assert.equal(head.ogDescription,SHARE_DESCRIPTION,route);assert.equal(head.twitterDescription,SHARE_DESCRIPTION,route);
  }
  if(route==='/'){
   assert.equal(head.titles[0],HOME_TITLE);assert.equal(head.description,SITE_DESCRIPTION);
   const schemas=head.jsonLd.flatMap(j=>j['@graph']??[j]);const website=schemas.filter(j=>j['@type']==='WebSite');
   assert.equal(website.length,1);assert.equal(website[0].name,SITE_NAME);assert.equal(website[0].description,SITE_DESCRIPTION);assert.equal(website[0].inLanguage,'ja');assert.equal(normalize(website[0].url),normalize(SITE_URL));
  }
  assert.ok(!JSON.stringify(head.jsonLd).match(/AggregateRating|ratingValue|reviewCount|award/),route);
  assert.equal(/noindex/.test(head.robots??''),['/favorites','/history'].includes(route),route);
  rows.push({route,title:head.titles[0],description:head.description,canonical:head.canonicals[0],ogUrl:head.ogUrl,robots:head.robots??'index allowed (no noindex)',jsonLdTypes:head.jsonLd.flatMap(j=>j['@graph']??[j]).map(j=>j['@type'])});
 }
 assert.equal(new Set(rows.map(r=>r.title)).size,rows.length,'duplicate page titles');
 const xml=await (await page.request.get(`${base}/sitemap.xml`)).text();
 const sitemap=await page.evaluate(text=>{const doc=new DOMParser().parseFromString(text,'application/xml');return{errors:doc.querySelectorAll('parsererror').length,entries:[...doc.querySelectorAll('url')].map(u=>({url:u.querySelector('loc')?.textContent,date:u.querySelector('lastmod')?.textContent}))};},xml);
 assert.equal(sitemap.errors,0);assert.equal(sitemap.entries.length,guideArticles.length+9);
 assert.equal(new Set(sitemap.entries.map(e=>e.url)).size,sitemap.entries.length);
 assert.ok(sitemap.entries.every(e=>!e.url.includes('/favorites')&&!e.url.includes('/history')&&e.url.startsWith(SITE_URL)));
 assert.equal(sitemap.entries.find(e=>normalize(e.url)===normalize(SITE_URL)).date.slice(0,10),SEO_UPDATED_AT);
 const robots=await (await page.request.get(`${base}/robots.txt`)).text();assert.match(robots,/Allow: \/\s/);assert.ok(!robots.includes('Disallow: /favorites'));assert.ok(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`));
 const notFound=await page.request.get(`${base}/__seo_missing_page__`);assert.equal(notFound.status(),404);assert.match(await notFound.text(),/noindex/);
 const manifest=await (await page.request.get(`${base}/manifest.webmanifest`)).json();assert.equal(manifest.name,SITE_NAME);assert.equal(manifest.description,SITE_DESCRIPTION);assert.equal(manifest.lang,'ja');
 for(const url of [socialImage.url,'/icons/favicon-48.png','/icons/apple-touch-icon.png','/icons/icon-192.png','/icons/icon-512.png','/icons/nail-fit-studio.svg']){
  const response=await page.request.get(`${base}${url}`);assert.equal(response.status(),200,url);assert.match(response.headers()['content-type'],/^image\//,url);
 }
 assert.equal(await page.locator('link[rel="icon"][sizes="48x48"]').count(),1);
 for(const route of ['/','/try-on','/diagnosis','/guide','/about']){
  await page.goto(`${base}${route}`,{waitUntil:'networkidle'});
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(100);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} overflow at ${width}`);
   const clipped=await page.locator('h1').evaluate(h=>{const r=h.getBoundingClientRect();return r.left<0||r.right>innerWidth;});assert.equal(clipped,false,`${route} heading clipped at ${width}`);
   layouts.push({route,width,overflow:false,headingClipped:false});
   if(route==='/'&&[390,1280].includes(width)&&option('--screenshot-prefix'))await page.screenshot({path:`${option('--screenshot-prefix')}-${width}.png`});
  }
 }
 await page.goto(`${base}/`,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});
 const lead=await page.locator('.home-hero .lead').innerText();assert.ok(lead.includes('無料')&&lead.includes('写真やカメラ')&&lead.includes('インストールは不要'));
 assert.ok(await page.locator('.home-hero .lead').evaluate(el=>el.getBoundingClientRect().bottom<innerHeight),'three service facts are below the first screen');
 await page.locator('.home-hero a[href="/try-on"]').click();await page.waitForURL('**/try-on');
 // App Router can update the URL before the lazy client studio has mounted.
 await page.locator('input[type=file]').first().waitFor({state:'attached'});
 assert.equal(await page.locator('input[type=file]').count()>0,true);assert.equal(await page.locator('.bottom-nav').getByRole('button',{name:'カメラ',exact:true}).count(),1);
 await page.locator('script[src*="adsbygoogle.js"]').waitFor({state:'attached'});
 await page.locator('script[src*="gtag/js?id=G-CLEJWK7RF3"]').waitFor({state:'attached'});
 assert.equal(await page.locator('script[src*="adsbygoogle.js"]').count(),1);assert.equal(await page.locator('script[src*="gtag/js?id=G-CLEJWK7RF3"]').count(),1);
 assert.equal((await (await page.request.get(`${base}/ads.txt`)).text()).trim(),'google.com, pub-6994120027205290, DIRECT, f08c47fec0942fa0');
 assert.deepEqual(errors,[]);
 const report={kind:'local production head + headless Chrome viewport QA; not real SERP, social-service cache or physical phone validation',rows,layouts,sitemapEntries:sitemap.entries.length,robots,notFoundStatus:404,errors,
  passed:['unique Japanese titles/descriptions','canonical/OG URLs','Japanese OGP/Twitter with PNG','WebSite/Article/Breadcrumb JSON-LD parse and semantics','no fabricated rating schema','personal noindex','sitemap/robots/404','favicon/manifest','3 facts above fold','home to try-on link','AdSense/GA4/ads.txt retained']};
 if(option('--output'))await writeFile(option('--output'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({routes:rows.length,layouts:layouts.length,sitemapEntries:report.sitemapEntries,errors,passed:report.passed},null,2));
}finally{await browser.close();}
