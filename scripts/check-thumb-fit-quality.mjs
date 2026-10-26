import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {importTypescript} from './lib/import-typescript.mjs';
const {buildNailsFromLandmarks}=await importTypescript('src/lib/nailGeometry.ts');
const {refineNailsFromPixels}=await importTypescript('src/lib/nailImageRefinement.ts');
const {NailFrameRefiner}=await importTypescript('src/lib/nailFrameRefiner.ts');
const {nailCanvasGeometry}=await importTypescript('src/lib/nailPoseMetrics.ts');
const {TrackingPerformance}=await importTypescript('src/lib/trackingQuality.ts');
const fixture=JSON.parse(await readFile('scripts/fixtures/thumb-fit-geometry.json','utf8'));
const current=buildNailsFromLandmarks(fixture.landmarks,false,fixture.aspect);
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
assert.deepEqual(current.slice(1),fixture.before.slice(1),'thumb changes affected another finger');
assert.ok(current[0].width<fixture.before[0].width*.85,'thumb is still over-wide');
near(current[0].height,fixture.before[0].height);
assert.deepEqual(buildNailsFromLandmarks(fixture.folded.landmarks,false,fixture.aspect),fixture.folded.before,'folded thumb was forced into the narrower side-view prior');
const mirrored=buildNailsFromLandmarks(fixture.landmarks,true,fixture.aspect);
near(mirrored[0].x,100-current[0].x);near(mirrored[0].y,current[0].y);
const closer=fixture.landmarks.map(p=>({...p,x:.5+(p.x-.5)*1.6,y:.5+(p.y-.5)*1.6}));
const zoom=buildNailsFromLandmarks(closer,false,fixture.aspect);
near(zoom[0].width,current[0].width*1.6);near(zoom[0].height,current[0].height*1.6);

function pixels(kind){
 const width=160,height=200,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const dx=x-80;
  const inside=kind==='round'?((dx/12)**2+((y-95)/25)**2<=1):
   kind==='square'?(Math.abs(dx)<=12&&y>=70&&y<=117)||(y>117&&y<=120&&(dx/12)**2+((y-117)/3)**2<=1):false;
  data.set(inside?[230,224,237,255]:[185,130,108,255],(y*width+x)*4);
 }
 return {width,height,data};
}
const prior={x:50,y:60,width:18/160*100,height:35/200*100,rotation:0};
for(const kind of ['round','square']){
 const result=refineNailsFromPixels(pixels(kind),Array.from({length:5},()=>prior),false);
 assert.ok(result.diagnostics.every(d=>d.accepted),`${kind} nail boundaries were rejected`);
 const pose=nailCanvasGeometry(result.nails[0],160,200);
 assert.ok(Math.abs(pose.root.y-120)<4&&Math.abs(pose.tip.y-70)<4,`${kind} root or tip shifted`);
 assert.ok(Math.abs(pose.width-24)<4&&Math.abs(pose.height-50)<4,`${kind} independent dimensions were not fitted`);
 assert.ok(result.diagnostics[0].supportThresholds>=2);
}
const unclear=refineNailsFromPixels(pixels('blank'),[prior],false);
assert.equal(unclear.diagnostics[0].accepted,false);
assert.deepEqual(unclear.nails[0],prior);
assert.ok(unclear.diagnostics[0].rejected.area>0,'failed image fits lack a diagnosable gate');

let reads=0;
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},getImageData(_x,_y,width,height){reads++;return {width,height,data:new Uint8ClampedArray(width*height*4)};}})})};
const refiner=new NailFrameRefiner(),five=Array.from({length:5},()=>prior);
refiner.refine({},160,200,five,false,0);
refiner.refine({},160,200,five.map(n=>({...n,width:n.width*1.05})),false,30);
assert.equal(reads,1,'small coherent change cannot reuse its relative correction');
refiner.refine({},160,200,five.map(n=>({...n,height:n.height*1.4})),false,50);
assert.equal(reads,2,'height-only change reused stale image geometry');
refiner.refine({},160,200,five.map(n=>({...n,height:n.height*1.4})),true,60);
assert.equal(reads,3,'mirror change reused pixels from the other coordinate system');
refiner.refine({},200,200,five.map(n=>({...n,height:n.height*1.4})),true,70);
assert.equal(reads,4,'aspect change reused stale image correction');
refiner.dispose();

const performance=new TrackingPerformance();performance.frame(1,0);performance.recordInference(15,{landmarkMs:8,refinementMs:6,stabilizationMs:1});
const timing=performance.snapshot(2001);near(timing.landmarkMs,8);near(timing.refinementMs,6);near(timing.stabilizationMs,1);
// No detected hand is missing evidence, not zero error / perfect accuracy.
const directory=await mkdtemp(path.join(tmpdir(),'nail-fit-empty-evaluation-'));
const input=path.join(directory,'input.json');
try{
 await writeFile(input,JSON.stringify({source:'synthetic empty fixture',license:'test',cases:[]}));
 const report=JSON.parse(execFileSync(process.execPath,['scripts/evaluate-nail-alignment.mjs','--input',input],{encoding:'utf8'}));
 assert.equal(report.after.meanCenterErrorPx,null);assert.equal(report.after.meanEllipseIoU,null);
}finally{await unlink(input);await rmdir(directory);}
console.log('thumb-fit-quality: independent thumb prior, other four unchanged, mirror/scale, round/square boundaries, cache length/mirror/aspect invalidation, phase timing and absent-evidence metrics passed');
