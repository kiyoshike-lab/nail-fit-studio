import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const origin='https://nail-fit-studio.vercel.app';
const results=[];
const decode=s=>s?.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#x27;',"'");
const attr=(tag,name)=>decode(new RegExp(`\\b${name}="([^"]*)"`,'i').exec(tag)?.[1]);
const tags=(html,name)=>[...html.matchAll(new RegExp(`<${name}\\b[^>]*>`,'gi'))].map(m=>m[0]);
const meta=(html,name)=>attr(tags(html,'meta').find(t=>attr(t,'name')===name||attr(t,'property')===name)??'', 'content');
async function get(route){
 const response=await fetch(new URL(route,origin),{headers:{'User-Agent':'NailFitStudio-readonly-SEO-audit'},signal:AbortSignal.timeout(30000)});
 const bytes=Buffer.from(await response.arrayBuffer());const text=bytes.toString('utf8');
 const row={path:route,status:response.status,url:response.url,redirected:response.redirected,contentType:response.headers.get('content-type'),xRobots:response.headers.get('x-robots-tag'),bytes:bytes.length};
 results.push(row);return{row,text,bytes};
}
const robots=await get('/robots.txt');assert.equal(robots.row.status,200);assert.match(robots.text,/Allow: \/(?:\r?\n|$)/);assert.ok(!/Disallow: \/(?:\r?\n|$)/.test(robots.text));assert.ok(robots.text.includes(`${origin}/sitemap.xml`));
const sitemap=await get('/sitemap.xml');assert.equal(sitemap.row.status,200);
const locations=[...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>decode(m[1]));
assert.equal(new Set(locations).size,locations.length);assert.equal(locations.filter(u=>new URL(u).pathname.startsWith('/guide/')).length,30);
assert.ok(!locations.some(u=>/\/(favorites|history)$/.test(u)));
for(const url of locations){
 assert.equal(new URL(url).origin,origin);const route=new URL(url).pathname;const{row,text}=await get(route);
 assert.equal(row.status,200,route);assert.equal(row.redirected,false,route);assert.ok(!/noindex/i.test(row.xRobots??''),route);
 assert.ok(/<html[^>]*lang="ja"/.test(text),route);
 const titles=[...text.matchAll(/<title>(.*?)<\/title>/gs)].map(m=>decode(m[1]));assert.equal(titles.length,1,route);row.title=titles[0];
 row.description=meta(text,'description');row.robots=meta(text,'robots');assert.ok(!/noindex/i.test(row.robots??''),route);assert.match(row.description,/[ぁ-んァ-ヶ一-龠]/);
 const canonical=tags(text,'link').filter(t=>attr(t,'rel')==='canonical').map(t=>attr(t,'href'));assert.equal(canonical.length,1,route);assert.equal(new URL(canonical[0]).href,new URL(route,origin).href,route);row.canonical=canonical[0];
 row.ogTitle=meta(text,'og:title');row.ogImage=meta(text,'og:image');assert.match(row.ogTitle,/[ぁ-んァ-ヶ一-龠]/);assert.ok(row.ogImage?.startsWith(origin));
 row.structuredData=[...text.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map(m=>JSON.parse(m[1]));
 assert.ok(!row.title.includes('2.0'),route);
 if(route==='/'){
 assert.equal(row.title,'無料ネイル試着｜写真・カメラで似合うネイルをお試し - Nail Fit Studio');
 assert.ok(text.includes('無料')&&text.includes('アプリ')&&text.includes('カメラ'),'SSR content missing');
 assert.ok(row.structuredData.flatMap(s=>s['@graph']??[s]).some(s=>s['@type']==='WebSite'),'WebSite JSON-LD missing');
 row.internalLinks=tags(text,'a').map(t=>attr(t,'href')).filter(u=>u?.startsWith('/'));assert.ok(row.internalLinks.includes('/try-on')&&row.internalLinks.includes('/guide'));
 }
}
for(const route of ['/favorites','/history']){const{row,text}=await get(route);assert.equal(row.status,200);assert.match(meta(text,'robots'),/noindex/);}
const missing=await get('/__seo_audit_missing__');assert.equal(missing.row.status,404);assert.match(meta(missing.text,'robots'),/noindex/);
const assetPaths=['/mediapipe/hand_landmarker.task','/mediapipe/vision_wasm_internal.js','/mediapipe/vision_wasm_internal.wasm','/mediapipe/vision_wasm_module_internal.js','/mediapipe/vision_wasm_module_internal.wasm','/mediapipe/vision_wasm_nosimd_internal.js','/mediapipe/vision_wasm_nosimd_internal.wasm','/icons/favicon-48.png',new URL(results.find(r=>r.path==='/').ogImage).pathname];
for(const path of assetPaths){const{row,bytes}=await get(path);assert.equal(row.status,200,path);row.sha256=createHash('sha256').update(bytes).digest('hex');if(path.endsWith('.wasm'))assert.match(row.contentType,/application\/wasm/);}
const ads=await get('/ads.txt');assert.equal(ads.text.trim(),'google.com, pub-6994120027205290, DIRECT, f08c47fec0942fa0');
const bot=await fetch(origin,{headers:{'User-Agent':'Googlebot'},signal:AbortSignal.timeout(30000)});assert.equal(bot.status,200);
const report={checkedAt:new Date().toISOString(),origin,kind:'anonymous public HTTP/SSR audit; NOT Search Console, actual Google crawler or ranking proof',pages:locations.length,guides:30,googlebotUserAgentStatus:bot.status,results};
if(opt('--output'))await writeFile(opt('--output'),JSON.stringify(report,null,2));
console.log(JSON.stringify({pages:locations.length,guides:30,requests:results.length,googlebotUserAgentStatus:bot.status,allPassed:true}));
