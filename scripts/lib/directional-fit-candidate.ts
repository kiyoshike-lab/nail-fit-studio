import type { NailPose } from '../../src/lib/types';
import { refineNailsFromPixels as current } from '../../src/lib/nailImageRefinement';

// OFFLINE EXPERIMENT ONLY. Never imported by src/. The protocol was frozen
// before examining candidate results. A strong edge is not semantic nail proof.
type Pixels = {width: number; height: number; data: Uint8ClampedArray};
export function directionalBoundary(image: Pixels, prior: NailPose, mirrored: boolean, chroma: boolean) {
 const w=prior.width/100*image.width,h=prior.height/100*image.height;
 if(w<6||h<7)return;
 const a=(prior.rotation-90)*Math.PI/180,ax=Math.cos(a),ay=Math.sin(a),rx=prior.x/100*image.width,ry=prior.y/100*image.height;
 const sample=(u:number,v:number)=>{
  const x0=rx-ay*u*w+ax*v*h,x=mirrored?image.width-x0:x0,y=ry+ax*u*w+ay*v*h;
  if(x<1||y<1||x>=image.width-2||y>=image.height-2)return;
  const ix=Math.floor(x),iy=Math.floor(y),dx=x-ix,dy=y-iy,k=(iy*image.width+ix)*4;
  return [0,1,2].map(c=>(image.data[k+c]*(1-dx)+image.data[k+4+c]*dx)*(1-dy)+(image.data[k+image.width*4+c]*(1-dx)+image.data[k+image.width*4+4+c]*dx)*dy);
 };
 const distance=(a:number[],b:number[])=>Math.hypot(...a.map((x,c)=>x-b[c]))/Math.sqrt(3);
 const normalized=(rgb:number[])=>rgb.map(x=>x*255/(rgb.reduce((a,b)=>a+b,0)+1));
 const median=(a:number[])=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
 const edge=(vertical:boolean,lo:number,hi:number,lines:number[],expected:number)=>{
  let best:{p:number;score:number}|undefined;
  for(let n=0;n<=24;n++){
   const p=lo+(hi-lo)*n/24,gains:number[]=[];
   for(const line of lines){
    const inner=sample(vertical?line:p-.045,vertical?p-.045:line),outer=sample(vertical?line:p+.045,vertical?p+.045:line);
    if(inner&&outer)gains.push(distance(inner,outer)+(chroma?distance(normalized(inner),normalized(outer)):0));
   }
   if(gains.length<4)continue;
   const gain=median(gains),noise=median(gains.map(x=>Math.abs(x-gain)));
   if(gain<9||noise>gain*.65||gains.filter(x=>x>=gain*.5).length<4)continue;
   const score=gain-noise*.6-Math.abs(p-expected)*2;
   if(!best||score>best.score)best={p,score};
  }
  return best;
 };
 const root=edge(true,-.35,.3,[-.3,-.15,0,.15,.3],0),tip=edge(true,.65,1.8,[-.3,-.15,0,.15,.3],1);
 if(!root||!tip)return;
 const lines=[.2,.35,.5,.65,.8].map(v=>root.p+v*(tip.p-root.p));
 const left=edge(false,-.85,-.25,lines,-.5),right=edge(false,.25,.85,lines,.5);
 if(!left||!right)return;
 const width=right.p-left.p,height=tip.p-root.p,side=(left.p+right.p)/2;
 if(width<.55||width>1.7||height<.6||height>2.1||Math.abs(side)>.3)return;
 const inner=[sample(side,root.p+height*.25),sample(side,root.p+height*.5),sample(side,root.p+height*.75)];
 if(inner.some(x=>!x))return;
 if(distance(inner[0]!,inner[1]!)>32||distance(inner[2]!,inner[1]!)>32)return;
 return {...prior,x:(rx-ay*side*w+ax*root.p*h)/image.width*100,y:(ry+ax*side*w+ay*root.p*h)/image.height*100,width:prior.width*width,height:prior.height*height};
}
export function refineDirectional(image:Pixels,nails:NailPose[],mirrored:boolean,chroma=false){
 const result=current(image,nails,mirrored);
 result.nails=result.nails.map((nail,index)=>{
  if(result.diagnostics[index].accepted)return nail;
  const proposal=directionalBoundary(image,nails[index],mirrored,chroma);
  if(!proposal)return nail;
  result.diagnostics[index]={...result.diagnostics[index],accepted:true,confidence:.6,reason:chroma?'experimental-gradient-chroma':'experimental-gradient'};
  return proposal;
 });
 return result;
}
export const refineNailsFromPixels=(image:Pixels,nails:NailPose[],mirrored:boolean)=>refineDirectional(image,nails,mirrored,false);
