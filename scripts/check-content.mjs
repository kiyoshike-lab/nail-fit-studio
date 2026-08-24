import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../src/content/guides.ts",import.meta.url),"utf8");
const slugs=[...source.matchAll(/article\("([a-z0-9-]+)"/g)].map((match)=>match[1]);
const unique=new Set(slugs);
if(slugs.length<20)throw new Error(`Guide count is ${slugs.length}; at least 20 are required.`);
if(slugs.length!==unique.size)throw new Error("Duplicate guide slugs found.");
for(const required of["title","description","category","publishedAt","updatedAt"]){if(!source.includes(required))throw new Error(`Guide field missing: ${required}`)}
console.log(`content-check: ${slugs.length} guide articles, unique slugs OK`);
