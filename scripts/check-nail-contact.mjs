import assert from 'node:assert/strict';
import {importTypescript} from './lib/import-typescript.mjs';
const {fitNailFromEdges}=await importTypescript('src/lib/nailEdgeFit.ts');
const {surfaceFromContour,validNailSurface,buildSurfacePath}=await importTypescript('scripts/lib/nail-surface-candidate.ts');
const {NailCorrectionGate}=await importTypescript('src/lib/nailCorrectionGate.ts');
const {applyCalibration}=await importTypescript('src/lib/nailCalibration.ts');
const {NailFrameRefiner}=await importTypescript('src/lib/nailFrameRefiner.ts');
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);

function scene(scale=1,rotation=0,mirror=false,kind='nail',shift=0){
 const width=320,height=320,data=new Uint8ClampedArray(width*height*4);
 const a=(rotation-90)*Math.PI/180,ax=Math.cos(a),ay=Math.sin(a);
 const cx=144+shift,cy=145,w=24*scale,h=36*scale;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const dx=(mirror?width-x:x)-cx,dy=y-cy;
  const u=-ay*dx+ax*dy,v=ax*dx+ay*dy;
  const inside=(u/(w/2))**2+(v/(h/2))**2<=1;
  const rgb=kind==='blank'?[180,135,115]:kind==='silhouette'?(inside?[220,180,155]:[25,30,40]):inside?[222,208,207]:[180,135,115];
  data.set([...rgb,255],(y*width+x)*4);
 }
 return {image:{width,height,data},prior:{x:(cx-ax*h/2)/width*100,y:(cy-ay*h/2)/height*100,width:w/width*100,height:h/height*100,rotation}};
}
for(const scale of [.7,1,1.6])for(const rotation of [0,37,-68])for(const mirror of [false,true]){
 const {image,prior}=scene(scale,rotation,mirror);
 const fit=fitNailFromEdges(image,prior,mirror);
 assert.ok(fit,'supported root and both sides were rejected');
 assert.ok(fit.nail.width/prior.width<1.4&&fit.nail.height/prior.height<1.4,'edge fit grew beyond the visible plate');
 assert.equal(fit.nail.rotation,prior.rotation);
}
const blank=scene(1,0,false,'blank');assert.equal(fitNailFromEdges(blank.image,blank.prior,false),undefined);
const tiny=scene(.2);assert.equal(fitNailFromEdges(tiny.image,tiny.prior,false),undefined);
// A finger/background silhouette can be an equally convincing closed ellipse.
// No colour-only heuristic can guarantee semantic identity. The fallback is
// deliberately NOT allowed to supply a contour or high-confidence palm evidence.
const silhouette=scene(1,0,false,'silhouette');
const ambiguous=fitNailFromEdges(silhouette.image,silhouette.prior,false);
assert.ok(!ambiguous||!ambiguous.nail.clipContour);

const n={x:45,y:62,width:9,height:14,rotation:28};const aspect=1.4;
const a=(n.rotation-90)*Math.PI/180,ax=Math.cos(a),ay=Math.sin(a);
const contour=Array.from({length:64},(_,i)=>{
 const t=i/64*Math.PI*2,u=Math.cos(t)*.5,v=.5+Math.sin(t)*.5;
 return {x:n.x+(ax*v*n.height-ay*u*n.width*aspect)/aspect,y:n.y+ay*v*n.height+ax*u*n.width*aspect};
});
const surface=surfaceFromContour(n,contour,aspect,.9);
assert.ok(validNailSurface(surface));
assert.equal(surfaceFromContour(n,contour,aspect,.7),undefined);
for(const bad of [{},{rows:null,confidence:1},{rows:[],confidence:1},{...surface,confidence:NaN},{...surface,rows:surface.rows.map(r=>({...r,left:NaN}))}])assert.equal(validNailSurface(bad),false);
const path=(length,shape='natural',candidate=surface)=>{
 const points=[];const ctx={beginPath(){},moveTo(x,y){points.push({x,y});},lineTo(x,y){points.push({x,y});},closePath(){}};
 const ok=buildSurfacePath(ctx,36,60*length,length,shape,candidate);
 return {ok,points:points.map(p=>({x:p.x,y:p.y-60*length/2}))}; // root-relative rendering coordinates
};
const short=path(1),long=path(2.4);
assert.ok(short.ok&&long.ok);
short.points.forEach((p,i)=>{if(Math.abs(p.y)<60*.65){near(p.x,long.points[i].x);near(p.y,long.points[i].y);}});
assert.ok(Math.min(...long.points.map(p=>p.y))<Math.min(...short.points.map(p=>p.y))*2);
for(const shape of ['round','oval','square','squoval','almond','coffin','stiletto']){
 const changed=path(1,shape);assert.ok(changed.ok);
 near(changed.points[0].x,short.points[0].x);near(changed.points[0].y,short.points[0].y);
}
assert.equal(path(1,'natural',{rows:[],confidence:1}).ok,false,'invalid surface must fall back to the old nail path');
const adjusted=applyCalibration({...n,surface},{side:.2,along:.1,width:1.2,height:1.3,rotation:10},aspect);
assert.deepEqual(adjusted.surface,surface,'manual adjustment must transport a LOCAL surface without absolute stale pixels');

const gate=new NailCorrectionGate(),base={side:0,along:0,width:1,height:1,rotation:0};
assert.equal(gate.update(base,0).held,false);
const jump={...base,side:.65,width:1.6};
assert.equal(gate.update(jump,160).held,true);
assert.equal(gate.update(base,320).held,false,'one outlier polluted the confirmed correction');
assert.equal(gate.update(jump,480).held,true);
assert.equal(gate.update(jump,640).held,false,'a persistent real boundary change must recover');
assert.equal(gate.update(base,1200).held,false,'a long detection loss must not inherit stale geometry');
assert.equal(gate.update(base,50).held,false,'a new timestamp epoch must reset the gate');

const still=scene(),displaced=scene(1,0,false,'nail',10);
let currentPixels=still.image;
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},getImageData(){return currentPixels;}})})};
const refiner=new NailFrameRefiner(),five=Array.from({length:5},()=>still.prior);
const first=refiner.refine({},320,320,five,false,0);
assert.ok(first.diagnostics[1].accepted);
currentPixels=displaced.image;
const held=refiner.refine({},320,320,five,false,160);
assert.equal(held.diagnostics[1].reason,'temporal-jump-pending');
near(held.nails[1].x,first.nails[1].x);
assert.ok(!held.diagnostics[1].contour&&!held.diagnostics[1].outline,'held fit supplied a stale absolute contour');
const confirmed=refiner.refine({},320,320,five,false,320);
assert.ok(confirmed.diagnostics[1].accepted&&confirmed.nails[1].x>held.nails[1].x+2);
const moved=five.map(n=>({...n,x:n.x+1,width:n.width*1.05,height:n.height*1.05}));
const cached=refiner.refine({},320,320,moved,false,350);
assert.ok(!cached.diagnostics[1].contour,'cache transported an absolute mask');
assert.ok(cached.nails[1].width>confirmed.nails[1].width,'distance change was frozen by the correction gate');
const partial=refiner.refine({},320,320,five,false,360,true);
assert.ok(partial.diagnostics[1].contour,'partial visibility must get a fresh contour rather than a held one');
refiner.dispose();
console.log('nail-contact: edge scale/rotation/mirror, blank/tiny fallback, normalized contour, malformed surface, fixed root during extension, design tip shapes, manual transport and relative temporal gate passed (synthetic, not real-world accuracy)');
