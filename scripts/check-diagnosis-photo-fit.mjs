import assert from 'node:assert/strict';
import {importTypescript} from './lib/import-typescript.mjs';

const {recommendNails,photoComparison,diagnosisTryOnUrl}=await importTypescript('src/lib/nailDiagnosis.ts');
const {designFromText}=await importTypescript('src/lib/designSuggestion.ts');
const {studioQueryPatch}=await importTypescript('src/lib/studioSettings.ts');
const {readDiagnosisResult,STORAGE_KEYS}=await importTypescript('src/lib/storage.ts');
const {withPhotoContourFit,clearPhotoContourFit}=await importTypescript('src/lib/photoContourFit.ts');

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
console.log('diagnosis/photo-fit: scenarios, recommendation URL allowlist, legacy reads, text rules, safe full masks, partial/hidden protection and fallback passed');
