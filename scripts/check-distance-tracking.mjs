import assert from 'node:assert/strict';
import { importTypescript } from './lib/import-typescript.mjs';
const {buildNailsFromLandmarks}=await importTypescript('src/lib/nailGeometry.ts');
const {NailTrackStabilizer}=await importTypescript('src/lib/trackingQuality.ts');
const {handReference}=await importTypescript('src/lib/handReference.ts');
const {refineNailsFromPixels}=await importTypescript('src/lib/nailImageRefinement.ts');
const {nailCanvasGeometry}=await importTypescript('src/lib/nailPoseMetrics.ts');
const {NailFrameRefiner}=await importTypescript('src/lib/nailFrameRefiner.ts');
const {applyCalibration,calibrateNail}=await importTypescript('src/lib/nailCalibration.ts');

const hand=[
  [.5,.88],[.4,.72],[.32,.63],[.24,.55],[.17,.48],
  [.4,.62],[.39,.45],[.39,.33],[.39,.24],
  [.49,.59],[.49,.4],[.49,.28],[.49,.18],
  [.58,.62],[.59,.45],[.6,.33],[.61,.24],
  [.67,.67],[.69,.52],[.71,.43],[.73,.36],
].map(([x,y],index)=>({x,y,z:-index*.001}));
const aspect=4/3;
const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
function transformed(scale,rotation=0,dx=0,dy=0){
  const cosine=Math.cos(rotation),sine=Math.sin(rotation);
  return hand.map(point=>{
    const x=(point.x-.5)*aspect*scale,y=(point.y-.5)*scale;
    return {...point,x:.5+(x*cosine-y*sine)/aspect+dx,y:.5+x*sine+y*cosine+dy,z:point.z*scale};
  });
}
const standard=buildNailsFromLandmarks(hand,false,aspect);
for(const scale of [.35,.7,1.4,2.5,3.2]){
  const poses=buildNailsFromLandmarks(transformed(scale),false,aspect);
  for(let finger=0;finger<5;finger++){
    near(poses[finger].width,standard[finger].width*scale);
    near(poses[finger].height,standard[finger].height*scale);
    near(poses[finger].x,50+(standard[finger].x-50)*scale);
    near(poses[finger].y,50+(standard[finger].y-50)*scale);
  }
}
for(const mode of ['short','standard','long']){
  const poses=buildNailsFromLandmarks(hand,false,aspect,mode);
  poses.forEach((pose,index)=>{near(pose.x,standard[index].x);near(pose.y,standard[index].y);near(pose.width,standard[index].width);});
  if(mode==='long') assert.ok(poses[0].height>standard[0].height*1.4);
  const correction={side:.2,along:.35,width:1.1,height:1.2,rotation:7};
  poses.forEach((pose,index)=>{
    const adjusted=applyCalibration(pose,correction,aspect);
    const original=applyCalibration(standard[index],correction,aspect);
    near(adjusted.x,original.x);near(adjusted.y,original.y);
    const recovered=calibrateNail(pose,adjusted,aspect);
    near(recovered.along,correction.along);
  });
}
for(const portraitAspect of [9/16,1,16/9]){
  const tracker=new NailTrackStabilizer();
  const far=buildNailsFromLandmarks(hand,false,portraitAspect);
  tracker.update(far,0,undefined,handReference(hand,false,portraitAspect));
  const closer=hand.map(point=>({...point,x:.5+(point.x-.5)*1.8+.04,y:.5+(point.y-.5)*1.8-.03,z:point.z*1.8}));
  const target=buildNailsFromLandmarks(closer,false,portraitAspect);
  const actual=tracker.update(target,50,undefined,handReference(closer,false,portraitAspect));
  actual.forEach((nail,index)=>{near(nail.width,far[index].width*1.8);near(nail.height,far[index].height*1.8);near(nail.x,target[index].x);near(nail.y,target[index].y);});
}
assert.equal(handReference(hand.slice(0,20),false,aspect),undefined);
assert.equal(handReference(hand,false,Infinity),undefined);
// Stabilisation must still suppress finger-local jitter when the palm is fixed.
const jitterTracker=new NailTrackStabilizer();
let rawJitter=0,filteredJitter=0;
for(let frame=0;frame<60;frame++){
  const pose=standard.map((nail,index)=>({...nail,x:nail.x+(index===2?(frame%2? .08:-.08):0)}));
  const output=jitterTracker.update(pose,frame*50,undefined,handReference(hand,false,aspect));
  if(frame>10){rawJitter+=(pose[2].x-standard[2].x)**2;filteredJitter+=(output[2].x-standard[2].x)**2;}
}
assert.ok(filteredJitter<rawJitter*.6,'palm-relative filtering no longer damps stationary finger jitter');

// Tests work in source ZIPs without Git history. An optional baseline snapshot
// supports before/after development reports; otherwise compare screen filtering.
const baselineIndex=process.argv.indexOf('--baseline-tracker');
const OldTracker=baselineIndex<0?NailTrackStabilizer:(await importTypescript(process.argv[baselineIndex+1])).NailTrackStabilizer;
const measurements=[];
for(const mirrored of [false,true]){
  const current=new NailTrackStabilizer(),previous=new OldTracker();
  let beforeCenter=0,afterCenter=0,beforeSize=0,afterSize=0,samples=0;
  for(let frame=0;frame<60;frame++){
    const scale=.55+frame/59*1.15,rotation=Math.sin(frame*.06)*.25;
    const landmarks=transformed(scale,rotation,Math.sin(frame*.12)*.12,Math.cos(frame*.09)*.09);
    const target=buildNailsFromLandmarks(landmarks,mirrored,aspect);
    const reference=handReference(landmarks,mirrored,aspect);
    const before=previous.update(target,frame*50);
    const after=current.update(target,frame*50,undefined,reference);
    for(let finger=0;finger<5;finger++){
      const expected=nailCanvasGeometry(target[finger],640,480);
      for(const [result,isAfter] of [[before,false],[after,true]]){
        const pose=nailCanvasGeometry(result[finger],640,480);
        const center=Math.hypot(pose.center.x-expected.center.x,pose.center.y-expected.center.y);
        const size=(Math.abs(result[finger].width/target[finger].width-1)+Math.abs(result[finger].height/target[finger].height-1))/2;
        if(isAfter){afterCenter+=center;afterSize+=size;}else{beforeCenter+=center;beforeSize+=size;}
      }
      samples++;
    }
  }
  assert.ok(afterCenter/samples<.001,'shared hand motion still lags the reference');
  assert.ok(afterSize/samples<.0001,'zoom is still damped as independent screen sizes');
  measurements.push({mirrored,beforeCenterPx:beforeCenter/samples,afterCenterPx:afterCenter/samples,beforeSizeRelativeError:beforeSize/samples,afterSizeRelativeError:afterSize/samples});
}
console.log(`Synthetic ideal-landmark motion, not camera accuracy (${baselineIndex<0?'screen-filter control':'previous tracker baseline'}):`,JSON.stringify(measurements));

// Small and large nails must have the same percentage-size response.
const small=new NailTrackStabilizer(),large=new NailTrackStabilizer();
const smallPose=Array.from({length:5},()=>({x:50,y:50,width:1,height:2,rotation:0}));
const largePose=smallPose.map(nail=>({...nail,width:6,height:12}));
small.update(smallPose,0);large.update(largePose,0);
const a=small.update(smallPose.map(nail=>({...nail,width:1.3,height:2.6})),50);
const b=large.update(largePose.map(nail=>({...nail,width:7.8,height:15.6})),50);
near(a[0].width/1,b[0].width/6);

// Known long nail: a 70px free-edge-to-root extent with an initial 22px prior.
const width=160,height=220,data=new Uint8ClampedArray(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const foreground=((x-80)/11)**2+((y-110)/35)**2<=1;
  data.set(foreground?[230,224,237,255]:[185,130,108,255],(y*width+x)*4);
}
const pixels={width,height,data};
const prior={x:50,y:145/height*100,width:14/width*100,height:22/height*100,rotation:0};
const fit=refineNailsFromPixels(pixels,[prior],false);
assert.equal(fit.diagnostics[0].accepted,true,'a clear long nail was rejected');
const metric=nailCanvasGeometry(fit.nails[0],width,height);
assert.ok(Math.abs(metric.root.y-145)<4&&Math.abs(metric.tip.y-75)<4,'long nail cuticle or free edge is misplaced');
assert.ok(Math.abs(metric.height-70)<5&&Math.abs(metric.width-22)<4);
console.log('Known synthetic long-nail geometry, not real-image accuracy:',JSON.stringify({
  initialHeightPx:22,fittedHeightPx:metric.height,targetHeightPx:70,
  fittedWidthPx:metric.width,targetWidthPx:22,
  rootErrorPx:Math.hypot(metric.root.x-80,metric.root.y-145),tipErrorPx:Math.hypot(metric.tip.x-80,metric.tip.y-75),
}));
const longFive=refineNailsFromPixels(pixels,Array.from({length:5},()=>prior),false);
assert.ok(longFive.diagnostics.every(item=>item.accepted),'a thumb/pinky long-boundary search failed');
const mirroredFit=refineNailsFromPixels(pixels,[{...prior,x:100-prior.x}],true);
near(mirroredFit.nails[0].height,fit.nails[0].height);
assert.ok(Math.abs(mirroredFit.nails[0].x-(100-fit.nails[0].x))<1);
let reads=0;
globalThis.document={createElement:()=>({width,height,getContext:()=>({drawImage(){},getImageData(){reads++;return pixels;}})})};
const refiner=new NailFrameRefiner();
const first=refiner.refine({},width,height,Array.from({length:5},()=>prior),false,0);
const next=refiner.refine({},width,height,Array.from({length:5},()=>({...prior,x:prior.x+1,width:prior.width*1.05,height:prior.height*1.05})),false,50);
assert.equal(reads,1);
near(next.nails[0].height,first.nails[0].height*1.05);
console.log('distance-tracking: all fingers/close-far/translation/rotation/mirror, percentage size response, long root/tip and cache scale passed');
