import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {importTypescript} from './lib/import-typescript.mjs';
const site=await importTypescript('src/lib/site.ts');
const {pageMetadata,socialMetadata,socialImage}=await importTypescript('src/lib/seo.ts');
const {guideArticles}=await importTypescript('src/content/guides.ts');
const HOME='無料ネイル試着｜写真・カメラで似合うネイルをお試し - Nail Fit Studio';
const DESCRIPTION='ネイルをする前に、自分の手で似合うデザインをチェック。Nail Fit Studioは、写真やカメラでネイルの色・形・長さを無料で試せるサイトです。アプリのインストール不要で、スマホから気軽にお試しできます。';
assert.equal(site.HOME_TITLE,HOME);assert.equal(site.SITE_DESCRIPTION,DESCRIPTION);
assert.equal(site.SHARE_TITLE,'無料でネイル試着！自分の手で似合うデザインを探そう｜Nail Fit Studio');
assert.equal(site.SHARE_DESCRIPTION,'写真やカメラでネイルをお試し。色・形・長さを自由に変えて、自分に似合うデザインを見つけよう。無料・アプリ不要。');
assert.equal(socialMetadata.openGraph.title,site.SHARE_TITLE);assert.equal(socialMetadata.twitter.description,site.SHARE_DESCRIPTION);
assert.equal(pageMetadata(HOME,DESCRIPTION,'/').title.absolute,HOME);
const about=pageMetadata('Nail Fit Studioとは｜無料ネイル試着サイト','説明','/about');
assert.equal(about.title.absolute,'Nail Fit Studioとは｜無料ネイル試着サイト','brand duplicated by template');
for(const route of ['/','/try-on','/diagnosis','/guide','/about','/favorites','/history']){
 const metadata=pageMetadata('タイトル','説明',route,!['/favorites','/history'].includes(route));
 assert.equal(metadata.alternates.canonical,route);assert.equal(metadata.openGraph.url,route);
 assert.equal(metadata.openGraph.locale,'ja_JP');assert.equal(metadata.openGraph.images[0].url,socialImage.url);
 assert.equal(metadata.twitter.card,'summary_large_image');
 assert.equal(metadata.robots?.index,['/favorites','/history'].includes(route)?false:undefined);
}
const moduleUrl=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const aliases={'@/lib/site':moduleUrl(`export const SITE_URL=${JSON.stringify(site.SITE_URL)};export const SEO_UPDATED_AT=${JSON.stringify(site.SEO_UPDATED_AT)};`),
 '@/content/guides':moduleUrl(`export const guideArticles=${JSON.stringify(guideArticles)};`)};
const {default:sitemap}=await importTypescript('app/sitemap.ts',aliases);
const entries=sitemap(),urls=entries.map(e=>e.url);
assert.equal(urls.length,guideArticles.length+9);assert.equal(new Set(urls).size,urls.length);
assert.ok(urls.includes(`${site.SITE_URL}/try-on`));
assert.ok(urls.every(url=>url.startsWith(site.SITE_URL)&&!url.includes('?')&&!/\/(favorites|history)(?:\/|$)/.test(url)));
assert.equal(entries[0].lastModified.toISOString().slice(0,10),site.SEO_UPDATED_AT);
for(const article of guideArticles){
 const entry=entries.find(e=>e.url.endsWith(`/guide/${article.slug}`));
 assert.equal(entry.lastModified.toISOString().slice(0,10),article.updatedAt,'unchanged article date was fabricated');
}
const {default:robots}=await importTypescript('app/robots.ts',aliases);
assert.equal(robots().rules.allow,'/');assert.equal(robots().rules.disallow,undefined,'crawler cannot read personal-page noindex');
assert.equal(robots().sitemap,`${site.SITE_URL}/sitemap.xml`);
for(const [file,width,height]of [['public'+socialImage.url,1200,630],['public/icons/favicon-48.png',48,48],['public/icons/apple-touch-icon.png',180,180],['public/icons/icon-192.png',192,192],['public/icons/icon-512.png',512,512]]){
 const png=await readFile(file);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
}
const home=await readFile('app/page.tsx','utf8'),layout=await readFile('app/layout.tsx','utf8');
assert.ok(home.includes('pageMetadata(HOME_TITLE, SITE_DESCRIPTION, "/")'));
assert.ok(home.includes('"@type": "WebSite", name: SITE_NAME, url: SITE_URL, description: SITE_DESCRIPTION, inLanguage: "ja"'));
assert.ok(layout.includes('<html lang="ja">'));assert.ok(layout.includes('template: `%s｜${SITE_NAME}`'));
for(const label of ['VIRTUAL NAIL TRY-ON','HOW IT WORKS','POPULAR DESIGNS','WHY NAIL FIT STUDIO','NAIL GUIDE','FAQ'])assert.ok(!home.includes(`>${label}`));
assert.ok(home.includes('アプリのインストールは不要'));
console.log('seo: exact Japanese search/share copy, absolute brand deduplication, route canonical/OG URLs, 30 guide dates, personal noindex crawlability, static image dimensions and visible labels passed');
