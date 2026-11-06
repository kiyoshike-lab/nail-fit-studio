"use client";
import { useEffect, useRef } from "react";

/** Optional, in-place focus mode. Never remounts Canvas/video/tracking. */
export function usePaintFocus(focused:boolean,onExit:()=>void){
  const root=useRef<HTMLElement>(null);
  useEffect(()=>{
    const update=()=>{const node=root.current,v=window.visualViewport;if(!node)return;
      node.style.setProperty("--paint-visible-height",`${v?.height??innerHeight}px`);
      node.style.setProperty("--paint-visible-width",`${v?.width??innerWidth}px`);
      node.style.setProperty("--paint-visible-top",`${v?.offsetTop??0}px`);
      node.style.setProperty("--paint-visible-left",`${v?.offsetLeft??0}px`);
    };update();window.addEventListener("resize",update);window.visualViewport?.addEventListener("resize",update);window.visualViewport?.addEventListener("scroll",update);
    return()=>{window.removeEventListener("resize",update);window.visualViewport?.removeEventListener("resize",update);window.visualViewport?.removeEventListener("scroll",update);};
  },[root]);
  useEffect(()=>{
    if(!focused||!root.current)return;
    const node=root.current,previous=document.activeElement instanceof HTMLElement?document.activeElement:null,overflow=document.body.style.overflow;
    const inert: {node:HTMLElement;was:string|null}[]=[];
    for(let branch:HTMLElement|null=node;branch?.parentElement&&branch!==document.body;branch=branch.parentElement){for(const sibling of branch.parentElement.children)if(sibling!==branch&&sibling instanceof HTMLElement){inert.push({node:sibling,was:sibling.getAttribute("inert")});sibling.setAttribute("inert","");}}
    document.body.style.overflow="hidden";
    const key=(e:KeyboardEvent)=>{
      if(e.defaultPrevented)return;
      if(e.key==="Escape"){e.preventDefault();onExit();return;}
      if(e.key!=="Tab")return;
      const focusables=[...node.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex='0']")].filter(el=>el.getClientRects().length&&!el.closest("[inert]"));
      const first=focusables[0],last=focusables.at(-1);if(!first||!last)return;
      if(e.shiftKey&&(document.activeElement===first||!node.contains(document.activeElement))){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||!node.contains(document.activeElement))){e.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",key);
    const frame=requestAnimationFrame(()=>node.querySelector<HTMLCanvasElement>(".paint-canvas")?.focus({preventScroll:true}));
    return()=>{cancelAnimationFrame(frame);document.removeEventListener("keydown",key);document.body.style.overflow=overflow;for(const x of inert){if(x.was===null)x.node.removeAttribute("inert");else x.node.setAttribute("inert",x.was);}if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[root,focused,onExit]);
  return root;
}
