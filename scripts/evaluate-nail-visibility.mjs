// Offline replay of model results. Input pixels stay local and are never copied
// to this report. This is not a physical-camera, motion or labelled-visibility test.
import {readFile,writeFile} from 'node:fs/promises';
import {importTypescript} from './lib/import-typescript.mjs';
const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
if(!option('--input'))throw Error('--input collected landmarks JSON is required');
const {estimateHandPose}=await importTypescript('src/lib/handPose.ts');
const {buildNailsFromLandmarks}=await importTypescript('src/lib/nailGeometry.ts');
const {refineNailsFromPixels}=await importTypescript('src/lib/nailImageRefinement.ts');
const {assessNailVisibility,withNailVisibility}=await importTypescript('src/lib/nailVisibility.ts');
const data=JSON.parse(await readFile(option('--input'),'utf8'));
const counts={},rejections={},views={},contourStatuses={},rows=[];
let accepted=0,currentContours=0,visible=0,partial=0,total=0;
for(const item of data.cases){
 const {width,height,landmarks,worldLandmarks,handedness}=item;
 const pixels=Uint8ClampedArray.from(Buffer.from(item.pixels,'base64'));
 const start=performance.now();
 const pose=estimateHandPose(landmarks,worldLandmarks,handedness,width/height);
 const coarse=buildNailsFromLandmarks(landmarks,false,width/height);
 const fit=refineNailsFromPixels({data:pixels,width,height},coarse,false);
 const evidence=assessNailVisibility(pose,landmarks,fit.nails,fit.diagnostics,width,height,false);
 const nails=withNailVisibility(fit.nails,evidence);
 views[pose.view]=(views[pose.view]??0)+1;
 for(const [index,value]of evidence.entries()){
  counts[value.reason]=(counts[value.reason]??0)+1;total++;
  if(nails[index].visibility>0){visible++;if(value.state==='partial')partial++;}
 }
 for(const diagnostic of fit.diagnostics){
  if(diagnostic.accepted)accepted++;
  if(diagnostic.contour)currentContours++;
  if(diagnostic.contourStatus)contourStatuses[diagnostic.contourStatus]=(contourStatuses[diagnostic.contourStatus]??0)+1;
  for(const [key,value]of Object.entries(diagnostic.rejected??{}))rejections[key]=(rejections[key]??0)+value;
 }
 rows.push({file:item.file,condition:item.condition,modelHand:pose.modelHand,view:pose.view,source:pose.source,
  confidence:pose.confidence,facing:pose.facing,
  fingers:evidence.map((value,i)=>({state:value.state,reason:value.reason,alpha:nails[i].visibility,
   facing:pose.fingers[i]?.facing,bendDegrees:pose.fingers[i]?.bendDegrees,
   boundaryAccepted:fit.diagnostics[i].accepted,boundaryConfidence:fit.diagnostics[i].confidence,
   support:fit.diagnostics[i].supportThresholds,contour:fit.diagnostics[i].contour?.length??0,contourStatus:fit.diagnostics[i].contourStatus})),
  offlinePostprocessMs:performance.now()-start});
}
const times=rows.map(r=>r.offlinePostprocessMs).sort((a,b)=>a-b);
const report={kind:'unlabelled static-frame replay, NOT hardware/video visibility accuracy',
 source:data.source,license:data.license,inputImages:data.inputImages??data.cases.length,
 detectedFrames:rows.length,undetectedFiles:data.undetectedFiles??[],
 views,totalNailProposals:total,beforeVisibilityGate:total,afterVisibilityGate:visible,partial,
 visibilityCoverage:total?visible/total:null,acceptedImageFits:accepted,orderedCurrentContours:currentContours,
 reasons:counts,candidateRejections:rejections,contourStatuses,
 visibilityAccuracy:null,hiddenNailFalsePaintRate:null,recoveryMs:null,centerErrorPx:null,contourIoU:null,
 timing:{environment:'Node offline postprocess, excludes MediaPipe, decode, camera and rendering; not FPS',
  medianMs:times[Math.floor(times.length/2)]??null,p95Ms:times[Math.min(times.length-1,Math.floor(times.length*.95))]??null},rows};
const json=JSON.stringify(report,null,2)+'\n';
if(option('--output'))await writeFile(option('--output'),json);else process.stdout.write(json);
