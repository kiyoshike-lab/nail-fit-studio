import { nailCanvasGeometry } from "./nailPoseMetrics";
import type { NailDesign } from "./types";
import type { PaintLayer, PaintPoint } from "./paintTypes";
export function paintNailPoseFor(base:NailDesign){
  // Enlarge short/normal nails for fingers while keeping long extensions inside
  // the diagram. This is a view transform only; camera geometry is untouched.
  const scale=Math.min(1,1.6/base.length);
  return {x:50,y:84,width:60*scale,height:48*scale,rotation:0};
}
export function paintGeometry(width:number,height:number,base:NailDesign) {
  return nailCanvasGeometry(paintNailPoseFor(base),width,height,base.length,["square","squoval"].includes(base.shape)?1.05:base.shape==="coffin"?1.1:1);
}
export function clientToPaint(client:PaintPoint,rect:{left:number;top:number;width:number;height:number},size:{width:number;height:number},base:NailDesign):PaintPoint {
  const g=paintGeometry(size.width,size.height,base);
  return {x:((client.x-rect.left)/rect.width*size.width-g.center.x)/g.width,y:((client.y-rect.top)/rect.height*size.height-g.center.y)/g.width};
}
export function layerBounds(l:PaintLayer) {
  if(l.type==="shape")return {x:-l.width/2,y:-l.height/2,width:l.width,height:l.height};
  const xs=l.points.map(p=>p.x),ys=l.points.map(p=>p.y),pad=l.lineWidth/2;
  const x=Math.min(...xs)-pad,y=Math.min(...ys)-pad;
  return {x,y,width:Math.max(.01,Math.max(...xs)+pad-x),height:Math.max(.01,Math.max(...ys)+pad-y)};
}
export function hitPaintLayer(point:PaintPoint,l:PaintLayer,aspect:number) {
  const hit=(p:PaintPoint)=>{
    const dx=p.x-l.x,dy=p.y-l.y*aspect,a=-l.rotation*Math.PI/180;
    const x=(Math.cos(a)*dx-Math.sin(a)*dy)/l.scale,y=(Math.sin(a)*dx+Math.cos(a)*dy)/l.scale,b=layerBounds(l),padding=.06/l.scale;
    return x>=b.x-padding&&x<=b.x+b.width+padding&&y>=b.y-padding&&y<=b.y+b.height+padding;
  };
  return hit(point)||(l.mirror&&hit({x:-point.x,y:point.y}));
}
