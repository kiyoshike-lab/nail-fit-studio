import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{importTypescript}from'./lib/import-typescript.mjs';
const site=await importTypescript('src/lib/site.ts');const{buildWebsiteJsonLd}=await importTypescript('src/lib/seo.ts');
assert.equal(site.SITE_NAME,'Nail Fit Studio');
for(const url of[site.SITE_URL,site.SITE_URL+'/', 'https://example.test/']){
 const graph=buildWebsiteJsonLd(url);assert.equal(graph['@context'],'https://schema.org');assert.equal(graph['@graph'].length,2);
 const website=graph['@graph'].filter(n=>n['@type']==='WebSite'),organization=graph['@graph'].filter(n=>n['@type']==='Organization');
 assert.equal(website.length,1);assert.equal(organization.length,1);const home=new URL('/',url).href;
 assert.equal(website[0].name,site.SITE_NAME);assert.equal(website[0].description,site.SITE_DESCRIPTION);assert.equal(website[0].url,home);assert.equal(organization[0].url,home);
 assert.equal(website[0]['@id'],home+'#website');assert.equal(website[0].publisher['@id'],organization[0]['@id']);
 assert.ok(!graph['@graph'].some(n=>'alternateName'in n||'sameAs'in n),'unverified alternate names or social accounts');
 assert.ok(!/AggregateRating|ratingValue|reviewCount|SearchAction/.test(JSON.stringify(graph)),'unverified features/ratings added');
}
const home=await readFile('app/page.tsx','utf8'),footer=await readFile('src/components/SiteFooter.tsx','utf8');
assert.equal((home.match(/type="application\/ld\+json"/g)??[]).length,1);assert.ok(home.includes('{SITE_NAME}｜無料ネイル試着'));
assert.ok(home.includes('{SITE_NAME}は、自分の手の写真やカメラで'));assert.ok(home.includes('アプリのインストールは不要'));
assert.ok(footer.includes('<Link href="/" aria-label={`${SITE_NAME} ホーム`}>'));
console.log('brand-seo: one home identity graph, canonical root, linked publisher, visible formal brand, existing Japanese copy, no invented aliases/social/rating/search features passed');
