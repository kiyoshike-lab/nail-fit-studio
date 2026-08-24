import { readFileSync } from "node:fs";
const forbidden=["app/try-on/page.tsx","app/diagnosis/page.tsx","app/favorites/page.tsx","app/history/page.tsx"];
for(const file of forbidden){const source=readFileSync(new URL(`../${file}`,import.meta.url),"utf8");if(source.includes("AdSlot"))throw new Error(`AdSlot must not appear in ${file}`)}
console.log("ad-placement-check: operation pages contain no AdSlot");
