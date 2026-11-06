"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {useEffect,useState}from"react";
import {createDocument,findWorkshopDocument,readWorkshopDraft}from"@/lib/workshopData";
import type {DesignDocument}from"@/lib/workshopTypes";
import{trackEvent}from"@/lib/analytics";
import{readWorkshopRecovery,deleteWorkshopRecovery}from"@/lib/workshopRecovery";
const Editor=dynamic(()=>import("./WorkshopEditor"),{ssr:false,loading:()=> <p role="status">エディターを準備しています…</p>});
export function WorkshopStart(){
  const[document,setDocument]=useState<DesignDocument|null>(null),[notice,setNotice]=useState("");
  const[recovery,setRecovery]=useState<ReturnType<typeof readWorkshopRecovery>>({ok:true,documents:[]}),[session,setSession]=useState(0),[recovered,setRecovered]=useState(false),[dirty,setDirty]=useState(false);
  useEffect(()=>{const timer=window.setTimeout(()=>{const p=new URLSearchParams(location.search),id=p.get("id");setRecovery(readWorkshopRecovery());const d=id?findWorkshopDocument(id):p.has("resume")?readWorkshopDraft().document:createDocument();if(!d){setNotice("この端末にデザインが見つからないか、保存データを読めませんでした。元のデータは保持しています。");return;}setDocument(d);trackEvent(id?"saved_design_reedited":"design_editor_started");},0);return()=>clearTimeout(timer);},[]);
  function restore(d:DesignDocument){if(dirty&&!window.confirm("保存していない編集を離れて、一時退避データを復元しますか？必要な場合は先にデザインを保存してください。"))return;setDocument(d);setRecovered(true);setSession(s=>s+1);setNotice("");setRecovery(r=>({...r,documents:r.documents.filter(v=>v.id!==d.id)}));}
  return <><p><Link href="/collections">自作コレクションを見る →</Link></p>
    {!recovery.ok&&<p role="status">一時退避データを読み取れませんでした。元データを上書きせず、通常の制作を続けられます。</p>}
    {recovery.documents.length>0&&<section className="workshop-recovery" aria-label="未保存の編集を復元"><h2>前回の未保存の編集</h2><p className="hint">このブラウザだけの一時退避です。写真・映像は含みません。復元して正式に保存できます。</p>{recovery.documents.map(d=><article key={d.id}><strong>{d.name}</strong><time dateTime={d.updatedAt}>{new Date(d.updatedAt).toLocaleString("ja-JP")}</time><div className="workshop-toolbar"><button type="button" aria-label={`${d.name}の一時退避を復元`} onClick={()=>restore(d)}>復元する</button><button type="button" className="secondary" aria-label={`${d.name}の一時退避を削除`} onClick={()=>{if(!window.confirm(`「${d.name}」の一時退避を削除しますか？コレクションの正式保存には影響しません。`))return;if(deleteWorkshopRecovery(d.id))setRecovery(r=>({...r,documents:r.documents.filter(v=>v.id!==d.id)}));else setNotice("一時退避を削除できませんでした。元データは保持しています。");}}>一時退避を削除</button></div></article>)}</section>}
    {document?<Editor key={`${document.id}:${session}`} initial={document} recovered={recovered} onDirtyChange={setDirty}/>:notice?<div role="status"><p>{notice}</p><button type="button" onClick={()=>{setDocument(createDocument());setRecovered(false);setSession(s=>s+1);setNotice("");}}>新しいデザインを作る</button></div>:<p role="status">端末内のデザインを準備しています…</p>}
    {notice&&document&&<p role="status">{notice}</p>}
  </>;
}
