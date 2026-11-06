import type { FingerArt } from "./workshopTypes";
import type { PaintLayer, PaintPoint, ShapeLayer, StrokeLayer } from "./paintTypes";
import { artOrder } from "./paintData";
import { drawNailParts } from "./workshopDrawing";

function smoothPath(ctx:Pick<CanvasRenderingContext2D,"moveTo"|"lineTo"|"quadraticCurveTo">,points:readonly PaintPoint[]) {
  ctx.moveTo(points[0].x,points[0].y);
  if(points.length===1){ctx.lineTo(points[0].x+.00001,points[0].y);return;}
  for(let i=1;i<points.length-1;i++)ctx.quadraticCurveTo(points[i].x,points[i].y,(points[i].x+points[i+1].x)/2,(points[i].y+points[i+1].y)/2);
  const last=points.at(-1)!;ctx.lineTo(last.x,last.y);
}
const strokePaths=new WeakMap<readonly PaintPoint[],Path2D>();
function strokeSmooth(ctx:CanvasRenderingContext2D,points:readonly PaintPoint[]) {
  if(typeof Path2D==="undefined"){ctx.beginPath();smoothPath(ctx,points);ctx.stroke();return;}
  let path=strokePaths.get(points);if(!path){path=new Path2D();smoothPath(path,points);strokePaths.set(points,path);}ctx.stroke(path);
}
function stampPoints(points:readonly PaintPoint[],step:number):PaintPoint[] {
  const length=points.reduce((n,p,i)=>i?n+Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y):0,0);
  step=Math.max(step,length/500);
  const out=[points[0]];let carry=0;
  for(let i=1;i<points.length&&out.length<512;i++){
    const a=points[i-1],b=points[i],distance=Math.hypot(b.x-a.x,b.y-a.y);if(!distance)continue;
    let t=step-carry;
    for(;t<=distance&&out.length<512;t+=step)out.push({x:a.x+(b.x-a.x)*t/distance,y:a.y+(b.y-a.y)*t/distance});
    carry=(carry+distance)%step;
  }const last=points.at(-1)!;if(out.length<512&&Math.hypot(last.x-out.at(-1)!.x,last.y-out.at(-1)!.y)>step*.5)out.push(last);return out;
}
function paintStroke(ctx:CanvasRenderingContext2D,l:StrokeLayer) {
  ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=l.lineWidth;ctx.strokeStyle=l.color;ctx.fillStyle=l.color;
  if(["dots","glitter","holo"].includes(l.tool)){
    stampPoints(l.points,Math.max(.004,l.lineWidth*l.spacing)).forEach((p,i)=>{
      const r=l.lineWidth/2;ctx.beginPath();
      if(l.tool==="holo"){
        for(let n=0;n<5;n++){const a=n*Math.PI*2/5+i*.7,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;if(n)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();
      }else ctx.arc(p.x,p.y,l.tool==="glitter"?r*(.3+(i%3)*.2):r,0,Math.PI*2);
      ctx.fillStyle=l.tool==="dots"||i%3?l.color:l.secondary;ctx.fill();
      if(l.tool==="holo"){ctx.fillStyle=l.secondary;ctx.beginPath();ctx.arc(p.x-r*.2,p.y-r*.2,r*.2,0,Math.PI*2);ctx.fill();}
    });return;
  }
  if(l.tool==="brush"){
    const alpha=ctx.globalAlpha;
    for(const [factor,a]of[[1.5,.12],[1.15,.22],[.85,.85]]){ctx.globalAlpha=alpha*a;ctx.lineWidth=l.lineWidth*factor;strokeSmooth(ctx,l.points);}ctx.globalAlpha=alpha;
  }else{strokeSmooth(ctx,l.points);}
}
function shapePath(ctx:CanvasRenderingContext2D,l:ShapeLayer) {
  const w=l.width,h=l.height;ctx.beginPath();
  if(l.tool==="circle"||l.tool==="ellipse")ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);
  else if(["square","rectangle","gradient","polka"].includes(l.tool))ctx.rect(-w/2,-h/2,w,h);
  else if(l.tool==="diamond"){ctx.moveTo(0,-h/2);ctx.lineTo(w/2,0);ctx.lineTo(0,h/2);ctx.lineTo(-w/2,0);ctx.closePath();}
  else if(l.tool==="triangle"){ctx.moveTo(0,-h/2);ctx.lineTo(w/2,h/2);ctx.lineTo(-w/2,h/2);ctx.closePath();}
  else if(l.tool==="star"){for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?.45:1,x=Math.cos(a)*w/2*r,y=Math.sin(a)*h/2*r;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();}
  else if(l.tool==="heart"){ctx.moveTo(0,h/2);ctx.bezierCurveTo(-w,-h*.1,-w*.4,-h*.8,0,-h*.25);ctx.bezierCurveTo(w*.4,-h*.8,w,-h*.1,0,h/2);ctx.closePath();}
  else{ctx.moveTo(-w/2,0);if(l.tool==="line")ctx.lineTo(w/2,0);else ctx.quadraticCurveTo(0,h*l.bend,w/2,0);}
}
function paintShape(ctx:CanvasRenderingContext2D,l:ShapeLayer) {
  ctx.fillStyle=l.color;ctx.strokeStyle=l.strokeColor;ctx.lineWidth=l.lineWidth;ctx.lineJoin="round";ctx.lineCap="round";
  shapePath(ctx,l);
  if(["line","curve","french"].includes(l.tool)){ctx.stroke();return;}
  if(l.tool==="polka"){
    ctx.save();try{ctx.clip();const gap=Math.max(.01,l.lineWidth*l.spacing,Math.sqrt(l.width*l.height/900));let count=0;
      for(let y=-l.height/2;y<=l.height/2&&count<1024;y+=gap)for(let x=-l.width/2;x<=l.width/2&&count<1024;x+=gap){ctx.beginPath();ctx.arc(x,y,l.lineWidth/2,0,Math.PI*2);ctx.fill();count++;}
    }finally{ctx.restore();}return;
  }
  if(l.tool==="gradient"){const g=ctx.createLinearGradient(0,-l.height/2,0,l.height/2);g.addColorStop(0,l.color);g.addColorStop(1,l.secondary);ctx.fillStyle=g;}
  if(l.fill)ctx.fill();if(l.stroke)ctx.stroke();
}
export function drawPaintLayer(ctx:CanvasRenderingContext2D,w:number,h:number,layer:PaintLayer,erase=false) {
  const render=()=>{ctx.save();try{
    ctx.translate(layer.x*w,layer.y*h);ctx.rotate(layer.rotation*Math.PI/180);ctx.scale(w*layer.scale,w*layer.scale);ctx.globalAlpha*=layer.opacity;
    if(erase)ctx.globalCompositeOperation="destination-out";
    if(layer.type==="stroke")paintStroke(ctx,layer);else paintShape(ctx,layer);
  }finally{ctx.restore();}};
  render();if(layer.mirror){ctx.save();try{ctx.scale(-1,1);render();}finally{ctx.restore();}}
}

type CacheEntry={art:FingerArt;surface:HTMLCanvasElement;w:number;h:number;light:boolean;brightness:number};
const cache:CacheEntry[]=[];
// Bounded by both count and pixels; no growing per-frame history of surfaces.
const MAX_CACHE_PIXELS=4_000_000;
function artSurface(art:FingerArt,w:number,h:number,light:boolean,brightness:number) {
  // Quantize by 0.1 destination pixel, not by aspect ratio. Blit at 1:1 below:
  // ceil(width)/ceil(height) must not turn a mathematical circle into an ellipse.
  const nw=Math.max(.1,Math.round(w*10)/10),nh=Math.max(.1,Math.round(h*10)/10);
  const bw=Math.ceil(nw)+2*Math.ceil(nw*.08+2),bh=Math.ceil(nh)+2*Math.ceil(nh*.08+2),level=Math.round(brightness*10)/10;
  if(!Number.isFinite(bw*bh)||bw>4096||bh>4096||bw*bh>MAX_CACHE_PIXELS)throw new Error("Paint surface exceeds safety limit");
  const found=cache.find(e=>e.art===art&&e.w===nw&&e.h===nh&&e.light===light&&e.brightness===level);
  if(found){cache.splice(cache.indexOf(found),1);cache.push(found);return found.surface;}
  const surface=document.createElement("canvas"),scratch=document.createElement("canvas");
  surface.width=scratch.width=bw;surface.height=scratch.height=bh;
  const out=surface.getContext("2d"),ink=scratch.getContext("2d");if(!out||!ink)throw new Error("Paint Canvas unavailable");
  const order=artOrder(art),parts=new Map(art.parts.map(p=>[p.id,p])),layers=new Map((art.layers??[]).map(l=>[l.id,l]));
  const erasers=(art.layers??[]).filter(l=>l.type==="stroke"&&l.tool==="eraser");
  const masks=new Map<string,HTMLCanvasElement>(),temporary:HTMLCanvasElement[]=[];
  try {
  // Union later eraser alpha once per suffix instead of replaying every path
  // for every preceding ink object (O(ink*eraser) path rasterization).
  // Bound temporary mask pixels; huge exports use the slower path-only fallback.
  if(erasers.length&&erasers.length*bw*bh<=2_000_000){
    let mask:HTMLCanvasElement|null=null,used=false;
    for(let i=order.length-1;i>=0;i--){
      const l=layers.get(order[i]);if(!l)continue;
      if(l.type==="stroke"&&l.tool==="eraser"){
        if(!mask||used){const next=document.createElement("canvas");temporary.push(next);next.width=bw;next.height=bh;const x=next.getContext("2d");if(!x)throw new Error("Eraser Canvas unavailable");if(mask)x.drawImage(mask,0,0);mask=next;used=false;}
        const x=mask.getContext("2d")!;x.save();try{x.translate(bw/2,bh/2);drawPaintLayer(x,nw,nh,l);}finally{x.restore();}
      }else if(mask){masks.set(l.id,mask);used=true;}
    }
  }
  out.translate(bw/2,bh/2);
  for(let i=0;i<order.length;i++){
    const p=parts.get(order[i]);if(p){drawNailParts(out,nw,nh,[p],light,level);continue;}
    const l=layers.get(order[i]);if(!l||l.type==="stroke"&&l.tool==="eraser")continue;
    ink.clearRect(0,0,bw,bh);ink.save();try{
      ink.translate(bw/2,bh/2);drawPaintLayer(ink,nw,nh,l);
      const mask=masks.get(l.id);
      if(mask){ink.globalCompositeOperation="destination-out";ink.drawImage(mask,-bw/2,-bh/2);}
      else if(!temporary.length)for(let j=i+1;j<order.length;j++){const eraser=layers.get(order[j]);if(eraser?.type==="stroke"&&eraser.tool==="eraser")drawPaintLayer(ink,nw,nh,eraser,true);}
    }finally{ink.restore();}
    out.drawImage(scratch,-bw/2,-bh/2);
  }
  }finally{scratch.width=scratch.height=1;for(const mask of temporary)mask.width=mask.height=1;}
  const entry={art,surface,w:nw,h:nh,light,brightness:level};
  // Replace old sizes for the same art instead of retaining every tracked scale.
  for(let i=cache.length-1;i>=0;i--)if(cache[i].art===art){const [old]=cache.splice(i,1);old.surface.width=old.surface.height=1;}
  if(bw*bh<=MAX_CACHE_PIXELS){cache.push(entry);while(cache.length>6||cache.reduce((n,e)=>n+e.surface.width*e.surface.height,0)>MAX_CACHE_PIXELS){const old=cache.shift()!;old.surface.width=old.surface.height=1;}}
  // Temporary scratch backing memory is explicitly released after composition.
  return surface;
}
export function drawMixedArt(ctx:CanvasRenderingContext2D,w:number,h:number,art:FingerArt,light=false,brightness=.65) {
  if(!art.layers?.length){const parts=art.order?artOrder(art).flatMap(id=>{const p=art.parts.find(p=>p.id===id);return p?[p]:[];}):art.parts;drawNailParts(ctx,w,h,parts,light,brightness);return;}
  // Regenerate vectors at the destination nail resolution, never stretch a small
  // editor screenshot for export. Outer nail/visibility clips stay in force.
  const surface=artSurface(art,w,h,light,brightness);ctx.drawImage(surface,-surface.width/2,-surface.height/2);
}
