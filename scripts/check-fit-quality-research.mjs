import assert from 'node:assert/strict';
import{readFile,readdir}from'node:fs/promises';import{createHash}from'node:crypto';import{importTypescript}from'./lib/import-typescript.mjs';
const protocol=JSON.parse(await readFile('scripts/fixtures/fit-quality-protocol-20261030.json','utf8'));
const a=protocol.splits.development,b=protocol.splits.candidateHoldout;
assert.equal(a.length,14);assert.equal(b.length,14);assert.equal(new Set([...a,...b]).size,28,'evaluation split leaked source images');
assert.equal(protocol.independence.previouslyUntouchedExternalTest,false,'historical development data must not be advertised as independent');
for(const [file,sha]of Object.entries(protocol.frozenCandidateHashes))assert.equal(createHash('sha256').update((await readFile(file,'utf8')).replaceAll('\r\n','\n')).digest('hex'),sha,'candidate tuned after holdout was evaluated');
async function inspect(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${e.name}`;if(e.isDirectory())await inspect(p);else if(/\.[jt]sx?$/.test(e.name))assert.ok(!/directional-(?:fit|chroma)-candidate/.test(await readFile(p,'utf8')),`unvalidated candidate leaked into production: ${p}`);}}
await inspect('src');await inspect('app');
const{directionalBoundary}=await importTypescript('scripts/lib/directional-fit-candidate.ts');
const blank={width:320,height:320,data:new Uint8ClampedArray(320*320*4).fill(180)};
const prior=Object.freeze({x:50,y:60,width:8,height:12,rotation:0});
for(const chroma of[false,true])for(const mirrored of[false,true])assert.equal(directionalBoundary(blank,prior,mirrored,chroma),undefined,'uniform skin/background invented an edge');
assert.equal(directionalBoundary(blank,{...prior,width:.1,height:.1},false,false),undefined,'insufficient pixels should fall back');
console.log('fit-research safety: frozen hypotheses/hashes, disjoint source-image split, historical-data warning, no production imports, blank/tiny fallback passed');
