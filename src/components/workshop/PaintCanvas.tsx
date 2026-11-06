"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { buildNailPath, drawNails } from "@/lib/nailRenderer";
import { createLocalId } from "@/lib/storage";
import { appendPoint, artOrder, boundedPoint, layerState, makeShape, replacePaintArt } from "@/lib/paintData";
import { clientToPaint, hitPaintLayer, layerBounds, paintGeometry, paintNailPoseFor } from "@/lib/paintGeometry";
import { editorObject, objectBounds, objectHandles, objectScale, replaceEditorObject, selectableObject, transformObject, type EditorObject } from "@/lib/editorObjects";
import { isStrokeTool, MAX_ERASERS, MAX_FINGER_POINTS, MAX_PAINT_LAYERS, MAX_STROKE_POINTS, type DrawingTool, type PaintLayer, type PaintPoint, type PaintStyle, type StrokeLayer } from "@/lib/paintTypes";
import type { DesignDocument } from "@/lib/workshopTypes";

type Props={document:DesignDocument;finger:number;tool:DrawingTool|"pan";style:PaintStyle;mirror:boolean;zoom:number;resetView:number;guide:boolean;guideDepth:number;selectedId:string|null;material:string|null;snap:boolean;grid:boolean;onPlace:(id:string,point:PaintPoint)=>void;onSelect:(id:string|null)=>void;onBegin:()=>void;onPreview:(d:DesignDocument)=>void;onCommit:(d:DesignDocument)=>void;onCancel:()=>void;onNotice:(message:string)=>void;onUndo:()=>void;onRedo:()=>void;onDelete:()=>void;onCopy:()=>void;onPaste:()=>void};
type Gesture={pointer:number;start:DesignDocument;from:PaintPoint;last:PaintPoint;layer:PaintLayer|null;object?:EditorObject;action?:"move"|"scale"|"rotate";snap?:boolean;moving:boolean;mirrorGrab?:boolean;pan?:{x:number;y:number;left:number;top:number};points:PaintPoint[];limit?:number};

// CSS scroll/zoom and backing DPR are consumed exactly once. Reject drops
// outside the visible viewport or real nail path instead of silently clamping.
export function canvasDropPoint(canvas:HTMLCanvasElement,client:PaintPoint,base:DesignDocument["fingers"][number]["base"]):PaintPoint|null {
  const r=canvas.getBoundingClientRect(),v=canvas.parentElement!.getBoundingClientRect();
  if(client.x<Math.max(r.left,v.left)||client.x>Math.min(r.right,v.right)||client.y<Math.max(r.top,v.top)||client.y>Math.min(r.bottom,v.bottom))return null;
  const point=clientToPaint(client,r,{width:canvas.width,height:canvas.height},base),g=paintGeometry(canvas.width,canvas.height,base),ctx=canvas.getContext("2d");if(!ctx)return null;
  ctx.save();try{ctx.translate(g.center.x,g.center.y);buildNailPath(ctx,g.width,g.height,base.shape);return ctx.isPointInPath(g.center.x+point.x*g.width,g.center.y+point.y*g.width)?point:null;}finally{ctx.restore();}
}

export function PaintCanvas(props:Props){
  const {document:doc,finger,tool,style,mirror,zoom,resetView,guide,guideDepth,selectedId,material,snap,grid,onPlace,onSelect,onBegin,onPreview,onCommit,onCancel,onNotice,onUndo,onRedo,onDelete,onCopy,onPaste}=props;
  const node=useRef<HTMLCanvasElement>(null),viewport=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|null>(null),frame=useRef(0),alive=useRef(true);
  const [cssWidth,setCssWidth]=useState(280),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  const initialScroll=useRef(false),previousZoom=useRef(zoom),previousReset=useRef(resetView),cancelRef=useRef(onCancel);
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
    const bw=Math.max(1,Math.round(width*scale)),bh=Math.max(1,Math.round(height*scale));
    if(canvas.width!==bw)canvas.width=bw;if(canvas.height!==bh)canvas.height=bh;
    async function paint(){const ctx=canvas!.getContext("2d");if(!ctx)throw Error("Canvas unavailable");
      await drawNails(ctx,canvas!.width,canvas!.height,[paintNailPoseFor(art.base)],art.base,{fingers:[art],lightParts:doc.detail==="light",clear:true,waitForTexture:false,isCurrent:()=>current});
      if(!current)return;
      const g=paintGeometry(canvas!.width,canvas!.height,art.base);
      if(guide||grid||snap){ctx.save();try{ctx.translate(g.center.x,g.center.y);buildNailPath(ctx,g.width,g.height,art.base.shape);ctx.clip();ctx.strokeStyle="rgba(111,52,66,.6)";ctx.lineWidth=scale;ctx.setLineDash([6*scale,4*scale]);
        if(grid){for(let x=-.5;x<=.5;x+=.1){ctx.beginPath();ctx.moveTo(x*g.width,-g.height/2);ctx.lineTo(x*g.width,g.height/2);ctx.stroke();}for(let y=-.5;y<=.5;y+=.1){ctx.beginPath();ctx.moveTo(-g.width/2,y*g.height);ctx.lineTo(g.width/2,y*g.height);ctx.stroke();}}
        if(snap){ctx.beginPath();ctx.moveTo(0,-g.height/2);ctx.lineTo(0,g.height/2);ctx.stroke();}
        if(guide){const y=(-.5+guideDepth)*g.height;ctx.beginPath();ctx.moveTo(-g.width*.48,y);ctx.quadraticCurveTo(0,y+g.height*.22,g.width*.48,y);ctx.stroke();}
      }finally{ctx.restore();}}
      const object=editorObject(art,selectedId);
      if(object&&layerState(art,object.id).visible){const b=objectBounds(object),s=objectScale(object),cssScale=canvas!.width/width;
        ctx.save();try{ctx.translate(g.center.x+object.x*g.width,g.center.y+object.y*g.height);ctx.rotate(object.rotation*Math.PI/180);ctx.scale(s,s);ctx.strokeStyle="#542438";ctx.lineWidth=2*cssScale/s;ctx.setLineDash([6*cssScale/s,4*cssScale/s]);ctx.strokeRect(b.x*g.width,b.y*g.width,b.width*g.width,b.height*g.width);}finally{ctx.restore();}
        if(!layerState(art,object.id).locked){const handles=objectHandles(object,g.height/g.width,28*cssScale/g.width);ctx.save();try{ctx.setLineDash([]);ctx.strokeStyle="#542438";ctx.fillStyle="#fff";ctx.lineWidth=2*cssScale;for(const [kind,p]of Object.entries(handles)){const x=g.center.x+p.x*g.width,y=g.center.y+p.y*g.width;ctx.beginPath();if(kind==="rotate")ctx.arc(x,y,10*cssScale,0,Math.PI*2);else ctx.rect(x-10*cssScale,y-10*cssScale,20*cssScale,20*cssScale);ctx.fill();ctx.stroke();}}finally{ctx.restore();}}
      }
      setFailed(false);
    }
    void paint().catch(()=>{if(current)setFailed(true);});return()=>{current=false;};
  },[art,doc.detail,width,height,selectedId,retry,guide,guideDepth,grid,snap]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;cancelAnimationFrame(frame.current);if(gesture.current&&!gesture.current.pan){gesture.current=null;cancelRef.current();}};},[]);
  function point(e:Pick<PointerEvent<HTMLCanvasElement>,"clientX"|"clientY">){const c=node.current!;return boundedPoint(clientToPaint({x:e.clientX,y:e.clientY},c.getBoundingClientRect(),{width:c.width,height:c.height},art.base));}
  function nextDocument(active:Gesture):DesignDocument {
    const f=active.start.fingers[finger],g=paintGeometry(node.current!.width,node.current!.height,f.base),aspect=g.height/g.width;
    if(active.object){const last=active.mirrorGrab?{x:active.from.x-(active.last.x-active.from.x),y:active.last.y}:active.last;return replaceEditorObject(active.start,finger,transformObject(active.object,active.action??"move",active.from,last,aspect,active.snap));}
    let layer=active.layer!;
    if(layer.type==="stroke")layer={...layer,points:active.points};else layer={...makeShape(layer.tool,active.from,active.last,aspect,layer,layer.mirror),id:layer.id};
    const layers=[...(f.layers??[]),layer];return replacePaintArt(active.start,finger,{...f,layers,order:artOrder({...f,layers})});
  }
  function down(e:PointerEvent<HTMLCanvasElement>){
    if(!e.isPrimary||gesture.current||(e.pointerType==="mouse"&&e.button!==0)||e.currentTarget.width===0)return;
    const from=point(e),g=paintGeometry(e.currentTarget.width,e.currentTarget.height,art.base),aspect=g.height/g.width;
    e.currentTarget.focus({preventScroll:true});e.preventDefault();
    if(material){const p=canvasDropPoint(e.currentTarget,{x:e.clientX,y:e.clientY},art.base);if(p)onPlace(material,p);else onNotice("爪の内側をタップしてください。");return;}
    if(tool==="pan"){gesture.current={pointer:e.pointerId,start:doc,from,last:from,layer:null,moving:false,points:[],pan:{x:e.clientX,y:e.clientY,left:viewport.current!.scrollLeft,top:viewport.current!.scrollTop}};e.currentTarget.setPointerCapture(e.pointerId);return;}
    if(tool!=="select"&&!canvasDropPoint(e.currentTarget,{x:e.clientX,y:e.clientY},art.base)){onNotice("爪の内側から描き始めてください。");return;}
    let layer:PaintLayer|null=null,object:EditorObject|undefined,action:"move"|"scale"|"rotate"="move",mirrorGrab=false;
    if(tool==="select"){
      const selected=editorObject(art,selectedId),cssNail=g.width/e.currentTarget.width*e.currentTarget.getBoundingClientRect().width;
      if(selected&&layerState(art,selected.id).visible&&!layerState(art,selected.id).locked){const h=objectHandles(selected,aspect,28/cssNail),radius=e.pointerType==="touch"?22:14;for(const kind of["rotate","scale"] as const)if(Math.hypot(from.x-h[kind].x,from.y-h[kind].y)<=radius/cssNail){object=selected;action=kind;break;}}
      object??=selectableObject(art,from,aspect,selectedId);
      if(!object){onSelect(null);return;}onSelect(object.id);
      mirrorGrab=action==="move"&&!("kind"in object)&&object.mirror&&!hitPaintLayer(from,{...object,mirror:false},aspect);
    }else{
      const layers=art.layers??[];
      if(layers.length>=MAX_PAINT_LAYERS||tool==="eraser"&&layers.filter(l=>l.tool==="eraser").length>=MAX_ERASERS){onNotice("レイヤー上限です。不要なレイヤーを削除してください（手描き32、消しゴム8まで）。");return;}
      if(isStrokeTool(tool)&&layers.reduce((n,l)=>n+(l.type==="stroke"?l.points.length:0),0)>=MAX_FINGER_POINTS-1){onNotice("この指の描画点数の上限です。不要な線を削除してください。");return;}
      layer=isStrokeTool(tool)?{...style,id:createLocalId("stroke"),type:"stroke",tool,x:0,y:0,rotation:0,scale:1,mirror,points:[from]}:makeShape(tool,from,from,aspect,style,mirror);onSelect(layer.id);
    }
    const limit=Math.min(MAX_STROKE_POINTS,MAX_FINGER_POINTS-(art.layers??[]).reduce((n,l)=>n+(l.type==="stroke"?l.points.length:0),0));
    onBegin();gesture.current={pointer:e.pointerId,start:doc,from,last:from,layer,object,action,snap,mirrorGrab,moving:!!object,limit,points:layer?.type==="stroke"?[from]:[]};e.currentTarget.setPointerCapture(e.pointerId);onPreview(nextDocument(gesture.current));
  }
  function move(e:PointerEvent<HTMLCanvasElement>){const active=gesture.current;if(!active||active.pointer!==e.pointerId)return;e.preventDefault();
    if(active.pan){viewport.current!.scrollLeft=active.pan.left+active.pan.x-e.clientX;viewport.current!.scrollTop=active.pan.top+active.pan.y-e.clientY;return;}
    active.snap=snap||e.shiftKey;
    for(const event of [...(e.nativeEvent.getCoalescedEvents?.()??[]),e.nativeEvent]){active.last=point(event);if(!active.moving&&active.layer?.type==="stroke")active.points=appendPoint(active.points,active.last,active.limit);}
    if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;if(alive.current&&gesture.current===active)onPreview(nextDocument(active));});
  }
  function finish(e:PointerEvent<HTMLCanvasElement>,cancel=false){const active=gesture.current;if(!active||active.pointer!==e.pointerId)return;cancelAnimationFrame(frame.current);frame.current=0;
    if(active.pan){gesture.current=null;return;}
    if(!cancel){active.last=point(e);if(!active.moving&&active.layer?.type==="stroke")active.points=appendPoint(active.points,active.last,active.limit);
      let next=nextDocument(active);const layers=next.fingers[finger].layers!;
      if(!active.moving&&active.layer?.type==="stroke"){
        const l=layers.at(-1) as StrokeLayer,b=layerBounds(l),x=b.x+b.width/2,y=b.y+b.height/2,g=paintGeometry(node.current!.width,node.current!.height,art.base),cx=Math.max(-.7,Math.min(.7,x)),cy=Math.max(-.7,Math.min(.7,y*g.width/g.height));
        next=replacePaintArt(next,finger,{...next.fingers[finger],layers:layers.map(p=>p.id===l.id?{...l,x:cx,y:cy,points:l.points.map(p=>boundedPoint({x:p.x-cx,y:p.y-cy*g.height/g.width}))}:p)});
      }onCommit(next);
    }else onCancel();gesture.current=null;
  }
  function nudge(key:string,alt:boolean,shift:boolean){const o=editorObject(art,selectedId);if(!o||layerState(art,o.id).locked)return;
    let next:EditorObject=o;const step=shift?.02:.005,clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
    if(alt&&key.startsWith("Arrow"))next={...o,rotation:clamp(o.rotation+(key==="ArrowLeft"||key==="ArrowDown"?-1:1)*(shift?15:1),-180,180)};
    else if(key.startsWith("Arrow"))next={...o,x:clamp(o.x+(key==="ArrowLeft"?-step:key==="ArrowRight"?step:0),-.7,.7),y:clamp(o.y+(key==="ArrowUp"?-step:key==="ArrowDown"?step:0),-.7,.7)};
    else if(key==="+"||key==="-"||key==="="){const ratio=key==="-"?.95:1.05;next="kind"in o?{...o,size:clamp(o.size*ratio,.06,.6)}:{...o,scale:clamp(o.scale*ratio,.1,3)};}
    onCommit(replaceEditorObject(doc,finger,next));
  }
  function cancelGesture(){const active=gesture.current;if(!active)return;cancelAnimationFrame(frame.current);frame.current=0;gesture.current=null;if(!active.pan)onCancel();}
  return <><div ref={viewport} className="paint-viewport" aria-label="拡大編集領域"><canvas ref={node} className="paint-canvas" role="img" style={{width,height,touchAction:"none"}} tabIndex={0} aria-label="爪に描くキャンバス" onPointerDown={down} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onBlur={cancelGesture} onLostPointerCapture={e=>{if(gesture.current?.pointer===e.pointerId)finish(e,true);}}
    onKeyDown={e=>{const command=e.ctrlKey||e.metaKey;if(e.key==="Escape"){if(gesture.current)cancelGesture();else onSelect(null);e.preventDefault();return;}if(gesture.current)return;
      if(command&&e.key.toLowerCase()==="z"){e.preventDefault();(e.shiftKey?onRedo:onUndo)();}
      else if(command&&e.key.toLowerCase()==="c"){e.preventDefault();onCopy();}else if(command&&e.key.toLowerCase()==="v"){e.preventDefault();onPaste();}
      else if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();onDelete();}
      else if(e.key==="Enter"&&material){e.preventDefault();onPlace(material,{x:0,y:0});}
      else if(e.key.startsWith("Arrow")||["+","-","="].includes(e.key)){e.preventDefault();nudge(e.key,e.altKey,e.shiftKey);}}}/></div>
    <p className="hint">選択後：四角いハンドルで拡縮、丸いハンドルで回転。矢印で微調整、Alt+矢印で回転、+/-で拡縮、Ctrl/⌘+C・Vでコピー・貼り付け。Shiftで大きく移動/15度回転。</p>
    {failed&&<div role="alert"><p>描画を表示できませんでした。編集内容は保持しています。レイヤーを減らすか再試行してください。</p><button type="button" onClick={()=>setRetry(n=>n+1)}>描画を再試行</button></div>}</>;
}
