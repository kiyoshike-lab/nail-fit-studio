import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {importTypescript} from './lib/import-typescript.mjs';
const {estimateHandPose}=await importTypescript('src/lib/handPose.ts');
const {buildNailsFromLandmarks}=await importTypescript('src/lib/nailGeometry.ts');
const {assessNailVisibility,NailVisibilityTracker,withNailVisibility}=await importTypescript('src/lib/nailVisibility.ts');
const f=JSON.parse(await readFile('scripts/fixtures/dorsal-world-disagreement.json','utf8'));
const n=buildNailsFromLandmarks(f.landmarks,false,f.width/f.height);
const blank=n.map(()=>({accepted:false,confidence:0,reason:'no-colour-boundary'}));
const p=estimateHandPose(f.landmarks,f.worldLandmarks,f.handedness,f.width/f.height);
assert.equal(p.view,'back');assert.equal(p.source,'normalized');assert.ok(p.worldAgreement<0);
const assess=(pose=p,nails=n,fits=blank,lm=f.landmarks,mirrored=false)=>assessNailVisibility(pose,lm,nails,fits,f.width,f.height,mirrored);
const count=values=>withNailVisibility(n,values).filter(n=>n.visibility>0).length;
const dorsal=assess();assert.equal(count(dorsal),5,'clear real dorsal fixture lost all nails without a pixel boundary');
assert.equal(count(assess({...p,confidence:.65})),5,'a back classification of 0.65 was rejected by a contradictory 0.72 render threshold');
const moderate=estimateHandPose(f.landmarks,undefined,{...f.handedness,score:.65},f.width/f.height);
assert.equal(moderate.view,'back');assert.equal(count(assess(moderate)),5);
for(const interval of [50,200,600,1000]){
 const tracker=new NailVisibilityTracker();let result;
 for(let t=0;t<=interval*5;t+=interval)result=tracker.update(dorsal,t,p.modelHand);
 assert.equal(count(result),5,`continuous inference at ${interval}ms never became visible`);
}
const unknown=assess({...p,view:'unknown',confidence:0,fingers:[]});
assert.ok(unknown.every(e=>e.state==='uncertain'&&!e.hardHidden));
assert.equal(count(unknown),0,'unknown on first sight is not proof of a dorsal surface');
const tracker=new NailVisibilityTracker();for(let t=0;t<=300;t+=50)tracker.update(dorsal,t,p.modelHand);
assert.equal(count(tracker.update(unknown,350,p.modelHand)),5,'one unknown erased an established dorsal hand');
assert.equal(count(tracker.update(unknown,400,undefined)),5,'temporarily missing handedness erased recent dorsal evidence');
assert.equal(count(tracker.update(unknown,1000,p.modelHand)),0,'uncertainty renewed its own hold indefinitely');
tracker.reset();assert.equal(count(tracker.update(unknown,1100,p.modelHand)),0,'a genuinely lost hand retained previous evidence');
const hidden=dorsal.map(()=>({state:'hidden',confidence:0,hardHidden:true,reason:'palm-test'}));
for(let t=1200;t<=1500;t+=50)tracker.update(dorsal,t,p.modelHand);
assert.equal(count(tracker.update(hidden,1550,p.modelHand)),0,'strong palm evidence retained a dorsal overlay');
for(let t=1600;t<=1900;t+=50)tracker.update(dorsal,t,p.modelHand);
assert.equal(count(tracker.update(dorsal,1950,p.modelHand)),5,'dorsal recovery failed');
const oneUnknown=dorsal.map((e,i)=>i===2?unknown[i]:e);
assert.equal(count(oneUnknown),4,'one uncertain finger removed another finger');
const contour=[{x:40,y:40},{x:50,y:40},{x:50,y:50},{x:40,y:50}];
const side={...p,view:'side',fingers:p.fingers.map((j,i)=>({...j,facing:i===1?.8:-.5}))};
const partialFits=blank.map((e,i)=>i===1?{...e,accepted:true,confidence:.95,contour,supportThresholds:3}:e);
const sideEvidence=assess(side,n,partialFits);
assert.equal(count(sideEvidence),1,'a side view failed to show only the bounded visible finger');
assert.equal(sideEvidence[1].state,'partial');assert.equal(sideEvidence[1].contour,contour);
// Raw horizontal reflection swaps model handedness. Display mirroring must not
// modify pose or the finger IDs. Cover camera-facing choices separately below.
for(const rawMirror of [false,true])for(const displayMirror of [false,true]){
 const lm=rawMirror?f.landmarks.map(l=>({...l,x:1-l.x})):f.landmarks;
 const hand=rawMirror?{...f.handedness,categoryName:f.handedness.categoryName==='Left'?'Right':'Left'}:f.handedness;
 const pose=estimateHandPose(lm,undefined,hand,f.width/f.height);
 const nails=buildNailsFromLandmarks(lm,displayMirror,f.width/f.height);
 assert.equal(pose.view,'back');assert.equal(count(assess(pose,nails,blank,lm,displayMirror)),5);
 const world=rawMirror?f.worldLandmarks.map(l=>({...l,x:-l.x})):f.worldLandmarks;
 const withWorld=estimateHandPose(lm,world,hand,f.width/f.height);
 assert.equal(withWorld.view,'back');assert.equal(count(assess(withWorld,nails,blank,lm,displayMirror)),5);
 const palm=estimateHandPose(lm,undefined,{...hand,categoryName:hand.categoryName==='Left'?'Right':'Left'},f.width/f.height);
 assert.equal(palm.view,'palm');assert.equal(count(assess(palm,nails,blank,lm,displayMirror)),0);
}
const {shouldMirrorCamera}=await importTypescript('src/lib/cameraDevices.ts');
assert.equal(shouldMirrorCamera('USB Webcam',true,'user'),false);
assert.equal(shouldMirrorCamera('front camera',true,'user'),true);
assert.equal(shouldMirrorCamera('',false,'environment','environment'),false);
console.log('vanishing-regression: REAL dorsal landmark fixture (not screenshot accuracy), world disagreement, missing world, 5/5 without boundary, moderate confidence, 50–1000ms cadence, bounded unknown hold, palm suppression, one-finger independence, raw/display mirrors and camera choices passed');
