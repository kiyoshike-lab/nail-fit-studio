// Compare the exact b2ad626 pure pose/visibility modules exported via git show
// into a LOCAL directory; this optional audit is not a CI dependency on Git history.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {importTypescript} from './lib/import-typescript.mjs';
const args=process.argv.slice(2),option=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
if(!option('--baseline-dir'))throw Error('--baseline-dir must contain baseline-handPose.ts and baseline-nailVisibility.ts from b2ad626');
const {buildNailsFromLandmarks}=await importTypescript('src/lib/nailGeometry.ts');
const current={...(await importTypescript('src/lib/handPose.ts')),...(await importTypescript('src/lib/nailVisibility.ts'))};
const previous={...(await importTypescript(path.join(option('--baseline-dir'),'baseline-handPose.ts'))),...(await importTypescript(path.join(option('--baseline-dir'),'baseline-nailVisibility.ts')))};
const f=JSON.parse(await readFile('scripts/fixtures/dorsal-world-disagreement.json','utf8'));
function replay(api,c){
 const nails=buildNailsFromLandmarks(c.landmarks,false,c.width/c.height),fits=nails.map(()=>({accepted:false,confidence:0,reason:'landmark fallback audit'}));
 const get=world=>{const pose=api.estimateHandPose(c.landmarks,world,c.handedness,c.width/c.height);return{pose,evidence:api.assessNailVisibility(pose,c.landmarks,nails,fits,c.width,c.height,false)};};
 const count=e=>api.withNailVisibility(nails,e).filter(n=>n.visibility>0).length;
 const actual=get(c.worldLandmarks),image=get(undefined);
 const slow=new api.NailVisibilityTracker();const slowCounts=[0,600,1200,1800].map(t=>count(slow.update(image.evidence,t,c.handedness.categoryName)));
 const tracker=new api.NailVisibilityTracker();for(let t=0;t<=300;t+=50)tracker.update(image.evidence,t,c.handedness.categoryName);
 const unknown=api.assessNailVisibility({...image.pose,view:'unknown',confidence:0,fingers:[]},c.landmarks,nails,fits,c.width,c.height,false);
 const transientUnknown=count(tracker.update(unknown,350,c.handedness.categoryName));
 const flat=c.landmarks.map(p=>({...p,z:0}));
 const palm=api.estimateHandPose(flat,undefined,{...c.handedness,categoryName:c.handedness.categoryName==='Left'?'Right':'Left'},c.width/c.height);
 const palmCount=count(api.assessNailVisibility(palm,flat,nails,fits,c.width,c.height,false));
 return{view:actual.pose.view,confidence:actual.pose.confidence,source:actual.pose.source,withWorldNails:count(actual.evidence),withoutWorldNails:count(image.evidence),
  reasons:actual.evidence.map(e=>e.reason),slowCounts,transientUnknown,palmView:palm.view,openPalmSyntheticNails:palmCount};
}
const report={kind:'static measured landmarks + controlled timelines; NOT physical camera / hidden-nail accuracy',baselineRevision:'b2ad626',fixtureSource:f.source,license:f.license,file:f.file,
 before:replay(previous,f),after:replay(current,f),slowCadenceMs:600};
if(option('--input')){
 const data=JSON.parse(await readFile(option('--input'),'utf8'));
 report.dataset={source:data.source,frames:data.cases.length,note:'No boundary fitting; counts are fallback display coverage, not ground-truth accuracy.',rows:data.cases.map(c=>({file:c.file,before:replay(previous,c).withWorldNails,after:replay(current,c).withWorldNails}))};
}
const json=JSON.stringify(report,null,2)+'\n';if(option('--output'))await writeFile(option('--output'),json);else process.stdout.write(json);
