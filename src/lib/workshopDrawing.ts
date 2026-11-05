import type { FingerArt, NailPart } from "./workshopTypes";

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

function polygon(ctx:CanvasRenderingContext2D,r:number,sides:number,star=false) {
  ctx.beginPath();for(let i=0;i<sides;i++){const angle=i/sides*Math.PI*2-Math.PI/2,rad=star&&i%2?r*.45:r;const x=Math.cos(angle)*rad,y=Math.sin(angle)*rad;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();
}

// Authored procedural shapes, no downloaded textures or external 3D libraries.
// All units are relative to the fitted nail, not screen pixels. The caller's
// existing nail/partial-visibility clip also clips the decoration and its shadow.
export function drawNailParts(ctx:CanvasRenderingContext2D,w:number,h:number,parts:readonly NailPart[],light=false,brightness=.65) {
  for(const p of parts){
    ctx.save();
    try{
      ctx.translate(p.x*w,p.y*h);ctx.rotate(p.rotation*Math.PI/180);const r=p.size*w*.5;
      ctx.fillStyle="rgba(42,24,35,.23)";ctx.beginPath();ctx.ellipse(r*.15,r*.4,r,r*.65,0,0,Math.PI*2);ctx.fill();
      const g=ctx.createRadialGradient(-r*.3,-r*.35,r*.05,0,0,r*1.15);g.addColorStop(0,"#ffffff");g.addColorStop(.35,p.color);g.addColorStop(1,"#675b70");ctx.fillStyle=g;
      if(p.kind==="pearl"||p.kind==="gel"){ctx.beginPath();ctx.ellipse(0,0,r,p.kind==="gel"?r*.72:r,0,0,Math.PI*2);ctx.fill();}
      else if(p.kind==="heart"){ctx.beginPath();ctx.moveTo(0,r);ctx.bezierCurveTo(-r*1.8,0,-r,-r*1.3,0,-r*.45);ctx.bezierCurveTo(r,-r*1.3,r*1.8,0,0,r);ctx.fill();}
      else if(p.kind==="ribbon"){for(const side of[-1,1]){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(side*r,-r*.7);ctx.quadraticCurveTo(side*r*1.4,0,side*r,r*.7);ctx.closePath();ctx.fill();}ctx.beginPath();ctx.arc(0,0,r*.25,0,Math.PI*2);ctx.fill();}
      else if(p.kind==="flower"){for(let i=0;i<5;i++){ctx.save();try{ctx.rotate(i*Math.PI*2/5);ctx.beginPath();ctx.ellipse(0,-r*.5,r*.34,r*.6,0,0,Math.PI*2);ctx.fill();}finally{ctx.restore();}}ctx.fillStyle="#fff1c7";ctx.beginPath();ctx.arc(0,0,r*.24,0,Math.PI*2);ctx.fill();}
      else if(p.kind==="shell"){ctx.beginPath();ctx.moveTo(0,r);ctx.arc(0,0,r,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();ctx.strokeStyle="rgba(255,255,255,.65)";for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(0,r);ctx.lineTo(i*r*.42,-r*.7);ctx.stroke();}}
      else if(p.kind==="fine-glitter"||p.kind==="chunky-glitter"){const count=light?5:12;for(let i=0;i<count;i++){const x=Math.sin(i*2.4)*r,y=Math.cos(i*3.7)*r;ctx.fillStyle=i%2?p.color:"#fff8ec";ctx.beginPath();ctx.arc(x,y,r*(p.kind==="fine-glitter"?.08:.2),0,Math.PI*2);ctx.fill();}}
      else {polygon(ctx,r,p.kind==="star"?10:p.kind.includes("holo")?5:8,p.kind==="star");ctx.fill();if(!light){for(let i=0;i<6;i++){ctx.fillStyle=`rgba(${i%2?255:120},${i%3?240:170},255,${.12+brightness*.2})`;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(i*Math.PI/3)*r,Math.sin(i*Math.PI/3)*r);ctx.lineTo(Math.cos((i+1)*Math.PI/3)*r,Math.sin((i+1)*Math.PI/3)*r);ctx.closePath();ctx.fill();}}}
      ctx.fillStyle=`rgba(255,255,255,${.55+brightness*.3})`;ctx.beginPath();ctx.ellipse(-r*.23,-r*.28,r*.18,r*.09,-.5,0,Math.PI*2);ctx.fill();
    } finally{ctx.restore();}
  }
}
