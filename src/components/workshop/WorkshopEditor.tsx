"use client";
import { useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { createLocalId } from "@/lib/storage";
import { createDocument, historyChange, historyRedo, historyUndo, MAX_PARTS, parseDocument, readWorkshopLibrary, saveWorkshopDocument, saveWorkshopDraft, type DocumentHistory } from "@/lib/workshopData";
import { collectionNames, partNames, type CollectionKind, type DesignDocument, type FingerArt, type NailPart, type PartKind } from "@/lib/workshopTypes";
import { nailCanvasGeometry } from "@/lib/nailPoseMetrics";
import type { NailDesign } from "@/lib/types";
import { ArtworkCanvas } from "./ArtworkCanvas";
import { trackEvent } from "@/lib/analytics";

const fingerNames=["親指","人差し指","中指","薬指","小指"];
const shapes={natural:"ナチュラル",round:"ラウンド",oval:"オーバル",squoval:"スクオバル",almond:"アーモンド",coffin:"バレリーナ",square:"スクエア",stiletto:"スティレット"};
type Props={initial:DesignDocument;onChange?:(doc:DesignDocument)=>void;onDone?:(doc:DesignDocument,persisted:boolean)=>void;onCancel?:()=>void};
export default function WorkshopEditor({initial,onChange,onDone,onCancel}:Props){
  const router=useRouter();
  const openedWith=useRef(initial);
  const [history,setHistory]=useState<DocumentHistory>({past:[],present:initial,future:[]});
  const [finger,setFinger]=useState(0),[partId,setPartId]=useState<string|null>(null),[kind,setKind]=useState<PartKind>("silver-holo"),[folder,setFolder]=useState<CollectionKind>(()=>readWorkshopLibrary().entries.find(e=>e.document.id===initial.id)?.folder??"created"),[notice,setNotice]=useState("");
  const drag=useRef<{id:number;start:DocumentHistory;partId:string}|null>(null);
  const current=history.present,art=current.fingers[finger],part=art.parts.find(p=>p.id===partId);
  function apply(next:DesignDocument,record=true){const updated={...next,updatedAt:new Date().toISOString()};setHistory(h=>record?historyChange(h,updated):{...h,present:updated,future:[]});onChange?.(updated);setNotice("");}
  function fingerPatch(patch:Partial<FingerArt>){apply({...current,fingers:current.fingers.map((f,i)=>i===finger?{...f,...patch}:f)});}
  function basePatch(patch:Partial<NailDesign>){fingerPatch({base:{...art.base,...patch}});}
  function partPatch(patch:Partial<NailPart>){if(part)fingerPatch({parts:art.parts.map(p=>p.id===partId?{...p,...patch}:p)});}
  function add(){if(art.parts.length>=MAX_PARTS){setNotice(`1本につき${MAX_PARTS}個までです。`);return;}const p:NailPart={id:createLocalId("part"),kind,color:kind==="gold-holo"?"#e6bc65":kind==="pearl"?"#fff1e6":"#d9dfed",x:0,y:0,size:.26,rotation:0};fingerPatch({parts:[...art.parts,p]});setPartId(p.id);trackEvent("nail_part_added",{part_kind:kind});}
  function movePart(delta:number){if(!part)return;const list=[...art.parts],index=list.findIndex(p=>p.id===partId),to=index+delta;if(to<0||to>=list.length)return;[list[index],list[to]]=[list[to],list[index]];fingerPatch({parts:list});}
  function dragPosition(event:PointerEvent<HTMLDivElement>){const canvas=event.currentTarget.querySelector("canvas");if(!canvas)return null;const r=canvas.getBoundingClientRect(),w=canvas.width,h=canvas.height;const g=nailCanvasGeometry({x:50,y:84,width:45,height:32,rotation:0},w,h,art.base.length,["square","squoval"].includes(art.base.shape)?1.05:art.base.shape==="coffin"?1.1:1);return{x:Math.max(-.45,Math.min(.45,((event.clientX-r.left)/r.width*w-g.center.x)/g.width)),y:Math.max(-.45,Math.min(.45,((event.clientY-r.top)/r.height*h-g.center.y)/g.height))};}
  function move(event:PointerEvent<HTMLDivElement>){if(drag.current?.id!==event.pointerId)return;const point=dragPosition(event);if(!point)return;const updated={...current,fingers:current.fingers.map((f,i)=>i===finger?{...f,parts:f.parts.map(p=>p.id===drag.current?.partId?{...p,...point}:p)}:f)};apply(updated,false);}
  function finish(event:PointerEvent<HTMLDivElement>,cancel=false){const active=drag.current;if(!active||active.id!==event.pointerId)return;drag.current=null;if(cancel){setHistory(active.start);onChange?.(active.start.present);return;}setHistory(h=>({...h,past:[...active.start.past,active.start.present].slice(-40),future:[]}));}
  function save(){if(!saveWorkshopDocument(current,folder)){setNotice("保存できませんでした。容量・ブラウザ設定を確認してください。未知・破損データは上書きしません。保存枠は40件です。");return;}setNotice("デザインを保存しました。この端末・ブラウザのコレクションから再編集できます。");trackEvent("custom_design_saved",{finger_count:5,part_count:current.fingers.reduce((n,f)=>n+f.parts.length,0)});}
  function tryOn(){
    if(!parseDocument(current)){setNotice("デザイン名・パーツの設定を確認してください。");return;}
    const persisted=saveWorkshopDraft(current);
    if(!persisted&&!onDone){setNotice("下書きを保存できませんでした。名前・保存設定・空き容量を確認してください。");return;}
    trackEvent("custom_design_tryon",{part_count:current.fingers.reduce((n,f)=>n+f.parts.length,0)});
    // Inline editing can keep using its in-memory design even when storage is
    // unavailable. Cross-route handoff must persist first to avoid losing it.
    if(onDone)onDone(current,persisted);else router.push("/try-on?draft=1");
  }
  return <section className="workshop-editor" aria-labelledby="workshop-editor-title">
    <h2 id="workshop-editor-title">自分のネイルを作る</h2><p className="hint">図で制作し、写真・カメラで試着できます。装飾は軽量な立体風表現です。</p><p className="hint">自動保存ではありません。編集後は「デザインを保存」か「このデザインで試着」を押してください。</p>
    <label>デザイン名<input maxLength={80} value={current.name} onChange={e=>apply({...current,name:e.target.value})}/></label>
    <div className="workshop-toolbar"><button type="button" disabled={!history.past.length} onClick={()=>{const next=historyUndo(history);setHistory(next);onChange?.(next.present);}}>元に戻す</button><button type="button" disabled={!history.future.length} onClick={()=>{const next=historyRedo(history);setHistory(next);onChange?.(next.present);}}>やり直す</button><button type="button" onClick={()=>apply({...createDocument(),id:current.id,createdAt:current.createdAt,name:current.name})}>初期化（取り消せます）</button></div>
    <div className="finger-tabs" role="group" aria-label="制作する指">{fingerNames.map((name,i)=><button type="button" key={name} aria-pressed={i===finger} className={i===finger?"is-selected":""} onClick={()=>{setFinger(i);setPartId(null);}}>{name}</button>)}</div>
    <div className="workshop-grid"><div className="workshop-drawing" style={{touchAction:part?"none":"pan-y"}} onPointerDown={e=>{if(!part||!(e.target instanceof HTMLCanvasElement))return;drag.current={id:e.pointerId,start:history,partId:part.id};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={move} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)}><ArtworkCanvas document={current} selectedFinger={finger}/><p className="hint">{part?"選択中のパーツを図の中でドラッグできます。":"パーツを選ぶと位置を動かせます。"}爪の外は切り抜かれます。</p></div>
    <div className="workshop-fields"><details open><summary>色・形・基本の模様</summary><div className="field-grid">
      <label>ベースカラー<input type="color" value={art.base.color} onChange={e=>basePatch({color:e.target.value})}/></label>
      <label>透明度（不透明にするほど右）<input type="range" min="0" max="1" step=".05" value={art.opacity} onChange={e=>fingerPatch({opacity:Number(e.target.value)})}/></label>
      <label>模様<select value={art.base.pattern} onChange={e=>basePatch({pattern:e.target.value as NailDesign["pattern"]})}><option value="solid">ワンカラー</option><option value="gradient">グラデーション</option><option value="french">フレンチ</option><option value="floral">小さな模様</option><option value="marble">マーブル</option>{art.base.textureUrl&&<option value="patterned">実写柄（読み込んだ素材）</option>}</select></label>
      <label>模様・爪先の色<input type="color" value={art.base.tipColor} onChange={e=>basePatch({tipColor:e.target.value,motifColor:e.target.value})}/></label>
      <label>表面アート<select value={art.effect} onChange={e=>fingerPatch({effect:e.target.value as FingerArt["effect"]})}><option value="none">なし</option><option value="dots">ドット</option><option value="lines">ライン</option><option value="magnetic">マグネット風</option></select></label>
      <label>仕上げ<select value={art.base.finish} onChange={e=>basePatch({finish:e.target.value as NailDesign["finish"]})}><option value="gloss">つや</option><option value="sheer">透明感</option><option value="sparkle">ラメ</option><option value="chrome">ミラー風</option><option value="pearl">パール調</option></select></label>
      <label>形<select value={art.base.shape} onChange={e=>basePatch({shape:e.target.value as NailDesign["shape"]})}>{Object.entries(shapes).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
      <label>仕上がりの長さ<input type="range" min=".75" max="2.5" step=".05" value={art.base.length} onChange={e=>basePatch({length:Number(e.target.value)})}/></label>
    </div></details>
    <details><summary>パーツを追加・編集</summary><label>パーツの種類<select value={kind} onChange={e=>setKind(e.target.value as PartKind)}>{Object.entries(partNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label><button type="button" onClick={add} disabled={art.parts.length>=MAX_PARTS}>パーツを追加</button><p className="hint">{art.parts.length}/{MAX_PARTS}個。配列の後ろほど手前に描きます。</p>
      <div className="workshop-parts" role="group" aria-label="パーツを選択">{art.parts.map((p,i)=><button type="button" key={p.id} aria-pressed={p.id===partId} onClick={()=>setPartId(p.id)}>{i+1}. {partNames[p.kind]}</button>)}</div>
      {part&&<><div className="field-grid"><label>パーツの色<input type="color" value={part.color} onChange={e=>partPatch({color:e.target.value})}/></label><label>パーツの大きさ<input type="range" min=".06" max=".6" step=".01" value={part.size} onChange={e=>partPatch({size:Number(e.target.value)})}/></label><label>パーツの角度<input type="range" min="-180" max="180" value={part.rotation} onChange={e=>partPatch({rotation:Number(e.target.value)})}/></label><label>パーツ横位置<input type="range" min="-.45" max=".45" step=".01" value={part.x} onChange={e=>partPatch({x:Number(e.target.value)})}/></label><label>パーツ縦位置<input type="range" min="-.45" max=".45" step=".01" value={part.y} onChange={e=>partPatch({y:Number(e.target.value)})}/></label></div>
      <div className="workshop-toolbar"><button type="button" onClick={()=>{if(art.parts.length>=MAX_PARTS)return;const copy={...part,id:createLocalId("part"),x:Math.min(.45,part.x+.05)};fingerPatch({parts:[...art.parts,copy]});setPartId(copy.id);}} disabled={art.parts.length>=MAX_PARTS}>複製</button><button type="button" onClick={()=>{fingerPatch({parts:art.parts.filter(p=>p.id!==partId)});setPartId(null);}}>選択パーツを削除</button><button type="button" disabled={art.parts.at(-1)?.id===part.id} onClick={()=>movePart(1)}>手前へ</button><button type="button" disabled={art.parts[0]?.id===part.id} onClick={()=>movePart(-1)}>奥へ</button></div></>}
    </details>
    <details><summary>ほかの指へコピー・保存</summary><button type="button" onClick={()=>apply({...current,fingers:current.fingers.map(()=>({...art,base:{...art.base},parts:art.parts.map(p=>({...p,id:createLocalId("part")}))}))})}>選択中の指を5本すべてにコピー</button><label>保存先<select value={folder} onChange={e=>setFolder(e.target.value as CollectionKind)}>{Object.entries(collectionNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label><label>装飾の描画<select value={current.detail} onChange={e=>apply({...current,detail:e.target.value as DesignDocument["detail"]})}><option value="standard">標準</option><option value="light">軽量（反射面を減らす）</option></select></label></details>
    </div></div>
    <ArtworkCanvas document={current}/>
    <div className="workshop-toolbar"><button type="button" onClick={save}>デザインを保存</button><button type="button" onClick={tryOn}>このデザインで試着</button><button type="button" className="secondary" onClick={()=>{apply(openedWith.current);onCancel?.();}}>開いた時の状態に戻す</button></div>
    <p className="hint">保存はこの端末・ブラウザだけです。写真は保存しません。立体パーツの厚み・本物の反射・指同士の遮蔽を完全に再現するものではありません。</p>
    {notice&&<p role="status" className="notice">{notice}</p>}
  </section>;
}
