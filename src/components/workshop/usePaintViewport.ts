"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clientToPaint, paintGeometry } from "@/lib/paintGeometry";
import { fittedPaintView, initialPaintView, paintViewLayout, viewKeepingAnchor, type PaintView, type PaintViewCommand } from "@/lib/paintViewport";
import type { PaintPoint } from "@/lib/paintTypes";
import type { NailDesign } from "@/lib/types";

type Input={pointerId:number;pointerType:string;clientX:number;clientY:number};
type Options={getCanvas:()=>HTMLCanvasElement|null;getViewport:()=>HTMLDivElement|null;getWorld:()=>HTMLDivElement|null;base:NailDesign;command:PaintViewCommand;getInitialView?:()=>PaintView|undefined;onView?:(v:PaintView)=>void;onZoom:(zoom:number)=>void;cancelPaint:()=>void};
type Navigation={kind:"pan";id:number;anchor:PaintPoint}|{kind:"pinch";anchor:PaintPoint;distance:number;zoom:number};
function pixels(node:HTMLElement,key:string,value:number){const text=`${value}px`;if(node.style.getPropertyValue(key)!==text)node.style.setProperty(key,text);}
export function usePaintViewport(options:Options){
  const {base,command}=options;

  const [raster,setRaster]=useState({width:280,height:448,dpr:1});
  const view=useRef<PaintView>({...initialPaintView,center:{x:0,y:0}});
  const metrics=useRef({width:280,height:280,baseWidth:280,dpr:1});
  const model=useRef(options),lastZoom=useRef(-1),expectedScroll=useRef({x:0,y:0});
  const touches=useRef(new Map<number,PaintPoint>()),navigation=useRef<Navigation|null>(null),navFrame=useRef(0),initialized=useRef(false);
  const actions=useRef<{resize:()=>void;command:(c:PaintViewCommand)=>void;move:()=>void;cancel:()=>void;scroll:()=>void}>({resize:()=>{},command:()=>{},move:()=>{},cancel:()=>{},scroll:()=>{}});
  useLayoutEffect(()=>{model.current=options;});

  function screen(p:PaintPoint){const b=model.current.getViewport()!,r=b.getBoundingClientRect();return{x:p.x-r.left-b.clientLeft,y:p.y-r.top-b.clientTop};}
  function paintPoint(p:PaintPoint){const c=model.current.getCanvas()!;return clientToPaint(p,c.getBoundingClientRect(),{width:c.width,height:c.height},model.current.base);}
  function apply(next:PaintView,settle:boolean){
    const box=model.current.getViewport(),c=model.current.getCanvas(),world=model.current.getWorld();if(!box||!c||!world)return;
    const m=metrics.current,plan=paintViewLayout(next,m,m.baseWidth,model.current.base);
    // Pan changes scrolling only. During pinch, resize the CSS image, NOT the
    // backing store or vector artwork. Regenerate at the final resolution once.
    const width=`${plan.width}px`,height=`${plan.height}px`;
    if(c.style.width!==width)c.style.setProperty("width",width);if(c.style.height!==height)c.style.setProperty("height",height);
    // An explicit scroll world, NOT viewport padding: padding equal to an old
    // portrait height would otherwise stop a flex viewport shrinking on rotation.
    pixels(c,"left",plan.padX);pixels(c,"top",plan.padY);
    pixels(world,"width",plan.width+m.width);pixels(world,"height",plan.height+m.height);
    box.scrollTo({left:plan.left,top:plan.top,behavior:"instant"});
    expectedScroll.current={x:box.scrollLeft,y:box.scrollTop};
    const g=paintGeometry(plan.width,plan.height,model.current.base);
    view.current={...plan.view,center:{x:(box.scrollLeft+m.width/2-plan.padX-g.center.x)/g.width,y:(box.scrollTop+m.height/2-plan.padY-g.center.y)/g.width}};
    if(settle)setRaster(old=>old.width===plan.width&&old.height===plan.height&&old.dpr===m.dpr?old:{width:plan.width,height:plan.height,dpr:m.dpr});
    if(lastZoom.current!==plan.view.zoom){lastZoom.current=plan.view.zoom;model.current.onZoom(plan.view.zoom);}
    model.current.onView?.({...view.current,center:{...view.current.center}});
  }
  function cancel(){cancelAnimationFrame(navFrame.current);navFrame.current=0;touches.current.clear();navigation.current=null;if(initialized.current)apply(view.current,true);}
  function resize(){
    const box=model.current.getViewport();if(!box||box.clientWidth<1||box.clientHeight<1)return;
    const next={width:box.clientWidth,height:box.clientHeight,baseWidth:Math.min(400,box.clientWidth),dpr:Math.min(window.devicePixelRatio||1,2)};
    const changed=Object.keys(next).some(k=>next[k as keyof typeof next]!==metrics.current[k as keyof typeof next]);
    if(changed&&initialized.current){model.current.cancelPaint();cancel();}
    metrics.current=next;initialized.current=true;
    apply(view.current.fit?fittedPaintView(next,next.baseWidth,model.current.base):view.current,true);
  }
  function scroll(){
    const b=model.current.getViewport();if(!b||!initialized.current)return;
    if(Math.abs(b.scrollLeft-expectedScroll.current.x)<1&&Math.abs(b.scrollTop-expectedScroll.current.y)<1)return;
    const m=metrics.current,plan=paintViewLayout(view.current,m,m.baseWidth,model.current.base),g=paintGeometry(plan.width,plan.height,model.current.base);
    view.current={...view.current,fit:false,center:{x:(b.scrollLeft+m.width/2-plan.padX-g.center.x)/g.width,y:(b.scrollTop+m.height/2-plan.padY-g.center.y)/g.width}};
    expectedScroll.current={x:b.scrollLeft,y:b.scrollTop};model.current.onView?.({...view.current,center:{...view.current.center}});
  }
  function runCommand(c:PaintViewCommand){
    model.current.cancelPaint();cancel();const m=metrics.current;
    if(c.action==="fit")apply(fittedPaintView(m,m.baseWidth,model.current.base),true);
    else if(c.action==="actual")apply({zoom:1,center:{x:0,y:0},fit:false},true);
    else apply({...view.current,zoom:view.current.zoom*(c.action==="in"?1.25:1/1.25),fit:false},true);
  }
  function pointerDown(e:Input,pan:boolean){
    if(e.pointerType==="touch"){
      if(touches.current.size>=2)return true;
      touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(touches.current.size===2){
        model.current.cancelPaint();cancelAnimationFrame(navFrame.current);navFrame.current=0;
        const [a,b]=[...touches.current.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        navigation.current={kind:"pinch",anchor:paintPoint(mid),distance:Math.max(8,Math.hypot(a.x-b.x,a.y-b.y)),zoom:view.current.zoom};return true;
      }
    }
    if(pan){navigation.current={kind:"pan",id:e.pointerId,anchor:paintPoint({x:e.clientX,y:e.clientY})};return true;}
    return false;
  }
  function moveNavigation(){
    const n=navigation.current;if(!n)return;const m=metrics.current;
    if(n.kind==="pinch"){
      // A remaining finger after pinch is suppressed until ALL fingers lift.
      if(touches.current.size!==2)return;const[a,b]=[...touches.current.values()];
      apply(viewKeepingAnchor(n.anchor,screen({x:(a.x+b.x)/2,y:(a.y+b.y)/2}),n.zoom*Math.hypot(a.x-b.x,a.y-b.y)/n.distance,m,m.baseWidth,model.current.base),false);
    }else {const p=touches.current.get(n.id);if(p)apply(viewKeepingAnchor(n.anchor,screen(p),view.current.zoom,m,m.baseWidth,model.current.base),false);}
  }
  function pointerMove(e:Input){
    if(touches.current.has(e.pointerId))touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const n=navigation.current;if(!n)return false;
    if(n.kind==="pan"&&n.id===e.pointerId)touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(!navFrame.current)navFrame.current=requestAnimationFrame(()=>{navFrame.current=0;actions.current.move();});return true;
  }
  function pointerEnd(e:Input){
    const n=navigation.current;
    if(n){cancelAnimationFrame(navFrame.current);navFrame.current=0;moveNavigation();}
    touches.current.delete(e.pointerId);
    if(n&&(n.kind==="pan"||touches.current.size===0)){navigation.current=null;apply(view.current,true);}
    return !!n;
  }
  useLayoutEffect(()=>{actions.current={resize,command:runCommand,move:moveNavigation,cancel,scroll};});
  useEffect(()=>{
    const box=model.current.getViewport();if(!box)return;
    const restored=model.current.getInitialView?.();if(restored)view.current={...restored,center:{...restored.center}};
    const inputs=touches.current;
    let resolution:MediaQueryList|null=null;
    const observeResolution=()=>{resolution?.removeEventListener("change",resolutionChanged);resolution=matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);resolution.addEventListener("change",resolutionChanged);};
    const resolutionChanged=()=>{actions.current.resize();observeResolution();};
    const resize=()=>actions.current.resize(),scroll=()=>actions.current.scroll(),blur=()=>{model.current.cancelPaint();actions.current.cancel();};
    const observer=new ResizeObserver(resize);observer.observe(box);window.addEventListener("resize",resize);window.addEventListener("blur",blur);box.addEventListener("scroll",scroll,{passive:true});observeResolution();resize();
    return()=>{observer.disconnect();window.removeEventListener("resize",resize);window.removeEventListener("blur",blur);box.removeEventListener("scroll",scroll);resolution?.removeEventListener("change",resolutionChanged);cancelAnimationFrame(navFrame.current);inputs.clear();navigation.current=null;};
  },[]);
  useEffect(()=>{actions.current.resize();},[base.shape,base.length]);
  const previousCommand=useRef(command.id);
  useEffect(()=>{if(previousCommand.current!==command.id){previousCommand.current=command.id;actions.current.command(command);}},[command]);
  return {raster,pointerDown,pointerMove,pointerEnd,cancel,hasPointer:(id:number)=>touches.current.has(id)||navigation.current?.kind==="pan"&&navigation.current.id===id,busy:()=>navigation.current!==null};
}
