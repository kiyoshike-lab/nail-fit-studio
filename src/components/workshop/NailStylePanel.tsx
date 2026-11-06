"use client";
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { drawNails } from "@/lib/nailRenderer";
import { defaultDesign } from "@/lib/defaults";
import { applyNailStyle, filterStyles, nailStyles, styleFacets, type NailStyle, type StyleFacet, type StyleFilters } from "@/lib/nailStyles";
import { favoriteSnapshot, parseStyleFavorites, subscribeStyleFavorites, toggleStyleFavorite } from "@/lib/styleFavorites";
import type { DesignDocument } from "@/lib/workshopTypes";
import type { NailSurface } from "@/lib/surfaceTypes";

const serverSnapshot=()=>"";
const StyleThumbnail=memo(function StyleThumbnail({style}:{style:NailStyle}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const c=ref.current,x=c?.getContext("2d");if(!c||!x)return;let live=true;
    const base={...defaultDesign,color:style.color,tipColor:style.tipColor,pattern:"solid" as const,material:"cream" as const,textureUrl:undefined};
    void drawNails(x,96,120,[{x:50,y:89,width:48,height:75,rotation:0}],base,{clear:true,fingers:[{base,opacity:1,effect:"none",parts:[],surface:style.surface}],isCurrent:()=>live}).catch(()=>{if(live)x.clearRect(0,0,96,120);});return()=>{live=false;};
  },[style]);return <canvas ref={ref} width={96} height={120} aria-hidden="true"/>;
});
type Props={document:DesignDocument;finger:number;onChange:(d:DesignDocument)=>void};
export function NailStylePanel({document:doc,finger,onChange}:Props){
  const [query,setQuery]=useState(""),[filters,setFilters]=useState<StyleFilters>({}),[onlyFavorites,setOnlyFavorites]=useState(false),[sort,setSort]=useState<"new"|"name">("new"),[notice,setNotice]=useState("");
  const snapshot=useSyncExternalStore(subscribeStyleFavorites,favoriteSnapshot,serverSnapshot),favorites=useMemo(()=>parseStyleFavorites(snapshot),[snapshot]);
  const list=useMemo(()=>filterStyles(query,filters,favorites??[],onlyFavorites,sort),[query,filters,favorites,onlyFavorites,sort]);
  const art=doc.fingers[finger],s=art.surface;
  function patchSurface(patch:Partial<NailSurface>){if(!s)return;onChange({...doc,fingers:doc.fingers.map((f,i)=>i===finger?{...f,surface:{...s,...patch}}:f)});}
  return <section className="nail-style-panel" aria-label="質感とデザインのライブラリー">
    <p className="hint">図は質感の見本です。透明な色は写真の自爪になじみます。特殊仕上げはCanvasによる近似表現です。形・長さ・既存レイヤーは選択後も残ります。</p>
    <label>デザインを検索<input type="search" maxLength={120} value={query} placeholder="例：上品 フレンチ、ラメ" onChange={e=>setQuery(e.target.value)}/></label>
    <details><summary>条件で絞り込む</summary><div className="style-filter-grid">{Object.entries(styleFacets).map(([key,values])=><label key={key}>{{type:"種類",mood:"雰囲気",color:"見本の色",season:"季節",event:"イベント",difficulty:"セルフネイルの目安",decoration:"装飾"}[key]}<select aria-label={`絞り込み：${({type:"種類",mood:"雰囲気",color:"見本の色",season:"季節",event:"イベント",difficulty:"セルフネイルの目安",decoration:"装飾"})[key]}`} value={filters[key as StyleFacet]??""} onChange={e=>setFilters(f=>({...f,[key]:e.target.value}))}><option value="">すべて</option>{Object.entries(values).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>)}</div><p className="hint">分類はデザイン選びの目安です。実物の作業時間・難易度を保証するものではありません。「見本の色」は選択後に変更できます。</p></details>
    <div className="workshop-toolbar"><label className="style-check"><input type="checkbox" checked={onlyFavorites} onChange={e=>setOnlyFavorites(e.target.checked)}/>お気に入りだけ</label><label>並び順<select value={sort} onChange={e=>setSort(e.target.value as "new"|"name")}><option value="new">追加日順</option><option value="name">名前順</option></select></label><button type="button" className="secondary" onClick={()=>{setQuery("");setFilters({});setOnlyFavorites(false);}}>条件を解除</button></div>
    {favorites===null&&<p role="status">お気に入りの保存設定を読み取れません。既存データは上書きしません。デザイン選択は利用できます。</p>}
    <p role="status" className="hint">{list.length} / {nailStyles.length}種類</p>
    <div className="nail-style-grid">{list.map(style=><button key={style.id} type="button" aria-label={`${style.name}を選ぶ`} aria-pressed={s?.kind===style.id} onClick={()=>{const next=applyNailStyle(doc,finger,style.id);if(next){onChange(next);setNotice(`${style.name}を選択中の指へ適用しました。`);}}}><StyleThumbnail style={style}/><span>{style.name}</span>{favorites?.includes(style.id)&&<small>お気に入り</small>}</button>)}</div>
    {!list.length&&<p>条件に合うデザインがありません。「条件を解除」で戻せます。</p>}
    {s&&<><div className="workshop-toolbar"><button type="button" className="secondary" disabled={favorites===null} onClick={()=>setNotice(toggleStyleFavorite(s.kind)?"お気に入りを更新しました。":"お気に入りを保存できませんでした。ブラウザの保存設定を確認してください。")}>{favorites?.includes(s.kind)?"この質感をお気に入りから外す":"この質感をお気に入りに登録"}</button><button type="button" className="secondary" onClick={()=>onChange({...doc,fingers:doc.fingers.map(f=>({...f,surface:{...s},base:{...f.base,color:art.base.color,tipColor:art.base.tipColor,tipAmount:art.base.tipAmount,textureUrl:undefined}}))})}>質感・色だけ5本へ適用</button><button type="button" className="secondary" onClick={()=>onChange({...doc,fingers:doc.fingers.map((f,i)=>i===finger?{...f,surface:undefined}:f)})}>従来の仕上げに戻す</button></div>
    <details open><summary>選択した質感を調整</summary><div className="style-filter-grid"><label>質感の色<input type="color" value={art.base.color} onChange={e=>onChange({...doc,fingers:doc.fingers.map((f,i)=>i===finger?{...f,base:{...f.base,color:e.target.value}}:f)})}/></label><label>爪先・粒子の色<input type="color" value={art.base.tipColor} onChange={e=>onChange({...doc,fingers:doc.fingers.map((f,i)=>i===finger?{...f,base:{...f.base,tipColor:e.target.value}}:f)})}/></label>
    {([['pigment','色の濃さ（左ほど透明）'],['gloss','光沢'],['roughness','表面の粗さ'],['intensity','特殊反射の強さ']] as const).filter(([key])=>key!=="intensity"||!['color','sheer','clear','milky','gradient','french','reverse-french','diagonal-french','half-french','matte'].includes(s.kind)).map(([key,name])=><label key={key}>{name}<input type="range" min="0" max="1" step=".01" value={s[key]} onChange={e=>patchSurface({[key]:Number(e.target.value)})}/></label>)}
    {['magnet','cat-eye','aurora','unicorn'].includes(s.kind)&&<label>光の筋の方向<input type="range" min="-180" max="180" value={s.angle} onChange={e=>patchSurface({angle:Number(e.target.value)})}/></label>}
    {['magnet','cat-eye','glitter','hologram','flash'].includes(s.kind)&&<label>粒子の大きさ<input type="range" min="0" max="1" step=".01" value={s.grain} onChange={e=>patchSurface({grain:Number(e.target.value)})}/></label>}
    {s.kind.includes('french')||s.kind==='gradient'?<><label>爪先カラーの広さ<input type="range" min=".08" max=".55" step=".01" value={art.base.tipAmount} onChange={e=>onChange({...doc,fingers:doc.fingers.map((f,i)=>i===finger?{...f,base:{...f.base,tipAmount:Number(e.target.value)}}:f)})}/></label>{['french','reverse-french'].includes(s.kind)&&<label>境界線のカーブ<input type="range" min="0" max="1" step=".01" value={s.curve} onChange={e=>patchSurface({curve:Number(e.target.value)})}/></label>}</>:null}
    </div></details></>}
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
