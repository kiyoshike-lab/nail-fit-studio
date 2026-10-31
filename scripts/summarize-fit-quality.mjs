import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
if(!opt('--input')||!opt('--output'))throw Error('--input and --output required');
const input=JSON.parse(await readFile(opt('--input'),'utf8')),protocol=JSON.parse(await readFile('scripts/fixtures/fit-quality-protocol-20261030.json','utf8'));
for(const [file,sha]of Object.entries(protocol.frozenCandidateHashes))if(createHash('sha256').update((await readFile(file,'utf8')).replaceAll('\r\n','\n')).digest('hex')!==sha)throw Error(`Frozen candidate changed after protocol registration: ${file}`);
const canvas=opt('--canvas')?JSON.parse(await readFile(opt('--canvas'),'utf8')):null;
const stats=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return{n:v.length,mean:v.length?v.reduce((a,b)=>a+b,0)/v.length:null,median:v.length?v[Math.ceil(v.length*.5)-1]:null,p10:v.length?v[Math.ceil(v.length*.1)-1]:null,p90:v.length?v[Math.ceil(v.length*.9)-1]:null,min:v.at(0)??null,max:v.at(-1)??null};};
const metric={centerErrorPx:r=>r.centerErrorPx,approxRootErrorPx:r=>r.approxRootErrorPx,widthRelativeError:r=>Math.abs(r.widthRatio-1),lengthRelativeError:r=>Math.abs(r.heightRatio-1),angleErrorDeg:r=>r.angleErrorDeg,ellipseIoU:r=>r.iou};
const summarize=(rows,stage)=>Object.fromEntries(Object.entries(metric).map(([name,select])=>[name,stats(rows.map(row=>select(row[stage])))]));
const group=rows=>({n:rows.length,before:summarize(rows,'before'),after:summarize(rows,'after'),
 changed:rows.filter(r=>Object.keys(r.before).some(k=>typeof r.before[k]==='number'&&Math.abs(r.before[k]-r.after[k])>1e-8)).length,
 improvedIoU:rows.filter(r=>r.after.iou-r.before.iou>1e-6).length,worsenedIoU001:rows.filter(r=>r.after.iou-r.before.iou<-.01).length,
 worsenedCenter1px:rows.filter(r=>r.after.centerErrorPx-r.before.centerErrorPx>1).length,worsenedApproxRoot1px:rows.filter(r=>r.after.approxRootErrorPx-r.before.approxRootErrorPx>1).length,
 worstIoUDeltas:rows.map(r=>({file:r.file,finger:r.finger,before:r.before,after:r.after,deltaIoU:r.after.iou-r.before.iou})).sort((a,b)=>a.deltaIoU-b.deltaIoU).slice(0,5),
 lowestAfterIoU:rows.map(r=>({file:r.file,finger:r.finger,iou:r.after.iou})).sort((a,b)=>a.iou-b.iou).slice(0,5),
 largestAfterApproxRootError:rows.map(r=>({file:r.file,finger:r.finger,approxRootErrorPx:r.after.approxRootErrorPx})).sort((a,b)=>b.approxRootErrorPx-a.approxRootErrorPx).slice(0,5)});
const splits=Object.fromEntries(Object.entries(protocol.splits).map(([name,files])=>[name,new Set(files)]));
if(input.rows.some(row=>!Object.values(splits).some(files=>files.has(row.file))))throw Error('Unregistered source image');
const report={methodology:input.methodology,independence:protocol.independence,baselineCommit:protocol.baseline,images:input.images,matchedNails:input.matchedNails,overall:group(input.rows),
 byFinger:['thumb','index','middle','ring','pinky'].map((name,finger)=>({name,...group(input.rows.filter(r=>r.finger===finger))})),
 splits:Object.fromEntries(Object.entries(splits).map(([name,files])=>[name,group(input.rows.filter(r=>files.has(r.file)))])),
 refinementAudit:input.refinementAudit,
 limitations:['Finger identity inferred from baseline greedy matching, not human labels','Approximate PCA root, not anatomical cuticle ground truth','No labelled live video latency/FPS/visibility error measurement','Prospective image split was already historical development data, NOT independent validation']};
if(canvas){const g=rows=>({n:rows.length,before:stats(rows.map(r=>r.before.iou)),after:stats(rows.map(r=>r.after.iou)),worsened001:rows.filter(r=>r.after.iou-r.before.iou<-.01).length});
 report.canvas={method:canvas.method,overall:g(canvas.rows),byFinger:Array.from({length:5},(_,finger)=>({finger,...g(canvas.rows.filter(r=>r.finger===finger))})),splits:Object.fromEntries(Object.entries(splits).map(([name,files])=>[name,g(canvas.rows.filter(r=>files.has(r.file)))])),timing:canvas.timing};}
const h=report.splits.candidateHoldout;
report.productionGate={heldoutEllipseMeanImproved:h.after.ellipseIoU.mean>h.before.ellipseIoU.mean,
 heldoutCenterNotWorse:h.after.centerErrorPx.mean<=h.before.centerErrorPx.mean,
 heldoutApproxRootNotWorse:h.after.approxRootErrorPx.mean<=h.before.approxRootErrorPx.mean,
 heldoutPerFingerWithin001:Array.from({length:5},(_,finger)=>{const r=input.rows.filter(r=>splits.candidateHoldout.has(r.file)&&r.finger===finger);return r.length&&stats(r.map(r=>r.after.iou)).mean-stats(r.map(r=>r.before.iou)).mean>=-.01;}).every(Boolean),
 heldoutWorseningNotOutnumberingImprovement:h.worsenedIoU001<=h.improvedIoU,
 desktopPixelTimingRatio:canvas?canvas.timing.after.meanMs/canvas.timing.before.meanMs:null,
 independentExternalEvaluation:false,mobileRecoveryConfirmed:false,adopted:false,reason:'No independent untouched validation and smartphone recovery not confirmed; candidate is research only'};
await writeFile(opt('--output'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({n:report.matchedNails,before:report.overall.before.ellipseIoU.mean,after:report.overall.after.ellipseIoU.mean,holdoutBefore:h.before.ellipseIoU.mean,holdoutAfter:h.after.ellipseIoU.mean,worsened:report.overall.worsenedIoU001,adopted:false}));
