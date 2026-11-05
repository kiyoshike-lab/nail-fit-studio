"use client";
import Link from"next/link";import{useEffect,useState}from"react";
import{readWorkshopDraft,readWorkshopLibrary}from"@/lib/workshopData";
export function WorkshopResume(){
 const[resume,setResume]=useState<{name:string;href:string}|null>(null);
 useEffect(()=>{const timer=setTimeout(()=>{const draft=readWorkshopDraft().document,latest=readWorkshopLibrary().entries.map(e=>e.document).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];if(latest&&(!draft||Date.parse(latest.updatedAt)>Date.parse(draft.updatedAt)))setResume({name:latest.name,href:`/create?id=${encodeURIComponent(latest.id)}`});else if(draft)setResume({name:draft.name,href:"/create?resume=1"});},0);return()=>clearTimeout(timer);},[]);
 return <section className="workshop-home page-width" aria-label="デザイン制作と保存"><h2>自分のネイルを作って、また続きから。</h2><div className="workshop-toolbar"><Link prefetch={false} className="button primary" href="/create">自分のデザインを作る</Link><Link prefetch={false} className="button ghost" href="/collections">保存した自作ネイルを見る</Link>{resume&&<Link prefetch={false} className="button ghost" href={resume.href}>前回の続き：{resume.name}</Link>}</div></section>;
}
