import type { NailDesign } from "./types";
import type { NailSurface } from "./surfaceTypes";
import type { SceneLighting } from "./sceneLighting";

const rgba = (hex: string, a: number) => { const n = Number.parseInt(hex.slice(1),16); return `rgba(${n>>16},${n>>8&255},${n&255},${a})`; };
const random = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
function fill(ctx:CanvasRenderingContext2D,w:number,h:number) { ctx.fillRect(-w/2,-h/2,w,h); }

/** All coordinates remain nail-local. Never changes the measured root or fit. */
export function drawGelBase(ctx:CanvasRenderingContext2D,w:number,h:number,d:NailDesign,s:NailSurface) {
  // A transparent pigment layer reveals the original nail, not an invented skin texture.
  const g=ctx.createLinearGradient(0,-h/2,0,h/2);
  g.addColorStop(0,rgba(d.color,s.pigment*.92));g.addColorStop(.32,rgba(d.color,s.pigment));
  g.addColorStop(.82,rgba(d.color,s.pigment*.92));g.addColorStop(1,rgba(d.color,s.pigment*.35));
  ctx.fillStyle=g;fill(ctx,w,h);
  if(s.kind==="milky") { const milk=ctx.createRadialGradient(0,-h*.1,0,0,0,h*.6);milk.addColorStop(0,"rgba(255,250,243,.17)");milk.addColorStop(1,"rgba(255,250,243,0)");ctx.fillStyle=milk;fill(ctx,w,h); }
}

export function drawGelPattern(ctx:CanvasRenderingContext2D,w:number,h:number,d:NailDesign,s:NailSurface) {
  const kind=s.kind,amount=d.tipAmount;
  if(kind==="gradient") { const g=ctx.createLinearGradient(0,-h/2,0,h/2);g.addColorStop(0,rgba(d.tipColor,.95));g.addColorStop(Math.min(.9,.25+amount),rgba(d.tipColor,.2));g.addColorStop(1,rgba(d.tipColor,0));ctx.fillStyle=g;fill(ctx,w,h); }
  if(["french","reverse-french","diagonal-french","half-french"].includes(kind)) {
    ctx.fillStyle=rgba(d.tipColor,.94);ctx.beginPath();
    if(kind==="reverse-french") {const y=h/2-h*amount;ctx.moveTo(-w/2,h/2);ctx.lineTo(-w/2,y);ctx.quadraticCurveTo(0,y+h*.24*s.curve,w/2,y);ctx.lineTo(w/2,h/2);}
    else { const y=-h/2+h*amount;ctx.moveTo(-w/2,-h/2);ctx.lineTo(w/2,-h/2);
      if(kind==="diagonal-french"){ctx.lineTo(w/2,y+h*.15);ctx.lineTo(-w/2,y-h*.15);}
      else {ctx.lineTo(w/2,y);if(kind==="half-french")ctx.lineTo(-w/2,y);else ctx.quadraticCurveTo(0,y-h*.25*s.curve,-w/2,y);}
    }ctx.closePath();ctx.fill();
  }
  if(kind==="mirror"||kind==="chrome") {
    const g=ctx.createLinearGradient(-w/2,-h*.15,w/2,h*.15);
    const stops=kind==="mirror"?[[0,"#212b3b"],[.23,"#e4e6ee"],[.38,"#ffffff"],[.53,"#465367"],[.71,"#bec6d3"],[1,"#2c394c"]] as const:[[0,"#392a1d"],[.12,"#e8d7ab"],[.26,"#77634c"],[.42,"#f7edcd"],[.48,"#fff6e1"],[.54,"#655140"],[.78,"#e5d2a3"],[1,"#534d49"]] as const;
    for(const [t,c]of stops)g.addColorStop(t,rgba(c,.1+s.intensity*.65));ctx.fillStyle=g;fill(ctx,w,h);
  }
  if(kind==="aurora"||kind==="unicorn") {
    const a=s.angle*Math.PI/180,g=ctx.createLinearGradient(-w*Math.cos(a),-h*Math.sin(a),w*Math.cos(a),h*Math.sin(a));
    const colors=kind==="aurora"?["#a8e4e4","#ecb1dd","#eee7a0","#b8c9ee"]:["#ef9ebd","#eac793","#b2e9b0","#91d9df","#c0acf0","#eda3d3"];
    colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),rgba(c,(kind==="aurora"?.18:.4)*(.4+s.intensity))));ctx.fillStyle=g;fill(ctx,w,h);
    if(kind==="unicorn"){ctx.save();try{ctx.rotate(a);ctx.strokeStyle="rgba(255,255,255,.14)";ctx.lineWidth=w*.012;for(let i=-5;i<=5;i++){ctx.beginPath();ctx.moveTo(i*w*.16,-h);ctx.lineTo(i*w*.16,h);ctx.stroke();}}finally{ctx.restore();}}
  }
  if(kind==="magnet"||kind==="cat-eye") {
    ctx.save();try{ctx.scale(w,h);ctx.rotate(s.angle*Math.PI/180);const r=kind==="cat-eye"?.065:.28;
      const g=ctx.createLinearGradient(-r,0,r,0);g.addColorStop(0,"rgba(255,244,218,0)");g.addColorStop(.37,`rgba(225,213,255,${s.intensity*.16})`);g.addColorStop(.5,`rgba(255,246,223,${s.intensity*.7})`);g.addColorStop(.63,`rgba(225,213,255,${s.intensity*.16})`);g.addColorStop(1,"rgba(255,244,218,0)");ctx.fillStyle=g;ctx.fillRect(-r,-2,r*2,4);
    }finally{ctx.restore();}
  }
  if(["magnet","cat-eye","hologram","glitter","flash"].includes(kind)) {
    const holo=kind==="hologram",count=holo?26:kind==="flash"?120:72;
    for(let i=0;i<count;i++) {const x=(random(i*3)-.5)*w,y=(random(i*3+1)-.5)*h,r=w*(holo?.012+.02*s.grain:.003+.013*s.grain)*(holo?1.1:.5+random(i*3+2));
      ctx.fillStyle=holo?`hsla(${Math.round(random(i+900)*360)},65%,78%,${.25+s.intensity*.45})`:rgba(i%3?d.tipColor:"#ffffff",.16+s.intensity*.45);ctx.beginPath();
      if(holo){ctx.moveTo(x-r,y);ctx.lineTo(x,y-r*1.3);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r*1.3);ctx.closePath();}else ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      if(kind==="flash"&&i%13===0){ctx.strokeStyle=rgba("#ffffff",s.intensity*.6);ctx.lineWidth=w*.008;ctx.beginPath();ctx.moveTo(x-r*3,y);ctx.lineTo(x+r*3,y);ctx.moveTo(x,y-r*3);ctx.lineTo(x,y+r*3);ctx.stroke();}
    }
  }
}

/** Stylized, restrained top coat over pigments AND ink. Not a measured BRDF. */
export function drawGelTopcoat(ctx:CanvasRenderingContext2D,w:number,h:number,s:NailSurface,light:SceneLighting,rotation:number,design:NailDesign) {
  ctx.save();try {ctx.scale(w,h);
    const shade=ctx.createLinearGradient(-.5,0,.5,0);
    const depth=.04+design.thickness*.08;
    shade.addColorStop(0,`rgba(42,21,31,${depth})`);shade.addColorStop(.23,"rgba(42,21,31,0)");shade.addColorStop(.76,"rgba(42,21,31,0)");shade.addColorStop(1,`rgba(42,21,31,${depth*.76})`);ctx.fillStyle=shade;ctx.fillRect(-.5,-.5,1,1);
    const diffuse=ctx.createRadialGradient(-.08,-.1,0,0,0,.65);
    diffuse.addColorStop(0,`rgba(255,250,246,${s.roughness*.045*(.4+light.brightness*.6)})`);diffuse.addColorStop(1,"rgba(255,250,246,0)");ctx.fillStyle=diffuse;ctx.fillRect(-.5,-.5,1,1);
    const gloss=s.gloss*(1-s.roughness*.9)*(.45+light.brightness*.55)*(.6+design.realism*.4);
    if(gloss>.005){
      // Stable screen-light proxy projected into nail orientation. It is NOT a
      // recovered light direction or world-space surface normal.
      const x=Math.max(-.22,Math.min(.22,-.13*Math.cos(rotation*Math.PI/180)-.06*Math.sin(rotation*Math.PI/180)));
      ctx.save();ctx.translate(x,-.08);ctx.scale(.48+s.roughness*.65,1);
      const broad=ctx.createRadialGradient(0,0,.015,0,0,.47);broad.addColorStop(0,`rgba(255,${Math.round(253-light.warmth*5)},${Math.round(251-light.warmth*8)},${gloss*.22})`);broad.addColorStop(.55,`rgba(255,255,255,${gloss*.07})`);broad.addColorStop(1,"rgba(255,255,255,0)");ctx.fillStyle=broad;ctx.fillRect(-1,-1,2,2);ctx.restore();
      ctx.save();ctx.translate(x,-.06);ctx.scale(.08+s.roughness*.12,.65);const strip=ctx.createRadialGradient(0,0,0,0,0,.48);strip.addColorStop(0,`rgba(255,255,255,${gloss*.28})`);strip.addColorStop(.5,`rgba(255,255,255,${gloss*.1})`);strip.addColorStop(1,"rgba(255,255,255,0)");ctx.fillStyle=strip;ctx.fillRect(-.5,-.5,1,1);ctx.restore();
    }
    // A short curved root wash, rather than an opaque dark cuticle outline.
    const root=ctx.createLinearGradient(0,.35,0,.5);root.addColorStop(0,"rgba(70,34,40,0)");root.addColorStop(1,"rgba(70,34,40,.035)");ctx.fillStyle=root;ctx.fillRect(-.5,.35,1,.15);
  } finally {ctx.restore();}
}
