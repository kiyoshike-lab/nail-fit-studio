"use client";
import { useEffect, useRef, useState } from "react";
import { drawNails } from "@/lib/nailRenderer";
import type { DesignDocument } from "@/lib/workshopTypes";
export const diagramNails = [11,30,50,70,89].map(x=>({x,y:84,width:13,height:29,rotation:0}));

export function ArtworkCanvas({document,selectedFinger}:{document:DesignDocument;selectedFinger?:number}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let live=true;
    async function paint(){
      const node=canvas.current;if(!node)return;const context=node.getContext("2d");if(!context)throw new Error("Canvas unavailable");
      const nails=selectedFinger===undefined?diagramNails:[{x:50,y:84,width:45,height:32,rotation:0}];
      const fingers=selectedFinger===undefined?document.fingers:[document.fingers[selectedFinger]];
      await drawNails(context,node.width,node.height,nails,fingers[0].base,{fingers,lightParts:document.detail==="light",clear:true,isCurrent:()=>live});
      if(live)setFailed(false);
    }
    void paint().catch(()=>{if(live)setFailed(true);});return()=>{live=false;};
  },[document,selectedFinger,attempt]);
  return <><canvas ref={canvas} width={selectedFinger===undefined?600:280} height={selectedFinger===undefined?320:360} className="artwork-canvas" role="img" aria-label={selectedFinger===undefined?`${document.name}：5本のデザイン図`:`選択した指のデザイン図`} />{failed&&<div role="alert"><p>デザイン図を描けませんでした。編集内容は保持しています。</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>図の表示を再試行</button></div>}</>;
}
