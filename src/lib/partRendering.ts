import type { NailPart } from "./workshopTypes";

const tint=(hex:string,a:number)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`;};
const polygonDirections=new Map([5,8,10].map(n=>[n,Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2-Math.PI/2;return[Math.cos(a),Math.sin(a)];})]));
const facetDirections=new Map([5,8].map(n=>[n,Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n-Math.PI/2,b=(i+1)*Math.PI*2/n-Math.PI/2;return[Math.cos(a),Math.sin(a),Math.cos(b),Math.sin(b)];})]));
const glitterDirections=Array.from({length:12},(_,i)=>({x:Math.sin(i*2.4),y:Math.cos(i*3.7),directions:Array.from({length:4},(_,j)=>{const a=j*Math.PI/2+i*.72;return[Math.cos(a),Math.sin(a)];})}));
function polygon(c:CanvasRenderingContext2D,r:number,n:number,star=false){
  const directions=polygonDirections.get(n)!;
  c.beginPath();for(let i=0;i<n;i++){const rr=star&&i%2?r*.45:r,[cos,sin]=directions[i];
    if(i)c.lineTo(cos*rr,sin*rr);else c.moveTo(cos*rr,sin*rr);}c.closePath();
}

/** Analytic 2D material proxies, not a recovered light field or 3D mesh.
 * No image reads, timers, random frames, blur filters or new backing canvases.
 * Parent nail transforms, masks, layer order and bounded art cache stay intact.
 */
export function drawPartMaterial(c:CanvasRenderingContext2D,r:number,p:NailPart,light:boolean,brightness:number){
  // Same-pose photo A/B did not support replacing these two materials: the
  // candidate flattened petal depth and hid shell ridges. Preserve their former
  // paint contract rather than adopting a merely different-looking material.
  if(p.kind==="flower"||p.kind==="shell"){
    c.fillStyle="rgba(42,24,35,.23)";c.beginPath();c.ellipse(r*.15,r*.4,r,r*.65,0,0,Math.PI*2);c.fill();
    const g=c.createRadialGradient(-r*.3,-r*.35,r*.05,0,0,r*1.15);g.addColorStop(0,"#ffffff");g.addColorStop(.35,p.color);g.addColorStop(1,"#675b70");c.fillStyle=g;
    if(p.kind==="flower"){for(let i=0;i<5;i++){c.save();try{c.rotate(i*Math.PI*2/5);c.beginPath();c.ellipse(0,-r*.5,r*.34,r*.6,0,0,Math.PI*2);c.fill();}finally{c.restore();}}c.fillStyle="#fff1c7";c.beginPath();c.arc(0,0,r*.24,0,Math.PI*2);c.fill();}
    else{c.beginPath();c.moveTo(0,r);c.arc(0,0,r,Math.PI,Math.PI*2);c.closePath();c.fill();c.strokeStyle="rgba(255,255,255,.65)";for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(0,r);c.lineTo(i*r*.42,-r*.7);c.stroke();}}
    c.fillStyle=`rgba(255,255,255,${.55+brightness*.3})`;c.beginPath();c.ellipse(-r*.23,-r*.28,r*.18,r*.09,-.5,0,Math.PI*2);c.fill();return;
  }
  const energy=.35+Math.max(0,Math.min(1,brightness))*.65;
  const pearl=p.kind==="pearl",gel=["heart","gel"].includes(p.kind);
  const metal=["silver-holo","gold-holo","star"].includes(p.kind);
  const glitter=p.kind==="fine-glitter"||p.kind==="chunky-glitter";
  const crystal=p.kind==="crystal",gem=crystal||p.kind==="rhinestone";
  // A narrow contact core plus a faint penumbra; never the former broad dirty
  // oval shared indiscriminately by pearls, flat foil and translucent gel.
  const shadow=c.createRadialGradient(0,r*.25,r*.15,r*.1,r*.28,r*1.1);
  shadow.addColorStop(0,`rgba(32,20,27,${metal||glitter?.08:.22})`);shadow.addColorStop(.55,"rgba(32,20,27,.075)");shadow.addColorStop(1,"rgba(32,20,27,0)");
  c.fillStyle=shadow;c.beginPath();c.ellipse(r*.08,r*.3,r*1.08,r*.72,0,0,Math.PI*2);c.fill();
  const body=c.createRadialGradient(-r*(.22+p.x*.2),-r*.32,r*.03,0,0,r*1.12);
  body.addColorStop(0,pearl?"#fffaf4":"#f9fbff");body.addColorStop(.43,p.color);
  body.addColorStop(.8,pearl?"#b9a9b4":gem?tint("#68778e",crystal?.45:.85):tint(p.color,gel?.4:.86));body.addColorStop(1,pearl?"#827889":tint("#443c50",crystal?.45:gel?.4:.9));
  c.fillStyle=body;
  if(pearl||p.kind==="gel"){
    c.beginPath();c.ellipse(0,0,r,p.kind==="gel"?r*.72:r,0,0,Math.PI*2);c.fill();
    // Soft nacre ring, rather than a second opaque white disc.
    if(pearl&&!light){const rim=c.createLinearGradient(-r,0,r,0);rim.addColorStop(0,"rgba(216,190,219,.18)");rim.addColorStop(.5,"rgba(255,246,225,0)");rim.addColorStop(1,"rgba(185,210,221,.12)");c.strokeStyle=rim;c.lineWidth=r*.08;c.stroke();}
  }else if(p.kind==="heart"){
    c.beginPath();c.moveTo(0,r);c.bezierCurveTo(-r*1.8,0,-r,-r*1.3,0,-r*.45);c.bezierCurveTo(r,-r*1.3,r*1.8,0,0,r);c.fill();
    c.strokeStyle=tint("#fffaf7",.2*energy);c.lineWidth=r*.05;c.stroke();
  }else if(p.kind==="ribbon"){
    for(const side of[-1,1]){c.beginPath();c.moveTo(0,0);c.bezierCurveTo(side*r*.55,-r*.65,side*r*1.35,-r*.85,side*r*1.14,0);c.quadraticCurveTo(side*r*1.15,r*.92,0,0);c.fill();
      c.fillStyle=tint(p.color,.42);c.beginPath();c.moveTo(side*r*.12,0);c.quadraticCurveTo(side*r*.72,-r*.08,side*r*.91,-r*.42);c.quadraticCurveTo(side*r*.95,r*.36,side*r*.12,0);c.fill();c.fillStyle=body;}
    c.beginPath();c.ellipse(0,0,r*.25,r*.34,-.18,0,Math.PI*2);c.fill();
  }else if(glitter){
    const primary=tint(p.color,.45+energy*.35),secondary=tint("#fff3dd",.25+energy*.4);
    for(let i=0;i<(light?5:12);i++){const f=glitterDirections[i],x=f.x*r,y=f.y*r,rr=r*(p.kind==="fine-glitter"?.07:.18)*(1+(i%3)*.15);c.fillStyle=i%3?primary:secondary;c.beginPath();
      for(let j=0;j<4;j++){const [cos,sin]=f.directions[j],px=x+cos*rr,py=y+sin*rr*.65;if(j)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();c.fill();}
  }else{
    polygon(c,r,p.kind==="star"?10:gem?8:5,p.kind==="star");c.fill();
    if(!light&&r>=2.5){const n=gem?8:5;
      for(let i=0;i<n;i++){const [ax,ay,bx,by]=facetDirections.get(n)![i];
        c.fillStyle=metal?`hsla(${p.kind==="gold-holo"?35+i*9:185+i*23},25%,${i%2?84:48}%,${energy*.25})`:tint(i%3===0?"#242c48":"#f3f8ff",(i%3===0?.36:.14+(i%3)*.03)*energy);
        c.beginPath();c.moveTo(-r*.12,-r*.17);c.lineTo(ax*r,ay*r);c.lineTo(bx*r,by*r);c.closePath();c.fill();
      }
      if(gem){polygon(c,r*.43,gem?8:5);c.strokeStyle=tint("#fcfaff",.3*energy);c.lineWidth=r*.04;c.stroke();}
    }
    polygon(c,r*.98,p.kind==="star"?10:gem?8:5,p.kind==="star");c.strokeStyle=tint(metal?"#fff2d6":"#e6edfa",.25*energy);c.lineWidth=r*.035;c.stroke();
  }
  // All materials still have different lobes: pearl broad/weak, crystal tiny,
  // gel elongated. Tiny preview parts omit secondary facets, not placement.
  const highlight=c.createRadialGradient(-r*.25,-r*.32,0,-r*.25,-r*.32,r*(pearl?.43:gel?.28:.18));
  highlight.addColorStop(0,`rgba(255,253,250,${energy*(pearl?.45:gel?.5:.85)})`);highlight.addColorStop(1,"rgba(255,253,250,0)");c.fillStyle=highlight;
  c.beginPath();c.ellipse(-r*.25,-r*.32,r*(pearl?.43:gel?.28:.18),r*(pearl?.35:gel?.12:.14),-.4,0,Math.PI*2);c.fill();
}
