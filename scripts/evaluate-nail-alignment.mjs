import { readFile, writeFile } from 'node:fs/promises';
import { importTypescript } from './lib/import-typescript.mjs';

const args = process.argv.slice(2);
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
if (!args.includes('--input')) throw Error('--input local prepared evaluation JSON is required');
const data = JSON.parse(await readFile(option('--input'), 'utf8'));
const { buildNailsFromLandmarks } = await importTypescript(args.includes('--geometry') ? option('--geometry') : 'src/lib/nailGeometry.ts');
const refine = args.includes('--refine') ? (await importTypescript(option('--refiner') ?? 'src/lib/nailImageRefinement.ts')).refineNailsFromPixels : null;
const baselineGeometry = option('--baseline-geometry') ? (await importTypescript(option('--baseline-geometry'))).buildNailsFromLandmarks : buildNailsFromLandmarks;
const baselineRefine = option('--baseline-refiner') ? (await importTypescript(option('--baseline-refiner'))).refineNailsFromPixels : null;
const {surfaceFromContour} = option('--render-cases-output') ? await importTypescript('scripts/lib/nail-surface-candidate.ts') : {};
const rows = [];
const fitAudit = [];
const proposals = [];
const renderCases = [];
for (const item of data.cases) {
  const pixels = new Uint8ClampedArray(Buffer.from(item.pixels, 'base64'));
  const mask = new Uint8Array(Buffer.from(item.mask, 'base64'));
  const components = connectedComponents(mask, item.width, item.height);
  const image = { data: pixels, width: item.width, height: item.height };
  const coarseBaseline = baselineGeometry(item.landmarks, false, item.width / item.height);
  const beforeFit = baselineRefine?.(image, coarseBaseline, false);
  const before = beforeFit?.nails ?? coarseBaseline;
  const coarse = buildNailsFromLandmarks(item.landmarks, false, item.width / item.height);
  const result = refine ? refine(image, coarse, false) : null;
  const after = result?.nails ?? coarse;
  fitAudit.push({before:beforeFit?.diagnostics,after:result?.diagnostics});
  if(option('--proposals-output')) proposals.push({file:item.file,width:item.width,height:item.height,coarse,nails:after,diagnostics:result?.diagnostics});
  // Lock assignments to the baseline before evaluating any refinement.
  const candidates = coarseBaseline.flatMap((nail, finger) => components.map((component, index) => ({
    finger, index, distance: Math.hypot(poseCenter(nail, item.width, item.height).x - component.x, poseCenter(nail, item.width, item.height).y - component.y),
  }))).sort((a,b)=>a.distance-b.distance);
  const assigned = new Set(), used = new Set();
  for (const candidate of candidates) {
    if (assigned.has(candidate.finger) || used.has(candidate.index)) continue;
    const component = components[candidate.index];
    if (candidate.distance > Math.max(item.width,item.height) * .2) continue;
    assigned.add(candidate.finger); used.add(candidate.index);
    const baseline = evaluate(before[candidate.finger], component, item.width, item.height);
    const improved = evaluate(after[candidate.finger], component, item.width, item.height);
    rows.push({ file:item.file, finger:candidate.finger, component:candidate.index, maskAspect:component.elongation, before:baseline, after:improved,
      refined:result?.diagnostics[candidate.finger]?.accepted ?? false });
  }
  if (option('--render-cases-output')) {
    const labels = new Uint8Array(mask.length);
    components.forEach((component, index) => component.indices.forEach(pixel => { labels[pixel] = index + 1; }));
    const surfaces = after.map((nail,index) => {
      const fit = result?.diagnostics[index];
      return fit?.accepted && fit.confidence >= .8 && fit.contour && !fit.contourHoles?.length
        ? surfaceFromContour(nail,fit.contour,item.width/item.height,fit.confidence) : null;
    });
    renderCases.push({ file:item.file,width:item.width,height:item.height,before,after,surfaces,labels:Buffer.from(labels).toString('base64'),
      matches:rows.filter(row=>row.file===item.file).map(row=>({finger:row.finger,label:row.component+1})) });
  }
}
const summary = (key, subset = rows) => ({
  meanCenterErrorPx: mean(subset.map(row=>row[key].centerErrorPx)),
  meanCenterErrorNailWidths: mean(subset.map(row=>row[key].centerErrorNailWidths)),
  meanEllipseIoU: mean(subset.map(row=>row[key].iou)),
  meanAngleErrorDeg: mean(subset.map(row=>row[key].angleErrorDeg).filter(value=>value!==null)),
  meanWidthRatio: mean(subset.map(row=>row[key].widthRatio)),
  meanHeightRatio: mean(subset.map(row=>row[key].heightRatio)),
  meanWidthRelativeError: mean(subset.map(row=>Math.abs(row[key].widthRatio - 1))),
  meanHeightRelativeError: mean(subset.map(row=>Math.abs(row[key].heightRatio - 1))),
  meanApproxRootErrorPx: mean(subset.map(row=>row[key].approxRootErrorPx)),
});
const group = (subset) => ({ matchedNails:subset.length, before:summary('before',subset), after:summary('after',subset) });
const report={source:data.source,license:data.license,images:data.cases.length,matchedNails:rows.length,
  inputImages:data.inputImages ?? data.cases.length, undetectedFiles:data.undetectedFiles ?? [],
  refinedNails:rows.filter(row=>row.refined).length,
  landmarks:data.landmarks,
  methodology:`${baselineRefine ? 'Previous full pipeline' : 'Coarse geometry'} versus current image refinement using identical landmarks; coarse-baseline-locked greedy component assignment; mask centroid/PCA; ellipse approximation, not rendered design IoU. Approximate root is mask centroid minus half PCA length, with axis sign aligned to baseline nail. No annotated cuticle ground truth. Exploratory development set, not independent model validation.`,
  before:summary('before'),after:summary('after'),
  byFinger:['thumb','index','middle','ring','pinky'].map((name,index)=>({name,...group(rows.filter(row=>row.finger===index))})),
  byMaskAspect:{elongated:group(rows.filter(row=>row.maskAspect>=1.8)),compact:group(rows.filter(row=>row.maskAspect<1.8))},rows};
report.refinementAudit=Array.from({length:5},(_,finger)=>{
  const rejected={};
  for(const frame of fitAudit) for(const [gate,count] of Object.entries(frame.after?.[finger]?.rejected??{})) rejected[gate]=(rejected[gate]??0)+count;
  return {finger,attempted:fitAudit.length,beforeAccepted:fitAudit.filter(frame=>frame.before?.[finger]?.accepted).length,afterAccepted:fitAudit.filter(frame=>frame.after?.[finger]?.accepted).length,rejected};
});
console.log(JSON.stringify({...report,rows:undefined},null,2));
if(args.includes('--output')) await writeFile(option('--output'),JSON.stringify(report,null,2)+'\n');
if(option('--proposals-output')) await writeFile(option('--proposals-output'),JSON.stringify(proposals));
if(option('--render-cases-output')) await writeFile(option('--render-cases-output'),JSON.stringify(renderCases));

function poseCenter(nail,width,height) {
  const angle=(nail.rotation-90)*Math.PI/180;
  return {x:nail.x/100*width+Math.cos(angle)*nail.height/100*height*.5,y:nail.y/100*height+Math.sin(angle)*nail.height/100*height*.5};
}
function evaluate(nail,component,width,height) {
  const center=poseCenter(nail,width,height);
  const angle=(nail.rotation-90)*Math.PI/180;
  const cosine=Math.cos(angle),sine=Math.sin(angle);
  const nw=nail.width/100*width,nh=nail.height/100*height;
  let intersection=0,area=0;
  const label=new Set(component.indices);
  const radius=Math.max(nw,nh)*.55;
  for(let y=Math.max(0,Math.floor(center.y-radius));y<Math.min(height,center.y+radius+1);y++) {
    for(let x=Math.max(0,Math.floor(center.x-radius));x<Math.min(width,center.x+radius+1);x++) {
      const dx=x-center.x,dy=y-center.y;
      if(((-sine*dx+cosine*dy)/(nw/2))**2+((cosine*dx+sine*dy)/(nh/2))**2<=1) {
        area++; if(label.has(y*width+x)) intersection++;
      }
    }
  }
  const delta=Math.abs(((angle-component.angle)*180/Math.PI+540)%180-90);
  const centerErrorPx=Math.hypot(center.x-component.x,center.y-component.y);
  const direction = Math.cos(angle-component.angle) >= 0 ? 1 : -1;
  const rootX = component.x - Math.cos(component.angle)*component.height*.5*direction;
  const rootY = component.y - Math.sin(component.angle)*component.height*.5*direction;
  return {centerErrorPx,centerErrorNailWidths:centerErrorPx/component.width,iou:intersection/Math.max(1,area+component.indices.length-intersection),
    approxRootErrorPx:Math.hypot(nail.x/100*width-rootX,nail.y/100*height-rootY),
    angleErrorDeg:component.elongation>1.35?90-delta:null,widthRatio:nw/component.width,heightRatio:nh/component.height};
}
function connectedComponents(mask,width,height) {
  const visited=new Uint8Array(mask.length),components=[];
  for(let seed=0;seed<mask.length;seed++) {
    if(!mask[seed]||visited[seed]) continue;
    const queue=[seed];visited[seed]=1;
    for(let head=0;head<queue.length;head++) {
      const index=queue[head],x=index%width,y=Math.floor(index/width);
      for(const neighbor of [x>0?index-1:-1,x<width-1?index+1:-1,y>0?index-width:-1,y<height-1?index+width:-1]) {
        if(neighbor>=0&&!visited[neighbor]&&mask[neighbor]) {visited[neighbor]=1;queue.push(neighbor);}
      }
    }
    if(queue.length<30) continue;
    const xs=queue.map(index=>index%width),ys=queue.map(index=>Math.floor(index/width));
    const x=mean(xs),y=mean(ys);
    const xx=mean(xs.map(value=>(value-x)**2)),yy=mean(ys.map(value=>(value-y)**2));
    const xy=mean(xs.map((value,index)=>(value-x)*(ys[index]-y)));
    const angle=.5*Math.atan2(2*xy,xx-yy),cosine=Math.cos(angle),sine=Math.sin(angle);
    const along=xs.map((value,index)=>(value-x)*cosine+(ys[index]-y)*sine);
    const side=xs.map((value,index)=>-(value-x)*sine+(ys[index]-y)*cosine);
    const w=Math.max(...side)-Math.min(...side)+1,h=Math.max(...along)-Math.min(...along)+1;
    components.push({x,y,width:w,height:h,angle,elongation:h/w,indices:queue});
  }
  return components;
}
function mean(values) {return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;}
