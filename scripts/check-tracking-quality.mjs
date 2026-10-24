import assert from "node:assert/strict";
import { importTypescript } from "./lib/import-typescript.mjs";

const { OneEuroFilter, NailTrackStabilizer, TrackingPerformance, trackingOpacity } = await importTypescript("src/lib/trackingQuality.ts");
const { buildNailsFromLandmarks } = await importTypescript("src/lib/nailGeometry.ts");
const { applyCalibration, calibrateNail, sanitizeCalibration } = await importTypescript("src/lib/nailCalibration.ts");
const { containRect, pointInSource } = await importTypescript("src/lib/previewGeometry.ts");

const hand = [
  [.5,.88], [.4,.72],[.32,.63],[.24,.55],[.17,.48],
  [.4,.62],[.39,.45],[.39,.33],[.39,.24],
  [.49,.59],[.49,.4],[.49,.28],[.49,.18],
  [.58,.62],[.59,.45],[.6,.33],[.61,.24],
  [.67,.67],[.69,.52],[.71,.43],[.73,.36],
].map(([x,y]) => ({x,y,z:0}));
const nails = buildNailsFromLandmarks(hand, false, 4/3);
const moved = (dx,dy=0) => nails.map((nail) => ({...nail,x:nail.x+dx,y:nail.y+dy}));
const near = (a,b,tolerance=1e-8) => assert.ok(Math.abs(a-b)<tolerance, `${a} != ${b}`);

// Static geometry: roots stay on the distal segment, and mirrored input has
// identical sizes/centres reflected once (including ring/pinky side offsets).
const mirrored = buildNailsFromLandmarks(hand, true, 4/3);
for(let finger=0;finger<5;finger++) {
  near(mirrored[finger].x,100-nails[finger].x);
  near(mirrored[finger].y,nails[finger].y);
  near(mirrored[finger].width,nails[finger].width);
}
assert.deepEqual(buildNailsFromLandmarks(hand.map((point,index) => index === 8 ? {...point,x:NaN} : point),false),[]);
const depthHand = hand.map((point,index) => index===12 ? {...point,z:-.12} : point);
const depthNail = buildNailsFromLandmarks(depthHand,false,4/3)[2];
assert.ok(depthNail.height<nails[2].height && depthNail.height>nails[2].height*.7);
const tip = hand[12];
const angle = (depthNail.rotation-90)*Math.PI/180;
assert.ok(Math.hypot(depthNail.x/100+Math.cos(angle)*depthNail.height/100/(4/3)-tip.x,depthNail.y/100+Math.sin(angle)*depthNail.height/100-tip.y)<.006,"foreshortened nail tip detached");
for(const direction of [-1,1]) {
  const bent=hand.map((point,index)=>index===8?{...point,x:point.x+direction*.06,y:point.y+.05,z:-.035}:point);
  const poses=buildNailsFromLandmarks(bent,false,4/3);
  assert.ok(poses.every((pose)=>Object.values(pose).every(Number.isFinite)));
  assert.ok(Math.abs(poses[1].rotation)>20,"bent index finger did not rotate");
}

// Time-series filtering: stale results, frame rate changes, jitter, sudden motion,
// one-frame finger outlier, hand identity debounce, fade and recovery.
const track = new NailTrackStabilizer();
track.update(nails,0,{label:"Left",score:.99});
assert.equal(track.update(moved(10),-1),null,"stale frame was accepted");
const output = track.update(moved(4,2),50);
assert.ok(output[2].x>nails[2].x+2,"coherent movement lags excessively");
const anomalous = moved(4,2);
anomalous[0] = {...anomalous[0],x:anomalous[0].x+30};
const rejected = track.update(anomalous,100);
near(rejected[0].x,output[0].x);
assert.equal(track.update(moved(-12),150,{label:"Right",score:.99}),null);
assert.equal(track.update(moved(-12),200,{label:"Right",score:.99}),null);
near(track.update(moved(-12),250,{label:"Right",score:.99})[2].x,nails[2].x-12);
assert.equal(trackingOpacity(100),1);
assert.ok(trackingOpacity(270)>.49 && trackingOpacity(270)<.51);
assert.equal(trackingOpacity(500),0);
near(track.update(moved(15),1000)[2].x,nails[2].x+15);

function simulate(hz) {
  const filter = new OneEuroFilter({minCutoff:1.5,beta:.35});
  const samples=[];
  for(let frame=0;frame<=hz*3;frame++) {
    const timestamp=frame*1000/hz;
    const noise=Math.sin(timestamp*.057)*.16;
    const target=timestamp<1500?50:50+(timestamp-1500)*.02;
    const value=filter.filter(target+noise,timestamp);
    samples.push({timestamp,target,value,noise});
  }
  const still=samples.filter((sample)=>sample.timestamp>500&&sample.timestamp<1400);
  const rawRms=Math.sqrt(still.reduce((sum,s)=>sum+s.noise*s.noise,0)/still.length);
  const filteredRms=Math.sqrt(still.reduce((sum,s)=>sum+(s.value-s.target)**2,0)/still.length);
  assert.ok(filteredRms<rawRms*.7,"static jitter was not damped");
  const moving=samples.filter((s)=>s.timestamp>2300);
  const meanLag=moving.reduce((sum,s)=>sum+Math.abs(s.target-s.value)/.02,0)/moving.length;
  assert.ok(meanLag<75,"filter-only synthetic lag too high");
  return {hz, rawRms:rawRms.toFixed(4),filteredRms:filteredRms.toFixed(4),syntheticFilterLagMs:meanLag.toFixed(1)};
}
console.log("Synthetic signals (not camera accuracy/FPS):",JSON.stringify([simulate(15),simulate(20),simulate(30)]));

const base=nails[1];
const target={...base,x:base.x+1.5,y:base.y-.7,width:base.width*1.2,height:base.height*.8,rotation:base.rotation+15};
const calibration=calibrateNail(base,target,4/3);
const calibrated=applyCalibration(base,calibration,4/3);
for(const key of ["x","y","width","height","rotation"]) near(calibrated[key],target[key]);
const closer={...base,x:base.x+10,width:base.width*1.5,height:base.height*1.5,rotation:90};
const closerAdjusted=applyCalibration(closer,calibration,4/3);
near(closerAdjusted.width,closer.width*1.2);
near(closerAdjusted.height,closer.height*.8);
assert.ok(sanitizeCalibration([{side:NaN}])[0].side===0);

// A 1080x1920 photo fitted into a short mobile preview must remain aligned;
// gestures on the fitted source use the exact inverse mapping.
for(const [width,height] of [[320,300],[390,350],[1280,720]]) {
  const viewport=containRect(1080,1920,width,height);
  const rootScreen={x:viewport.x+viewport.width*nails[2].x/100,y:viewport.y+viewport.height*nails[2].y/100};
  const mapped=pointInSource(rootScreen.x,rootScreen.y,viewport);
  near(mapped.x,nails[2].x); near(mapped.y,nails[2].y);
}

const metrics = new TrackingPerformance();
for(let i=0;i<12;i++) metrics.recordInference(45);
assert.equal(metrics.budget.maxSide,640);
assert.ok(metrics.budget.intervalMs>=66);
for(let i=0;i<100;i++) metrics.recordInference(8);
assert.equal(metrics.budget.maxSide,960);
assert.equal(metrics.budget.intervalMs,50);
console.log("tracking-quality: static geometry, depth, mirror, video sequences, hand swap, recovery, calibration, mobile contain and adaptive budget passed");
