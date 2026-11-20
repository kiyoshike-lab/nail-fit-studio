import assert from 'node:assert/strict';
import {importTypescript} from './lib/import-typescript.mjs';

const {recommendNails,photoComparison,diagnosisTryOnUrl,diagnosisQuestions,differentDiagnosisPattern}=await importTypescript('src/lib/nailDiagnosis.ts');
const {designFromText}=await importTypescript('src/lib/designSuggestion.ts');
const {applyTextDesign}=await importTypescript('src/lib/applyTextDesign.ts');
const {defaultDesign}=await importTypescript('src/lib/defaults.ts');
const {createDocument,parseDocument}=await importTypescript('src/lib/workshopData.ts');
const {studioQueryPatch}=await importTypescript('src/lib/studioSettings.ts');
const {readDiagnosisResult,STORAGE_KEYS}=await importTypescript('src/lib/storage.ts');
const {withPhotoContourFit,clearPhotoContourFit,choosePhotoFit}=await importTypescript('src/lib/photoContourFit.ts');

const quiet=recommendNails(['mode','cool','office','bold','long','square','restricted','warm-tone']);
assert.equal(quiet.length,'short');assert.equal(quiet.shape,'squoval');assert.equal(quiet.color,'#cbb7db','selected shade family must win');
assert.equal(quiet.finish,'sheer');assert.match(quiet.description,/仕事・学校/);
const jelly=recommendNails(['korean','auto','daily','medium','medium','auto','free','neutral-tone']);
assert.equal(jelly.material,'jelly');assert.equal(jelly.pattern,'solid');
const occasion=recommendNails(['elegant','dark','ceremony','bold','long','almond','free','cool-tone']);
assert.equal(occasion.length,'long');assert.equal(occasion.finish,'sparkle');assert.equal(occasion.pattern,'french');
assert.notEqual(occasion.color,occasion.tipColor,'French recommendation needs a distinct tip');
assert.equal(photoComparison(occasion,{view:'palm',tone:'cool',measuredNails:4,nailRatio:1.8}),null);
assert.equal(photoComparison(occasion,{view:'back',tone:'neutral',measuredNails:3,nailRatio:1.8}).shape,'oval');
assert.equal(photoComparison(occasion,{view:'back',tone:'warm',measuredNails:0}),null);
assert.equal(photoComparison(occasion,{view:'back',tone:'cool',measuredNails:3,nailRatio:1.8}).color,occasion.color);
assert.notEqual(differentDiagnosisPattern(occasion).pattern,occasion.pattern);
const variantCounts=new Map();
let answerCount=0;
function verifyChoices(path=[]){
 const q=diagnosisQuestions[path.length];
 if(q){for(const [,option] of q.options)verifyChoices([...path,option]);return;}
 const r=recommendNails(path),quiet=path[2]==='office'||path[6]==='restricted';
 assert.ok(/^#[a-f0-9]{6}$/.test(r.color));
 if(r.pattern!=='solid')assert.notEqual(r.color,r.tipColor);
 if(quiet){assert.equal(r.finish,'sheer');assert.equal(r.length,'short');}
 if(r.finish==='pearl')assert.equal(r.material,'shimmer');
 if(r.finish==='sparkle')assert.equal(r.material,'glitter');
 const key=[r.color,r.pattern,r.finish,r.shape,r.length].join('/');
 variantCounts.set(key,(variantCounts.get(key)||0)+1);
 answerCount++;
}
verifyChoices();
assert.equal(answerCount,97200);
assert.ok(Math.max(...variantCounts.values())/answerCount<.15,'one option dominates the combinations');
const url=new URL(diagnosisTryOnUrl(jelly),'https://example.test');
assert.equal(url.searchParams.get('photoFit'),'1');
const patch=studioQueryPatch(url.searchParams);
assert.equal(patch.finish,jelly.finish);assert.equal(patch.material,jelly.material);assert.equal(patch.tipColor,jelly.tipColor);
assert.deepEqual(studioQueryPatch(new URLSearchParams('recommendation=1&finish=unknown&tipColor=url%28x%29&material=x')),{});
assert.deepEqual(studioQueryPatch(new URLSearchParams('finish=pearl&material=jelly')),{});

const old={...quiet};delete old.finish;delete old.material;delete old.tipColor;
let stored=JSON.stringify(old),writes=0;
globalThis.window={localStorage:{getItem:key=>key===STORAGE_KEYS.diagnosis?stored:null,setItem:()=>writes++}};
assert.deepEqual(readDiagnosisResult(),old);
stored=JSON.stringify(jelly);assert.deepEqual(readDiagnosisResult(),jelly);
stored=JSON.stringify({...old,finish:'unknown',material:'bad',tipColor:'red'});assert.deepEqual(readDiagnosisResult(),old);assert.equal(writes,0);
delete globalThis.window;

const french=designFromText('黒フレンチにシルバーラメ').patch;
assert.equal(french.pattern,'french');assert.equal(french.tipColor,'#201c24');assert.notEqual(french.color,french.tipColor);
assert.equal(french.material,'glitter');assert.ok(Object.hasOwn(french,'textureUrl'));assert.equal(french.textureUrl,undefined);
assert.equal(designFromText('ピンクのちゅるん系').patch.material,'jelly');
for(const text of ['', 'どうしよう', 'ラメなし', 'a'.repeat(160)+'黒']) assert.equal(designFromText(text),null);
for(const text of ['赤と青','フレンチのグラデーション','親指と小指だけハート','右手の薬指だけマグネット','薬指だけ']) assert.equal(designFromText(text),null);
assert.equal(designFromText('ピンクベージュのちゅるんネイル').patch.color,'#ce9c9c');
assert.equal(designFromText('韓国風の上品なネイル').patch.color,'#dfbba9');
assert.deepEqual(designFromText('白グラデーションに小さいストーン').finger,{index:3,base:{},accent:{kind:'crystal',size:.12}});
const heart=designFromText('親指だけハートを付けたい');
const magnet=designFromText('薬指だけマグネットネイル');
const original=createDocument(defaultDesign);
const onlyHeart=applyTextDesign(heart,defaultDesign,original).artwork;
assert.ok(parseDocument(onlyHeart));
assert.deepEqual(onlyHeart.fingers.map(f=>f.parts.length),[1,0,0,0,0]);
assert.deepEqual(onlyHeart.fingers.map(f=>f.base),original.fingers.map(f=>f.base));
const magnetic=applyTextDesign(magnet,defaultDesign,onlyHeart).artwork;
assert.deepEqual(magnetic.fingers.map(f=>f.surface?.kind??null),[null,null,null,'magnet',null]);
assert.deepEqual(magnetic.fingers[0],onlyHeart.fingers[0]);
assert.ok(parseDocument(magnetic));
assert.equal(applyTextDesign(heart,defaultDesign,onlyHeart).artwork.fingers[0].parts.length,1,'repeated application must not duplicate an accent');
assert.equal(designFromText('全体はシンプルで1本だけ派手にしたい').finger.index,3);

const nail={x:40,y:55,width:8,height:15,rotation:0,visibility:1,visibilityState:'visible'};
const contour=[{x:36,y:55},{x:44,y:55},{x:44,y:40},{x:36,y:40}];
const fit={accepted:true,confidence:.94,reason:'color-boundary',contourStatus:'closed',supportThresholds:3,contour};
assert.deepEqual(withPhotoContourFit([nail],[fit],640,480),[{...nail,clipContour:contour,clipHoles:[]}]);
const hidden={...nail,visibility:0,visibilityState:'hidden'},partial={...nail,visibilityState:'partial',clipContour:contour};
assert.deepEqual(withPhotoContourFit([nail,hidden,partial],[fit,fit,fit],640,480).slice(1),[hidden,partial]);
const switched=clearPhotoContourFit(withPhotoContourFit([nail,hidden,partial],[fit,fit,fit],640,480));
assert.equal(switched[0].clipContour,undefined);assert.strictEqual(switched[1],hidden);assert.strictEqual(switched[2],partial);
for(const rejected of [{...fit,confidence:.7},{...fit,reason:'chromatic-visible-core'},{...fit,supportThresholds:2},
 {...fit,contour:contour.map(p=>({...p,x:p.x+30}))},{...fit,contourHoles:[contour]}]){
 assert.strictEqual(withPhotoContourFit([nail],[rejected],640,480)[0],nail);
}
assert.strictEqual(withPhotoContourFit([nail],[fit],30,30)[0],nail);
const snapshot={standard:[nail,hidden,partial],clipped:withPhotoContourFit([nail,hidden,partial],[fit,fit,fit],640,480)};
const edited={...nail,x:48,visibilityState:'manual'};
assert.strictEqual(choosePhotoFit(snapshot,true,[edited,hidden,partial])[0],edited);
assert.strictEqual(choosePhotoFit(snapshot,true,[edited,hidden,partial])[1],hidden);
assert.strictEqual(choosePhotoFit(snapshot,false,[edited,hidden,partial])[2],partial);
console.log(JSON.stringify({suite:'diagnosis/photo-fit (includes legacy and per-finger text edits)',answerCount,unique:variantCounts.size,mostCommon:Math.max(...variantCounts.values())}));
