import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {importTypescript} from './lib/import-typescript.mjs';
const {fitChromaticNail}=await importTypescript('src/lib/nailChromaticFit.ts');
const {assessNailVisibility,NailVisibilityTracker,withNailVisibility}=await importTypescript('src/lib/nailVisibility.ts');
const {estimateHandPose}=await importTypescript('src/lib/handPose.ts');
const {buildNailsFromLandmarks}=await importTypescript('src/lib/nailGeometry.ts');
const {drawNails}=await importTypescript('src/lib/nailRenderer.ts');
const {defaultDesign}=await importTypescript('src/lib/defaults.ts');

function scene(scale=1,rotation=0,mirror=false,kind='nail'){
 const width=160,height=180,data=new Uint8ClampedArray(width*height*4),a=(rotation-90)*Math.PI/180,ax=Math.cos(a),ay=Math.sin(a);
 const w=22*scale,h=34*scale,cx=80,cy=90;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const dx=(mirror?width-x:x)-cx,dy=y-cy,side=-ay*dx+ax*dy,along=ax*dx+ay*dy;
  const inside=(side/(w/2))**2+(along/(h/2))**2<=1;
  const bg=[205,160,138],fg=kind==='glare'?[235,235,235]:kind==='shade'?[164,128,110.4]:kind==='blank'?bg:[224,195,200];
  data.set([...(inside?fg:bg),255],(y*width+x)*4);
 }
 return {image:{width,height,data},prior:{x:(cx-ax*26*scale/2)/width*100,y:(cy-ay*26*scale/2)/height*100,width:18*scale/width*100,height:26*scale/height*100,rotation}};
}
let good;
for(const scale of [.8,1,1.4])for(const angle of [-60,0,36])for(const mirror of [false,true]){
 const {image,prior}=scene(scale,angle,mirror),fit=fitChromaticNail(image,prior,mirror);
 assert.ok(fit,'pink plate with supported borders was rejected');
 assert.ok(fit.supported>=20&&fit.stability>=.75&&fit.contour.length>=3);
 assert.ok(fit.contour.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 const a=(fit.nail.rotation-90)*Math.PI/180,h=fit.nail.height/100*image.height;
 assert.ok(Math.hypot(fit.nail.x/100*image.width+Math.cos(a)*h/2-80,fit.nail.y/100*image.height+Math.sin(a)*h/2-90)<8*scale);
 good=fit;
}
for(const kind of ['blank','glare','shade']){
 const {image,prior}=scene(1,0,false,kind);
 assert.equal(fitChromaticNail(image,prior,false),undefined,`${kind} was mistaken for a pink nail`);
}
const tiny=scene(.15);assert.equal(fitChromaticNail(tiny.image,tiny.prior,false),undefined);
const transparent=scene();for(let i=3;i<transparent.image.data.length;i+=4)transparent.image.data[i]=0;
assert.equal(fitChromaticNail(transparent.image,transparent.prior,false),undefined,'invisible RGB authorized a visible plate');
const inside=(p,polygon)=>{let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
 const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
}return result;};
for(const scale of [1,2,3]){
 const stripe=scene(scale);
 for(let y=65;y<=115;y++)stripe.image.data.set([8,8,8,255],(y*stripe.image.width+80)*4);
 const fitted=fitChromaticNail(stripe.image,stripe.prior,false),p={x:80.5/160*100,y:90.5/180*100};
 assert.ok(!fitted||!inside(p,fitted.contour)||fitted.holes.some(hole=>inside(p,hole)),'coarse clipping bridged a native 1px excluded stripe');
}

const fixture=JSON.parse(await readFile('scripts/fixtures/thumb-fit-geometry.json','utf8'));
const landmarks=fixture.landmarks.map(p=>({...p,z:0}));
const back=estimateHandPose(landmarks,undefined,{categoryName:'Right',score:.99},fixture.aspect);
const nails=buildNailsFromLandmarks(landmarks,false,fixture.aspect),none=nails.map(()=>({accepted:false,confidence:0,reason:'test'}));
const palm={...back,view:'palm',fingers:back.fingers.map(f=>({...f,facing:-.8,bendDegrees:0,outOfPlaneDegrees:0}))};
const curl={...palm,fingers:palm.fingers.map(f=>({...f,facing:.3,bendDegrees:110,outOfPlaneDegrees:65}))};
const supported={accepted:true,confidence:.94,reason:'chromatic-visible-core',contour:good.contour,contourHoles:good.holes,supportThresholds:3,
 chromaticEvidence:{supportedRays:24,stability:.95,contrast:[4,4,4,4]}};
const assess=(pose,fits)=>assessNailVisibility(pose,landmarks,nails,fits,1280,720,false);
assert.ok(assess(palm,nails.map(()=>supported)).every(e=>e.hardHidden),'colour alone made an open palm visible');
const ambiguousThumb={...curl,fingers:curl.fingers.map((f,i)=>i===0?{...f,facing:-.7}:f)};
assert.equal(assess(ambiguousThumb,nails.map(()=>supported))[0].hardHidden,true,'pink-pad-like colour overrode ambiguous thumb roll');
const one=none.map((d,i)=>i===1?supported:d),partial=assess(curl,one);
assert.equal(partial[1].state,'partial');assert.ok(partial.filter((_,i)=>i!==1).every(e=>e.hardHidden),'one uncertain finger affected other IDs');
const noCore={...supported,chromaticEvidence:undefined};
assert.equal(assess(curl,none.map((d,i)=>i===1?noCore:d))[1].hardHidden,true,'lower normal was trusted without new independent image evidence');
assert.ok(assess(back,none).every(e=>e.state==='visible'),'dorsal five-nail prior changed');

// Confirmation memory is not paint permission. Never fade an UNCLIPPED full
// shape after a fragment's current contour has disappeared.
const tracker=new NailVisibilityTracker();
for(let t=0;t<=300;t+=50)tracker.update(partial,t,'Right');
const unknown=partial.map(e=>({...e,state:'uncertain',confidence:0,hardHidden:false,contour:undefined,holes:undefined}));
const vanished=withNailVisibility(nails,tracker.update(unknown,350,'Right'));
assert.equal(vanished[1].visibility,0,'partial became an unclipped full plate on uncertainty');
let paints=0;const stack=[],state={globalAlpha:1};
const ctx=new Proxy(state,{get(target,key){if(key in target)return target[key];if(key==='save')return()=>stack.push({...target});if(key==='restore')return()=>Object.assign(target,stack.pop());if(String(key).startsWith('create'))return()=>({addColorStop(){}});return()=>{if(key==='fill'||key==='fillRect')paints++;};}});
await drawNails(ctx,640,480,vanished,defaultDesign);assert.equal(paints,0,'unknown partial painted without a current mask');
const intermittent=new NailVisibilityTracker();let displayed=0;
for(let t=0;t<=500;t+=50){const current=t%100===0,values=intermittent.update(current?partial:assess(palm,none),t,'Right');
 if(current&&values[1].alpha>0)displayed++;if(!current)assert.ok(values.every(v=>v.alpha===0),'missing fragment reused an old contour');}
assert.ok(displayed>0,'intermittent valid fragments can never enter');
const dorsalTracker=new NailVisibilityTracker(),dorsal=assess(back,none);
for(let t=0;t<=300;t+=50)dorsalTracker.update(dorsal,t,'Right');
assert.ok(dorsalTracker.update(unknown,350,'Right').every(v=>v.alpha>0),'dorsal-only unknown hold was lost');
console.log('curled-nails: supported chromatic masks at scales/angles/mirrors, blank/shade/glare/tiny negatives, per-finger curl/core gates, open-palm safety, partial-to-unknown no paint, intermittent fresh evidence and dorsal-five hold passed (synthetic, not hardware accuracy)');
