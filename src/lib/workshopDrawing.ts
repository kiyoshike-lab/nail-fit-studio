import type { FingerArt, NailPart } from "./workshopTypes";
import { drawPartMaterial } from "./partRendering";

export function drawSurfaceEffect(ctx:CanvasRenderingContext2D,w:number,h:number,art:FingerArt) {
  if(art.effect==="none" && !["marble","floral"].includes(art.base.pattern)) return;
  ctx.save();
  try {
    ctx.strokeStyle=art.base.motifColor;ctx.fillStyle=art.base.motifColor;ctx.lineWidth=w*.035;
    if(art.base.pattern==="marble") {
      ctx.globalAlpha*=.6;
      for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*w*.3-w*.15,-h*.55);ctx.bezierCurveTo(i*w*.3+w*.3,-h*.12,i*w*.3-w*.3,h*.05,i*w*.3+w*.12,h*.55);ctx.stroke();}
    }
    if(art.base.pattern==="floral") {
      for(const [x,y] of [[-.2,-.22],[.18,.15]]){
        for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.ellipse(x*w+Math.cos(a)*w*.075,y*h+Math.sin(a)*w*.075,w*.05,w*.035,a,0,Math.PI*2);ctx.fill();}
      }
    }
    if(art.effect==="dots") for(let row=0;row<5;row++) for(let col=0;col<3;col++){ctx.beginPath();ctx.arc((col-1)*w*.26,(row-2)*h*.16,w*.035,0,Math.PI*2);ctx.fill();}
    if(art.effect==="lines") for(let line=-1;line<=1;line++){ctx.beginPath();ctx.moveTo(-w*.5,line*h*.22-h*.1);ctx.lineTo(w*.5,line*h*.22+h*.1);ctx.stroke();}
    if(art.effect==="magnetic") {const g=ctx.createLinearGradient(-w*.5,-h*.2,w*.5,h*.2);g.addColorStop(0,"transparent");g.addColorStop(.45,"rgba(255,255,255,.04)");g.addColorStop(.55,"rgba(255,255,255,.8)");g.addColorStop(.72,"rgba(255,255,255,.1)");g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.fillRect(-w/2,-h/2,w,h);}
  } finally {ctx.restore();}
}

// Parent transforms remain nail-local; the current nail/visibility mask clips
// materials and contact shadows, including partially visible curled nails.
export function drawNailParts(ctx:CanvasRenderingContext2D,w:number,h:number,parts:readonly NailPart[],light=false,brightness=.65) {
  for(const p of parts){ctx.save();try{
    ctx.translate(p.x*w,p.y*h);ctx.rotate(p.rotation*Math.PI/180);
    drawPartMaterial(ctx,p.size*w*.5,p,light,brightness);
  }finally{ctx.restore();}}
}
