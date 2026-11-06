"use client";
import { memo, useEffect, useRef, useState, type PointerEvent } from "react";
import { editorMaterials, materialObject, type Material } from "@/lib/editorMaterials";
import { defaultPaintStyle } from "@/lib/paintData";
import { drawPaintLayer } from "@/lib/paintRenderer";
import { drawNailParts } from "@/lib/workshopDrawing";

const MaterialIcon=memo(function MaterialIcon({material}:{material:Material}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const c=canvas.current,x=c?.getContext("2d");if(!c||!x)return;x.clearRect(0,0,96,72);x.save();try{x.translate(48,36);const o=materialObject(material,{x:0,y:0},1,{...defaultPaintStyle,color:"#9c3f61",strokeColor:"#9c3f61",secondary:"#f5c8dc",lineWidth:.035});if("kind"in o)drawNailParts(x,140,140,[{...o,size:.4}],true);else drawPaintLayer(x,100,100,{...o,width:o.tool==="gradient"?.65:o.width,height:o.tool==="gradient"?.5:o.height});}finally{x.restore();}},[material]);
  return <canvas ref={canvas} width={96} height={72} aria-hidden="true"/>;
});
type Props={selected:string|null;onChoose:(id:string)=>void;onDrop:(id:string,client:{x:number;y:number})=>void};
export function MaterialPalette({selected,onChoose,onDrop}:Props){
  const [group,setGroup]=useState<Material["group"]>("基本図形"),[dragging,setDragging]=useState<string|null>(null);
  const ghost=useRef<HTMLDivElement>(null),active=useRef<{id:string;pointer:number;x:number;y:number;lastX:number;lastY:number;moved:boolean}|null>(null),scrollFrame=useRef(0);
  useEffect(()=>()=>{cancelAnimationFrame(scrollFrame.current);active.current=null;},[]);
  function autoScroll(){const a=active.current;if(!a?.moved)return;const dy=a.lastY<95?-8:a.lastY>window.innerHeight-95?8:0;if(dy)window.scrollBy(0,dy);scrollFrame.current=requestAnimationFrame(autoScroll);}
  function down(e:PointerEvent<HTMLButtonElement>,id:string){if(!e.isPrimary||active.current||(e.pointerType==="mouse"&&e.button!==0))return;e.preventDefault();e.currentTarget.focus({preventScroll:true});active.current={id,pointer:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}
  function move(e:PointerEvent<HTMLButtonElement>){const a=active.current;if(!a||a.pointer!==e.pointerId)return;e.preventDefault();a.lastX=e.clientX;a.lastY=e.clientY;if(!a.moved&&Math.hypot(e.clientX-a.x,e.clientY-a.y)>6){a.moved=true;setDragging(a.id);scrollFrame.current=requestAnimationFrame(autoScroll);}if(ghost.current)ghost.current.style.transform=`translate(${e.clientX+16}px,${e.clientY-50}px)`;}
  function finish(e:PointerEvent<HTMLButtonElement>,cancel=false){const a=active.current;if(!a||a.pointer!==e.pointerId)return;active.current=null;cancelAnimationFrame(scrollFrame.current);setDragging(null);if(cancel)return;if(a.moved)onDrop(a.id,{x:e.clientX,y:e.clientY});else onChoose(a.id);}
  return <details className="material-palette" open><summary>素材をドラッグして配置（{editorMaterials.length}種）</summary>
    <p className="hint">素材を爪へドラッグ。難しいときは素材をタップし、爪の置きたい所をタップしてください。キーボードは素材選択後、キャンバスでEnter。</p>
    <div className="workshop-toolbar" role="group" aria-label="素材の分類">{(["基本図形","ネイル模様","立体風装飾"] as const).map(g=><button key={g} type="button" className="secondary" aria-pressed={group===g} onClick={()=>setGroup(g)}>{g}</button>)}</div>
    <div className="material-grid">{editorMaterials.filter(m=>m.group===group).map(m=><button key={m.id} type="button" aria-label={`${m.group}：${m.name}を配置`} aria-pressed={selected===m.id} style={{touchAction:"none"}} onPointerDown={e=>down(e,m.id)} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>{if(active.current?.pointer===e.pointerId)finish(e,true);}} onClick={e=>{if(e.detail===0)onChoose(m.id);}} onKeyDown={e=>{if(e.key==="Escape"){active.current=null;cancelAnimationFrame(scrollFrame.current);setDragging(null);}}}><MaterialIcon material={m}/><span>{m.name}</span></button>)}</div>
    <div ref={ghost} className="material-drag-ghost" hidden={!dragging} aria-hidden="true">{editorMaterials.find(m=>m.id===dragging)?.name??"素材"}</div>
  </details>;
}
