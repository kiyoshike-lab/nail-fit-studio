import { paintGeometry } from "./paintGeometry";
import type { PaintPoint } from "./paintTypes";
import type { NailDesign } from "./types";

// View state is transient UI data, NEVER part of DesignDocument or a trial pose.
export type PaintView = { zoom:number; center:PaintPoint; fit:boolean };
export type PaintViewCommand = { id:number; action:"in"|"out"|"actual"|"fit" };
export type ViewSize = { width:number; height:number };
export const MIN_PAINT_ZOOM=.1, MAX_PAINT_ZOOM=3;
export const initialPaintView:PaintView={zoom:1,center:{x:0,y:0},fit:true};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const boundedZoom=(zoom:number)=>clamp(Number.isFinite(zoom)?zoom:1,MIN_PAINT_ZOOM,MAX_PAINT_ZOOM);
export function fittedPaintView(size:ViewSize,baseWidth:number,base:NailDesign):PaintView {
  const g=paintGeometry(baseWidth,baseWidth*1.6,base);
  // Includes the longest tip (.54h), root (.5h), side curves and a handle margin.
  const zoom=boundedZoom(Math.min(Math.max(1,size.width-40)/(g.width*1.12),Math.max(1,size.height-40)/(g.height*1.12)));
  return {zoom,center:{x:0,y:0},fit:true};
}
export function paintViewLayout(view:PaintView,size:ViewSize,baseWidth:number,base:NailDesign){
  const zoom=boundedZoom(view.zoom),width=baseWidth*zoom,height=width*1.6,g=paintGeometry(width,height,base);
  // A half-viewport gutter lets BOTH ends of even a small canvas be centered.
  // Native scrolling remains bounded: the canvas cannot disappear indefinitely.
  const padX=size.width/2,padY=size.height/2;
  const left=clamp(padX+g.center.x+view.center.x*g.width-size.width/2,0,width),top=clamp(padY+g.center.y+view.center.y*g.width-size.height/2,0,height);
  return {width,height,padX,padY,left,top,view:{...view,zoom,center:{x:(left+size.width/2-padX-g.center.x)/g.width,y:(top+size.height/2-padY-g.center.y)/g.width}}};
}
export function paintPointAtViewPoint(view:PaintView,screen:PaintPoint,size:ViewSize,baseWidth:number,base:NailDesign):PaintPoint {
  const g=paintGeometry(baseWidth*view.zoom,baseWidth*view.zoom*1.6,base);
  return {x:view.center.x+(screen.x-size.width/2)/g.width,y:view.center.y+(screen.y-size.height/2)/g.width};
}
export function viewKeepingAnchor(anchor:PaintPoint,screen:PaintPoint,zoom:number,size:ViewSize,baseWidth:number,base:NailDesign):PaintView {
  zoom=boundedZoom(zoom);const g=paintGeometry(baseWidth*zoom,baseWidth*zoom*1.6,base);
  return {zoom,fit:false,center:{x:anchor.x+(size.width/2-screen.x)/g.width,y:anchor.y+(size.height/2-screen.y)/g.width}};
}
