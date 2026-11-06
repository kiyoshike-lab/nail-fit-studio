"use client";
import { useState } from "react";
import { createLocalId } from "@/lib/storage";
import { artOrder, cloneFingerArt, defaultPaintStyle, replacePaintArt } from "@/lib/paintData";
import { drawingTools, MAX_ERASERS, MAX_FINGER_POINTS, MAX_PAINT_LAYERS, type DrawingTool, type PaintLayer, type PaintStyle } from "@/lib/paintTypes";
import { partNames, type DesignDocument, type FingerArt } from "@/lib/workshopTypes";
import { PaintCanvas } from "./PaintCanvas";

type Props={document:DesignDocument;finger:number;onBegin:()=>void;onPreview:(d:DesignDocument)=>void;onCommit:(d:DesignDocument)=>void;onCancel:()=>void;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;onClose:()=>void};
const fingerNames=["親指","人差し指","中指","薬指","小指"];
export function NailPaintEditor({document:doc,finger,onBegin,onPreview,onCommit,onCancel,onUndo,onRedo,canUndo,canRedo,onClose}:Props){
  const [tool,setTool]=useState<DrawingTool|"pan">("pen"),[brush,setBrush]=useState<PaintStyle>(defaultPaintStyle),[mirror,setMirror]=useState(false),[zoom,setZoom]=useState(1.5),[resetView,setResetView]=useState(0),[selectedId,setSelectedId]=useState<string|null>(null),[notice,setNotice]=useState(""),[copyTo,setCopyTo]=useState((finger+1)%5);
  const [guide,setGuide]=useState(false),[guideDepth,setGuideDepth]=useState(.22);
  const art=doc.fingers[finger],layers=art.layers??[],layer=layers.find(l=>l.id===selectedId),part=art.parts.find(p=>p.id===selectedId),editingLayer=tool==="select"?layer:undefined,selectedStyle=editingLayer??brush,order=artOrder(art),index=selectedId?order.indexOf(selectedId):-1;
  const focusCanvas=()=>requestAnimationFrame(()=>document.querySelector(".nail-paint-editor .paint-viewport")?.scrollIntoView({block:"center"}));
  function commitArt(next:FingerArt){onCommit(replacePaintArt(doc,finger,next));setNotice("");}
  function patchLayer(patch:Partial<PaintLayer>){if(layer)commitArt({...art,layers:layers.map(l=>l.id===layer.id?{...l,...patch} as PaintLayer:l)});}
  function styleChange(patch:Partial<PaintStyle>){if(editingLayer)patchLayer(patch);else setBrush(s=>({...s,...patch}));}
  function remove(){if(!selectedId)return;commitArt({...art,parts:art.parts.filter(p=>p.id!==selectedId),layers:layers.filter(l=>l.id!==selectedId),order:order.filter(id=>id!==selectedId)});setSelectedId(null);}
  function duplicate(){if(!selectedId)return;
    if(layer){if(layers.length>=MAX_PAINT_LAYERS||layer.tool==="eraser"&&layers.filter(l=>l.tool==="eraser").length>=MAX_ERASERS||layer.type==="stroke"&&layers.reduce((n,l)=>n+(l.type==="stroke"?l.points.length:0),0)+layer.points.length>MAX_FINGER_POINTS){setNotice("レイヤー・消しゴム・点数の上限です。不要な線を削除してください。");return;}const copy={...layer,id:createLocalId("paint"),x:Math.min(.7,layer.x+.04),...(layer.type==="stroke"?{points:layer.points.map(p=>({...p}))}:{})} as PaintLayer;commitArt({...art,layers:[...layers,copy],order:[...order,copy.id]});setSelectedId(copy.id);}
    else if(part){if(art.parts.length>=12){setNotice("装飾パーツは1本12個までです。");return;}const copy={...part,id:createLocalId("part"),x:Math.min(.45,part.x+.04)};commitArt({...art,parts:[...art.parts,copy],order:[...order,copy.id]});setSelectedId(copy.id);}
  }
  function moveOrder(delta:number){if(index<0||index+delta<0||index+delta>=order.length)return;const next=[...order];[next[index],next[index+delta]]=[next[index+delta],next[index]];commitArt({...art,order:next});}
  function copy(all:boolean){
    const next={...doc,fingers:doc.fingers.map((f,i)=>(all||i===copyTo)?cloneFingerArt(art):f)};
    // Upgrade every finger together; old v1 data is not mutated in place.
    onCommit(replacePaintArt(next,finger,all?next.fingers[finger]:art));setNotice(all?"5本へコピーしました。元に戻すで取り消せます。":`${fingerNames[copyTo]}へコピーしました。`);
  }
  return <section className="nail-paint-editor" aria-label="手描きと図形の拡大編集">
    <header><h3>{fingerNames[finger]}に描く</h3><p className="hint">ペンでなぞる／図形をドラッグして作成。爪の外は切り抜きます。移動モードでは拡大した画面を動かせます。ライブ試着で画面が狭い場合は試着プレビューを収納してください（カメラは継続します）。</p></header>
    <div className="paint-tools">
      <label>描画ツール<select value={tool} onChange={e=>{setTool(e.target.value as DrawingTool|"pan");if(e.target.value!=="select")setSelectedId(null);}}>{Object.entries(drawingTools).map(([value,label])=><option key={value} value={value}>{label}</option>)}<option value="pan">表示を移動（描かない）</option></select></label>
      <div className="workshop-toolbar"><button type="button" className="secondary" disabled={zoom<=1} onClick={()=>{setZoom(z=>Math.max(1,z-.5));focusCanvas();}}>縮小</button><output aria-label="編集の表示倍率">{zoom.toFixed(1)}倍</output><button type="button" className="secondary" disabled={zoom>=2.5} onClick={()=>{setZoom(z=>Math.min(2.5,z+.5));focusCanvas();}}>拡大</button><button type="button" className="secondary" onClick={()=>{setZoom(1);setResetView(n=>n+1);focusCanvas();}}>表示をリセット</button></div>
    </div>
    <PaintCanvas document={doc} finger={finger} tool={tool} style={brush} mirror={mirror} zoom={zoom} resetView={resetView} guide={guide} guideDepth={guideDepth} selectedId={selectedId} onSelect={setSelectedId} onBegin={onBegin} onPreview={onPreview} onCommit={onCommit} onCancel={onCancel} onNotice={setNotice} onUndo={onUndo} onRedo={onRedo} onDelete={remove}/>
    <div className="workshop-toolbar"><button type="button" onClick={onUndo} disabled={!canUndo}>描画を元に戻す</button><button type="button" onClick={onRedo} disabled={!canRedo}>描画をやり直す</button><button type="button" className="secondary" onClick={onClose}>5本一覧に戻る</button></div>
    <details open><summary>{editingLayer?"選んだ線・図形の見た目":"ブラシ・図形の設定"}</summary><div className="paint-style-grid">
      <label className="paint-check"><input type="checkbox" checked={guide} onChange={e=>setGuide(e.target.checked)}/>フレンチガイド（保存しない）</label>
      {guide&&<label>フレンチガイドの深さ<input type="range" min=".05" max=".6" step=".01" value={guideDepth} onChange={e=>setGuideDepth(Number(e.target.value))}/></label>}
      <label>描画色<input type="color" value={selectedStyle.color} onChange={e=>styleChange({color:e.target.value})}/></label>
      <label>図形の枠線色<input type="color" value={selectedStyle.strokeColor} onChange={e=>styleChange({strokeColor:e.target.value})}/></label>
      <label>グラデーション・輝きの色<input type="color" value={selectedStyle.secondary} onChange={e=>styleChange({secondary:e.target.value})}/></label>
      <label>線・ドットの太さ<input type="range" min=".003" max=".3" step=".001" value={selectedStyle.lineWidth} onChange={e=>styleChange({lineWidth:Number(e.target.value)})}/></label>
      <label>描画の不透明度<input type="range" min="0" max="1" step=".05" value={selectedStyle.opacity} onChange={e=>styleChange({opacity:Number(e.target.value)})}/></label>
      <label>ドット・ラメの間隔<input type="range" min=".3" max="6" step=".1" value={selectedStyle.spacing} onChange={e=>styleChange({spacing:Number(e.target.value)})}/></label>
      <label className="paint-check"><input type="checkbox" checked={selectedStyle.fill} onChange={e=>styleChange({fill:e.target.checked})}/>図形を塗りつぶす</label>
      <label className="paint-check"><input type="checkbox" checked={selectedStyle.stroke} onChange={e=>styleChange({stroke:e.target.checked})}/>図形に枠線を付ける</label>
      <label className="paint-check"><input type="checkbox" checked={editingLayer?.mirror??mirror} onChange={e=>editingLayer?patchLayer({mirror:e.target.checked}):setMirror(e.target.checked)}/>左右対称に描く</label>
    </div><p className="hint">消しゴムは下にある手描き・図形だけを消します。ベースと装飾は残ります。図形の線は枠線色を使います。</p><button type="button" className="secondary" onClick={focusCanvas}>描くキャンバスへ戻る</button></details>
    <details open><summary>レイヤー（後ろほど手前）</summary>
      <div className="paint-layer-list" role="group" aria-label="手描き・装飾のレイヤー">{order.map((id,i)=>{const l=layers.find(l=>l.id===id),p=art.parts.find(p=>p.id===id);return <button type="button" key={id} aria-pressed={selectedId===id} onClick={()=>{setSelectedId(id);setTool("select");}}>{i+1}. {l?drawingTools[l.tool]:p?partNames[p.kind]:"レイヤー"}</button>;})}</div>
      {!order.length&&<p className="hint">まだレイヤーはありません。キャンバスをなぞって描いてみましょう。</p>}
      {layer&&<div className="paint-style-grid">
        <label>レイヤーの横位置<input type="range" min="-.7" max=".7" step=".005" value={layer.x} onChange={e=>patchLayer({x:Number(e.target.value)})}/></label>
        <label>レイヤーの縦位置<input type="range" min="-.7" max=".7" step=".005" value={layer.y} onChange={e=>patchLayer({y:Number(e.target.value)})}/></label>
        <label>レイヤーの大きさ<input type="range" min=".1" max="3" step=".05" value={layer.scale} onChange={e=>patchLayer({scale:Number(e.target.value)})}/></label>
        <label>レイヤーの回転<input type="range" min="-180" max="180" step="1" value={layer.rotation} onChange={e=>patchLayer({rotation:Number(e.target.value)})}/></label>
        {layer.type==="shape"&&<><label>図形の幅<input type="range" min=".01" max="4" step=".01" value={layer.width} onChange={e=>{const v=Number(e.target.value);patchLayer({width:v,...(["circle","square"].includes(layer.tool)?{height:v}:{})});}}/></label><label>図形の高さ<input type="range" min=".01" max="4" step=".01" value={layer.height} onChange={e=>{const v=Number(e.target.value);patchLayer({height:v,...(["circle","square"].includes(layer.tool)?{width:v}:{})});}}/></label>{["curve","french"].includes(layer.tool)&&<label>曲線の曲がり<input type="range" min="-1" max="1" step=".05" value={layer.bend} onChange={e=>patchLayer({bend:Number(e.target.value)})}/></label>}</>}
      </div>}
      {part&&<div className="paint-style-grid"><label>レイヤーパーツの色<input type="color" value={part.color} onChange={e=>commitArt({...art,parts:art.parts.map(p=>p.id===part.id?{...p,color:e.target.value}:p)})}/></label><label>レイヤーパーツの大きさ<input type="range" min=".06" max=".6" step=".01" value={part.size} onChange={e=>commitArt({...art,parts:art.parts.map(p=>p.id===part.id?{...p,size:Number(e.target.value)}:p)})}/></label><label>レイヤーパーツの回転<input type="range" min="-180" max="180" value={part.rotation} onChange={e=>commitArt({...art,parts:art.parts.map(p=>p.id===part.id?{...p,rotation:Number(e.target.value)}:p)})}/></label></div>}
      <div className="workshop-toolbar"><button type="button" disabled={!selectedId} onClick={duplicate}>レイヤーを複製</button><button type="button" disabled={!selectedId} onClick={remove}>レイヤーを削除</button><button type="button" disabled={index<0||index===order.length-1} onClick={()=>moveOrder(1)}>レイヤーを手前へ</button><button type="button" disabled={index<=0} onClick={()=>moveOrder(-1)}>レイヤーを奥へ</button></div>
    </details>
    <details><summary>ほかの指へ模様をコピー</summary><label>コピー先の指<select value={copyTo} onChange={e=>setCopyTo(Number(e.target.value))}>{fingerNames.map((name,i)=><option key={i} value={i} disabled={i===finger}>{name}</option>)}</select></label><div className="workshop-toolbar"><button type="button" onClick={()=>copy(false)}>この指へデザインをコピー</button><button type="button" onClick={()=>copy(true)}>手描きも装飾も5本へコピー</button></div><p className="hint">色・形・装飾もコピーします。コピー前のデザインはUndoで戻せます。</p></details>
    <p className="hint">1本につき手描き32レイヤー・4096点まで。長い線は最大256点へ間引いて滑らかにつなぎます。消しゴムは8本まで。拡大率と表示位置はデザインに保存しません。</p>
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
