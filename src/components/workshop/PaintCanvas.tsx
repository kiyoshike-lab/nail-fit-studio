"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { buildNailPath, drawNails } from "@/lib/nailRenderer";
import { createLocalId } from "@/lib/storage";
import { appendPoint, artOrder, boundedPoint, makeShape, replacePaintArt } from "@/lib/paintData";
import { clientToPaint, hitPaintLayer, layerBounds, paintGeometry, paintNailPoseFor } from "@/lib/paintGeometry";
import { isStrokeTool, MAX_ERASERS, MAX_FINGER_POINTS, MAX_PAINT_LAYERS, MAX_STROKE_POINTS, type DrawingTool, type PaintLayer, type PaintPoint, type PaintStyle, type StrokeLayer } from "@/lib/paintTypes";
import type { DesignDocument } from "@/lib/workshopTypes";

type Props={document:DesignDocument;finger:number;tool:DrawingTool|"pan";style:PaintStyle;mirror:boolean;zoom:number;resetView:number;guide:boolean;guideDepth:number;selectedId:string|null;onSelect:(id:string|null)=>void;onBegin:()=>void;onPreview:(d:DesignDocument)=>void;onCommit:(d:DesignDocument)=>void;onCancel:()=>void;onNotice:(message:string)=>void;onUndo:()=>void;onRedo:()=>void;onDelete:()=>void};
type Gesture={pointer:number;start:DesignDocument;from:PaintPoint;last:PaintPoint;layer:PaintLayer|null;moving:boolean;mirrorGrab?:boolean;pan?:{x:number;y:number;left:number;top:number};points:PaintPoint[];limit?:number};
export function PaintCanvas(props:Props){
  const {document:doc,finger,tool,style,mirror,zoom,resetView,guide,guideDepth,selectedId,onSelect,onBegin,onPreview,onCommit,onCancel,onNotice,onUndo,onRedo,onDelete}=props;
  const node=useRef<HTMLCanvasElement>(null),viewport=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|null>(null),frame=useRef(0),alive=useRef(true);
  const [cssWidth,setCssWidth]=useState(280),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  const initialScroll=useRef(false),previousZoom=useRef(zoom),previousReset=useRef(resetView);
  const cancelRef=useRef(onCancel);
  useEffect(()=>{cancelRef.current=onCancel;},[onCancel]);
  const art=doc.fingers[finger],width=cssWidth*zoom,height=width*1.6;
  useEffect(()=>{const box=viewport.current;if(!box)return;const resize=()=>{if(box.clientWidth>0)setCssWidth(Math.min(400,box.clientWidth));};const observer=new ResizeObserver(resize);observer.observe(box);resize();return()=>observer.disconnect();},[]);
  useEffect(()=>{const box=viewport.current;if(!box)return;
    if(!initialScroll.current||previousReset.current!==resetView){if(cssWidth!==Math.min(400,box.clientWidth))return;box.scrollTop=box.scrollHeight;box.scrollLeft=(box.scrollWidth-box.clientWidth)/2;initialScroll.current=true;}
    else if(previousZoom.current!==zoom){const ratio=zoom/previousZoom.current;box.scrollLeft=(box.scrollLeft+box.clientWidth/2)*ratio-box.clientWidth/2;box.scrollTop=(box.scrollTop+box.clientHeight/2)*ratio-box.clientHeight/2;}
    previousZoom.current=zoom;previousReset.current=resetView;
  },[cssWidth,zoom,resetView]);
  useEffect(()=>{let current=true;const canvas=node.current;if(!canvas)return;
    const dpr=Math.min(window.devicePixelRatio||1,2),scale=Math.min(dpr,Math.sqrt(4_000_000/(width*height)));
    const backingWidth=Math.max(1,Math.round(width*scale)),backingHeight=Math.max(1,Math.round(height*scale));
    if(canvas.width!==backingWidth)canvas.width=backingWidth;
    if(canvas.height!==backingHeight)canvas.height=backingHeight;
    async function paint(){const ctx=canvas!.getContext("2d");if(!ctx)throw Error("Canvas unavailable");
      await drawNails(ctx,canvas!.width,canvas!.height,[paintNailPoseFor(art.base)],art.base,{fingers:[art],lightParts:doc.detail==="light",clear:true,waitForTexture:false,isCurrent:()=>current});
      if(!current)return;
      if(guide){const g=paintGeometry(canvas!.width,canvas!.height,art.base);ctx.save();try{ctx.translate(g.center.x,g.center.y);buildNailPath(ctx,g.width,g.height,art.base.shape);ctx.clip();ctx.strokeStyle="rgba(111,52,66,.7)";ctx.lineWidth=2*scale;ctx.setLineDash([6*scale,4*scale]);const y=(-.5+guideDepth)*g.height;ctx.beginPath();ctx.moveTo(-g.width*.48,y);ctx.quadraticCurveTo(0,y+g.height*.22,g.width*.48,y);ctx.stroke();}finally{ctx.restore();}}
      const layer=art.layers?.find(l=>l.id===selectedId);
      if(layer){const g=paintGeometry(canvas!.width,canvas!.height,art.base),b=layerBounds(layer);ctx.save();try{ctx.translate(g.center.x+layer.x*g.width,g.center.y+layer.y*g.height);ctx.rotate(layer.rotation*Math.PI/180);ctx.scale(layer.scale,layer.scale);ctx.strokeStyle="#542438";ctx.lineWidth=2*scale/layer.scale;ctx.setLineDash([6*scale,4*scale]);ctx.strokeRect(b.x*g.width,b.y*g.width,b.width*g.width,b.height*g.width);}finally{ctx.restore();}}
      setFailed(false);
    }
    void paint().catch(()=>{if(current)setFailed(true);});return()=>{current=false;};
  },[art,doc.detail,width,height,selectedId,retry,guide,guideDepth]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;cancelAnimationFrame(frame.current);if(gesture.current&&!gesture.current.pan){gesture.current=null;cancelRef.current();}};},[]);
  function point(e:Pick<PointerEvent<HTMLCanvasElement>,"clientX"|"clientY">){const c=node.current!;return boundedPoint(clientToPaint({x:e.clientX,y:e.clientY},c.getBoundingClientRect(),{width:c.width,height:c.height},art.base));}
  function nextDocument(active:Gesture):DesignDocument {
    const f=active.start.fingers[finger],aspect=paintGeometry(node.current!.width,node.current!.height,f.base).height/paintGeometry(node.current!.width,node.current!.height,f.base).width;
    let layer=active.layer!;
    if(active.moving)layer={...layer,x:Math.max(-.7,Math.min(.7,layer.x+(active.last.x-active.from.x)*(active.mirrorGrab?-1:1))),y:Math.max(-.7,Math.min(.7,layer.y+(active.last.y-active.from.y)/aspect))};
    else if(layer.type==="stroke")layer={...layer,points:active.points};
    else layer={...makeShape(layer.tool,active.from,active.last,aspect,layer,layer.mirror),id:layer.id};
    const layers=active.moving?(f.layers??[]).map(l=>l.id===layer.id?layer:l):[...(f.layers??[]),layer];
    return replacePaintArt(active.start,finger,{...f,layers,order:artOrder({...f,layers})});
  }
  function down(e:PointerEvent<HTMLCanvasElement>){
    if(!e.isPrimary||gesture.current||(e.pointerType==="mouse"&&e.button!==0))return;
    if(e.currentTarget.width===0)return;
    const from=point(e),g=paintGeometry(e.currentTarget.width,e.currentTarget.height,art.base),aspect=g.height/g.width;
    e.currentTarget.focus({preventScroll:true});e.preventDefault();
    if(tool==="pan"){gesture.current={pointer:e.pointerId,start:doc,from,last:from,layer:null,moving:false,points:[],pan:{x:e.clientX,y:e.clientY,left:viewport.current!.scrollLeft,top:viewport.current!.scrollTop}};e.currentTarget.setPointerCapture(e.pointerId);return;}
    if(tool!=="select"){
      const ctx=e.currentTarget.getContext("2d");if(!ctx){onNotice("描画領域を準備できません。表示を再試行してください。");return;}
      ctx.save();let inside=false;try{ctx.translate(g.center.x,g.center.y);buildNailPath(ctx,g.width,g.height,art.base.shape);inside=ctx.isPointInPath(g.center.x+from.x*g.width,g.center.y+from.y*g.width);}finally{ctx.restore();}
      if(!inside){onNotice("爪の内側から描き始めてください。");return;}
    }
    let layer:PaintLayer|undefined,moving=false;
    if(tool==="select"){
      const selected=art.layers?.find(l=>l.id===selectedId);
      layer=selected&&hitPaintLayer(from,selected,aspect)?selected:artOrder(art).reverse().map(id=>art.layers?.find(l=>l.id===id)).find(l=>l&&hitPaintLayer(from,l,aspect))??selected;
      if(!layer){onSelect(null);return;}moving=true;onSelect(layer.id);
    }else{
      const layers=art.layers??[];
      if(layers.length>=MAX_PAINT_LAYERS||tool==="eraser"&&layers.filter(l=>l.tool==="eraser").length>=MAX_ERASERS){onNotice("レイヤー上限です。不要なレイヤーを削除してください（手描き32、消しゴム8まで）。");return;}
      if(isStrokeTool(tool)&&layers.reduce((n,l)=>n+(l.type==="stroke"?l.points.length:0),0)>=MAX_FINGER_POINTS-1){onNotice("この指の描画点数の上限です。不要な線を削除してください。");return;}
      layer=isStrokeTool(tool)?{...style,id:createLocalId("stroke"),type:"stroke",tool,x:0,y:0,rotation:0,scale:1,mirror,points:[from]}:makeShape(tool,from,from,aspect,style,mirror);
      onSelect(layer.id);
    }
    const limit=Math.min(MAX_STROKE_POINTS,MAX_FINGER_POINTS-(art.layers??[]).reduce((n,l)=>n+(l.type==="stroke"?l.points.length:0),0));
    const mirrorGrab=!!(moving&&layer.mirror&&!hitPaintLayer(from,{...layer,mirror:false},aspect));
    onBegin();gesture.current={pointer:e.pointerId,start:doc,from,last:from,layer,moving,mirrorGrab,limit,points:layer.type==="stroke"&&!moving?[from]:[]};e.currentTarget.setPointerCapture(e.pointerId);onPreview(nextDocument(gesture.current));
  }
  function move(e:PointerEvent<HTMLCanvasElement>){const active=gesture.current;if(!active||active.pointer!==e.pointerId)return;e.preventDefault();
    if(active.pan){viewport.current!.scrollLeft=active.pan.left+active.pan.x-e.clientX;viewport.current!.scrollTop=active.pan.top+active.pan.y-e.clientY;return;}
    const events=e.nativeEvent.getCoalescedEvents?.()??[];
    for(const event of [...events,e.nativeEvent]){active.last=point(event);if(!active.moving&&active.layer?.type==="stroke")active.points=appendPoint(active.points,active.last,active.limit);}
    if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;if(alive.current&&gesture.current===active)onPreview(nextDocument(active));});
  }
  function finish(e:PointerEvent<HTMLCanvasElement>,cancel=false){const active=gesture.current;if(!active||active.pointer!==e.pointerId)return;
    cancelAnimationFrame(frame.current);frame.current=0;
    if(active.pan){gesture.current=null;return;}
    if(!cancel){active.last=point(e);if(!active.moving&&active.layer?.type==="stroke")active.points=appendPoint(active.points,active.last,active.limit);
      // Center a finished stroke's editable transform without changing its path.
      let next=nextDocument(active);const layers=next.fingers[finger].layers!;
      if(!active.moving&&active.layer?.type==="stroke"){
        const layer=layers.at(-1) as StrokeLayer,b=layerBounds(layer),x=b.x+b.width/2,y=b.y+b.height/2,g=paintGeometry(node.current!.width,node.current!.height,art.base);
        const cx=Math.max(-.7,Math.min(.7,x)),cy=Math.max(-.7,Math.min(.7,y*g.width/g.height));
        next=replacePaintArt(next,finger,{...next.fingers[finger],layers:layers.map(l=>l.id===layer.id?{...layer,x:cx,y:cy,points:layer.points.map(p=>boundedPoint({x:p.x-cx,y:p.y-cy*g.height/g.width}))}:l)});
      }
      onCommit(next);
    }else onCancel();
    gesture.current=null;
  }
  return <><div ref={viewport} className="paint-viewport" aria-label="拡大編集領域">
    <canvas ref={node} className="paint-canvas" role="img" style={{width,height,touchAction:"none"}} tabIndex={0} aria-label="爪に描くキャンバス" onPointerDown={down} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(gesture.current?.pointer===e.pointerId)finish(e,true);}}
      onKeyDown={e=>{if(e.key==="Escape"&&gesture.current){cancelAnimationFrame(frame.current);frame.current=0;gesture.current=null;onCancel();e.preventDefault();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();if(!gesture.current)(e.shiftKey?onRedo:onUndo)();}else if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();if(!gesture.current)onDelete();}}} />
  </div>{failed&&<div role="alert"><p>描画を表示できませんでした。編集内容は保持しています。レイヤーを減らすか再試行してください。</p><button type="button" onClick={()=>setRetry(n=>n+1)}>描画を再試行</button></div>}</>;
}
