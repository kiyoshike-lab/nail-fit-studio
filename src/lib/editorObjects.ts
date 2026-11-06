import { artOrder, layerState, replacePaintArt } from "./paintData";
import { layerBounds, hitPaintLayer } from "./paintGeometry";
import type { PaintLayer, PaintPoint } from "./paintTypes";
import type { DesignDocument, FingerArt, NailPart } from "./workshopTypes";

export type EditorObject=PaintLayer|NailPart;
export function editorObject(art:FingerArt,id:string|null):EditorObject|undefined {return art.layers?.find(l=>l.id===id)??art.parts.find(p=>p.id===id);}
export const objectScale=(o:EditorObject)=>"kind"in o?1:o.scale;
export const objectBounds=(o:EditorObject)=>"kind"in o?{x:-o.size/2,y:-o.size/2,width:o.size,height:o.size}:layerBounds(o);
export function localToNail(p:PaintPoint,o:EditorObject,aspect:number):PaintPoint {
  const a=o.rotation*Math.PI/180,s=objectScale(o);return {x:o.x+s*(p.x*Math.cos(a)-p.y*Math.sin(a)),y:o.y*aspect+s*(p.x*Math.sin(a)+p.y*Math.cos(a))};
}
export function objectHandles(o:EditorObject,aspect:number,gap:number) {
  const b=objectBounds(o),offset=gap/objectScale(o);return {scale:localToNail({x:b.x+b.width+offset*.65,y:b.y+b.height+offset*.65},o,aspect),rotate:localToNail({x:b.x+b.width/2,y:b.y-offset},o,aspect)};
}
export function hitEditorObject(point:PaintPoint,o:EditorObject,aspect:number) {
  if(!("kind"in o))return hitPaintLayer(point,o,aspect);
  const a=-o.rotation*Math.PI/180,dx=point.x-o.x,dy=point.y-o.y*aspect,x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);
  return Math.abs(x)<=o.size/2+.04&&Math.abs(y)<=o.size/2+.04;
}
export function selectableObject(art:FingerArt,point:PaintPoint,aspect:number,selectedId:string|null) {
  const selected=editorObject(art,selectedId);
  const can=(o:EditorObject)=>{const m=layerState(art,o.id);return m.visible&&!m.locked&&hitEditorObject(point,o,aspect);};
  if(selected&&can(selected))return selected;
  return artOrder(art).reverse().map(id=>editorObject(art,id)).find((o):o is EditorObject=>!!o&&can(o));
}
export function replaceEditorObject(doc:DesignDocument,finger:number,o:EditorObject) {
  const art=doc.fingers[finger];return replacePaintArt(doc,finger,{...art,parts:art.parts.map(p=>p.id===o.id?o as NailPart:p),layers:(art.layers??[]).map(l=>l.id===o.id?o as PaintLayer:l)});
}
export function transformObject(o:EditorObject,kind:"move"|"scale"|"rotate",from:PaintPoint,to:PaintPoint,aspect:number,snap=false):EditorObject {
  const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
  if(kind==="move"){let x=clamp(o.x+to.x-from.x,-.7,.7),y=clamp(o.y+(to.y-from.y)/aspect,-.7,.7);if(snap){if(Math.abs(x)<.025)x=0;if(Math.abs(y)<.025)y=0;}return {...o,x,y};}
  const cx=o.x,cy=o.y*aspect;
  if(kind==="rotate"){let angle=o.rotation+(Math.atan2(to.y-cy,to.x-cx)-Math.atan2(from.y-cy,from.x-cx))*180/Math.PI;if(snap)angle=Math.round(angle/15)*15;return {...o,rotation:((angle+540)%360)-180};}
  const ratio=Math.hypot(to.x-cx,to.y-cy)/Math.max(.01,Math.hypot(from.x-cx,from.y-cy));
  return "kind"in o?{...o,size:clamp(o.size*ratio,.06,.6)}:{...o,scale:clamp(o.scale*ratio,.1,3)};
}
