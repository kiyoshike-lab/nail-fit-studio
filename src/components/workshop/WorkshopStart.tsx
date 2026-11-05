"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {useEffect,useState}from"react";
import {createDocument,findWorkshopDocument,readWorkshopDraft}from"@/lib/workshopData";
import type {DesignDocument}from"@/lib/workshopTypes";
import{trackEvent}from"@/lib/analytics";
const Editor=dynamic(()=>import("./WorkshopEditor"),{ssr:false,loading:()=> <p role="status">エディターを準備しています…</p>});
export function WorkshopStart(){
  const[document,setDocument]=useState<DesignDocument|null>(null),[notice,setNotice]=useState("");
  useEffect(()=>{const timer=window.setTimeout(()=>{const p=new URLSearchParams(location.search),id=p.get("id");const d=id?findWorkshopDocument(id):p.has("resume")?readWorkshopDraft().document:createDocument();if(!d){setNotice("この端末にデザインが見つからないか、保存データを読めませんでした。元のデータは保持しています。");return;}setDocument(d);trackEvent(id?"saved_design_reedited":"design_editor_started");},0);return()=>clearTimeout(timer);},[]);
  return <><p><Link href="/collections">自作コレクションを見る →</Link></p>{document?<Editor initial={document}/>:notice?<div role="status"><p>{notice}</p><button type="button" onClick={()=>{setDocument(createDocument());setNotice("");}}>新しいデザインを作る</button></div>:<p role="status">端末内のデザインを準備しています…</p>}</>;
}
