"use client";
import{useEffect,useLayoutEffect,useRef,useState}from"react";
import type{DesignDocument}from"@/lib/workshopTypes";
import{saveWorkshopRecovery}from"@/lib/workshopRecovery";
type Options={document:DesignDocument;checkpoint:DesignDocument|null;isInteracting:()=>boolean};
export function useWorkshopRecovery(options:Options){
  const latest=useRef(options),[backedUp,setBackedUp]=useState<DesignDocument|null>(null),[failed,setFailed]=useState<DesignDocument|null>(null);
  useLayoutEffect(()=>{latest.current=options;});
  const dirty=options.document!==options.checkpoint;
  useEffect(()=>{
    if(!dirty)return;let timer=0;
    const tick=()=>{const o=latest.current;if(o.document===o.checkpoint)return;
      if(o.isInteracting()){timer=window.setTimeout(tick,150);return;}
      if(saveWorkshopRecovery(o.document)){setBackedUp(o.document);setFailed(null);}else setFailed(o.document);
    };timer=window.setTimeout(tick,900);return()=>clearTimeout(timer);
  },[options.document,options.checkpoint,dirty]);
  useEffect(()=>{
    const flush=()=>{const o=latest.current;return o.document===o.checkpoint||saveWorkshopRecovery(o.document);};
    // Do not promise a normal collection save. A successful local recovery makes
    // leaving safe; warn only if that fallback also fails.
    const unload=(e:BeforeUnloadEvent)=>{if(!flush()){e.preventDefault();e.returnValue="";}};
    const hidden=()=>{if(document.visibilityState==="hidden")flush();};
    window.addEventListener("beforeunload",unload);window.addEventListener("pagehide",flush);document.addEventListener("visibilitychange",hidden);
    return()=>{window.removeEventListener("beforeunload",unload);window.removeEventListener("pagehide",flush);document.removeEventListener("visibilitychange",hidden);flush();};
  },[]);
  return{dirty,status:!dirty?"clean":failed===options.document?"failed":backedUp===options.document?"backed-up":"pending",discard:()=>{latest.current={...latest.current,checkpoint:latest.current.document};}};
}
