import assert from 'node:assert/strict';
import { importTypescript } from './lib/import-typescript.mjs';
const {refineNailsFromPixels}=await importTypescript('src/lib/nailImageRefinement.ts');
const {NailFrameRefiner}=await importTypescript('src/lib/nailFrameRefiner.ts');
const {nailCanvasGeometry}=await importTypescript('src/lib/nailPoseMetrics.ts');

function image(nail=true) {
  const width=160,height=200,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const index=(y*width+x)*4;
    const foreground=nail&&((x-80)/11)**2+((y-90)/16)**2<=1;
    data.set(foreground?[230,224,237,255]:[185,130,108,255],index);
  }
  return {width,height,data};
}
const coarse={x:50,y:55,width:9,height:11,rotation:0,confidence:.7};
const pixels=image();
const before=nailCanvasGeometry(coarse,160,200);
const fit=refineNailsFromPixels(pixels,[coarse],false);
assert.equal(fit.diagnostics[0].accepted,true,'a clear nail boundary was ignored');
const after=nailCanvasGeometry(fit.nails[0],160,200);
assert.ok(Math.hypot(after.center.x-80,after.center.y-90)<3,'image fit did not align the nail centre');
assert.ok(Math.abs(after.width-22)<4&&Math.abs(after.height-32)<4,'nail width/height did not follow the pixels');
assert.ok(Math.abs(after.root.y-106)<4,'cuticle/root did not follow the image');
assert.ok(Math.abs(after.center.y-90)<Math.abs(before.center.y-90));
assert.equal(fit.nails[0].rotation,coarse.rotation,'unvalidated pixel rotation must not override the distal-axis estimate');

const mirrored=refineNailsFromPixels(pixels,[{...coarse,x:100-coarse.x,rotation:-coarse.rotation}],true);
assert.equal(mirrored.diagnostics[0].accepted,true);
assert.ok(Math.abs(mirrored.nails[0].x-(100-fit.nails[0].x))<.8,'pixel fitting double-mirrored x');
assert.ok(Math.abs(mirrored.nails[0].y-fit.nails[0].y)<.8);

const ambiguous=refineNailsFromPixels(image(false),[coarse],false);
assert.equal(ambiguous.diagnostics[0].accepted,false);
assert.deepEqual(ambiguous.nails[0],coarse,'ambiguous skin was moved as if a nail had been detected');
assert.equal(refineNailsFromPixels(pixels,[{...coarse,width:1}],false).diagnostics[0].accepted,false);
const short=nailCanvasGeometry(fit.nails[0],160,200,1);
const long=nailCanvasGeometry(fit.nails[0],160,200,2.4);
assert.deepEqual(short.root,long.root,'design length changed the detected root');

// Pixel access failure and disposal must preserve all five live poses.
const five=Array.from({length:5},()=>coarse);
let reads=0;
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},getImageData(){reads++;return pixels;}})})};
const refiner=new NailFrameRefiner();
const first=refiner.refine({},160,200,five,false,0);
assert.ok(first.diagnostics.every(item=>item.accepted));
const shifted=five.map(nail=>({...nail,x:nail.x+1}));
const cached=refiner.refine({},160,200,shifted,false,50);
assert.equal(reads,1,'cached correction read a new full frame');
assert.ok(first.diagnostics.every(item=>item.contour?.length>=3),'current clear boundary has no ordered contour');
assert.ok(cached.diagnostics.every(item=>!item.contour&&!item.outline),'stale absolute contour was reused');
assert.ok(Math.abs(cached.nails[0].x-first.nails[0].x-1)<.01,'recent image correction did not follow the finger');
const fresh=refiner.refine({},160,200,five,false,70,true);
assert.equal(reads,2,'partial nail reused a cached frame');
assert.ok(fresh.diagnostics.every(item=>item.contour?.length>=3));
refiner.dispose();
globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData(){throw Error('SecurityError');}})})};
const unavailable=new NailFrameRefiner().refine({},160,200,five,false,200);
assert.deepEqual(unavailable.nails,five);
assert.ok(unavailable.diagnostics.every(item=>!item.accepted));
console.log('nail-alignment: pixel centre/root/size, mirror, uncertain fallback, root lock, bounded reuse and Canvas failure passed');
