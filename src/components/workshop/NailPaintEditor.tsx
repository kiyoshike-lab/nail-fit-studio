"use client";
import { useCallback, useState } from "react";
import { createLocalId } from "@/lib/storage";
import { artOrder, cloneFingerArt, defaultPaintStyle, layerState, replacePaintArt } from "@/lib/paintData";
import { editorMaterials, patchLayerState, placeMaterial } from "@/lib/editorMaterials";
import { editorObject, replaceEditorObject, transformObject } from "@/lib/editorObjects";
import { drawingTools, MAX_ERASERS, MAX_FINGER_POINTS, MAX_PAINT_LAYERS, type DrawingTool, type PaintLayer, type PaintStyle } from "@/lib/paintTypes";
import type { DesignDocument, FingerArt } from "@/lib/workshopTypes";
import { canvasDropPoint, PaintCanvas } from "./PaintCanvas";
import { MaterialPalette } from "./MaterialPalette";
import { PaintViewControls } from "./PaintViewControls";
import { usePaintFocus } from "./usePaintFocus";
import type { PaintView, PaintViewCommand } from "@/lib/paintViewport";

type Props={document:DesignDocument;finger:number;clipboard:FingerArt|null;onClipboard:(art:FingerArt)=>void;getInitialView?:()=>PaintView|undefined;onView?:(view:PaintView)=>void;onSave?:()=>{ok:boolean;message:string};onTryOn?:()=>{ok:boolean;message:string};onBegin:()=>void;onPreview:(d:DesignDocument)=>void;onCommit:(d:DesignDocument)=>void;onCancel:()=>void;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;onClose:()=>void};
const fingerNames=["親指","人差し指","中指","薬指","小指"];
export function NailPaintEditor({document:doc,finger,clipboard,onClipboard,getInitialView,onView,onSave,onTryOn,onBegin,onPreview,onCommit,onCancel,onUndo,onRedo,canUndo,canRedo,onClose}:Props){
  const [tool,setTool]=useState<DrawingTool|"pan">("pen"),[brush,setBrush]=useState<PaintStyle>(defaultPaintStyle),[mirror,setMirror]=useState(false),[zoom,setZoom]=useState(1),[viewCommand,setViewCommand]=useState<PaintViewCommand>({id:0,action:"fit"}),[selectedId,setSelectedId]=useState<string|null>(null),[notice,setNotice]=useState(""),[copyTo,setCopyTo]=useState((finger+1)%5);
  const [focused,setFocused]=useState(false),[optionsOpen,setOptionsOpen]=useState(true),[materialsOpen,setMaterialsOpen]=useState(false);
  const [guide,setGuide]=useState(false),[guideDepth,setGuideDepth]=useState(.22);
  const [material,setMaterial]=useState<string|null>(null),[snap,setSnap]=useState(false),[grid,setGrid]=useState(false);
  const exitFocus=useCallback(()=>setFocused(false),[]);
  const root=usePaintFocus(focused,exitFocus);
  const art=doc.fingers[finger],layers=art.layers??[],layer=layers.find(l=>l.id===selectedId),part=art.parts.find(p=>p.id===selectedId),editingLayer=tool==="select"?layer:undefined,selectedStyle=editingLayer??brush,order=artOrder(art),index=selectedId?order.indexOf(selectedId):-1;
  const meta=selectedId?layerState(art,selectedId):null,locked=!!meta?.locked;
  const focusCanvas=()=>requestAnimationFrame(()=>root.current?.querySelector(".paint-viewport")?.scrollIntoView({block:"center"}));
  function chooseTool(value:DrawingTool|"pan"){setMaterial(null);setMaterialsOpen(false);setTool(value);if(value!=="select")setSelectedId(null);}
  function openMaterials(){setMaterialsOpen(true);if(focused)setOptionsOpen(false);setMaterial(null);setTool("select");requestAnimationFrame(()=>{const palette=root.current?.querySelector<HTMLDetailsElement>(".material-palette");if(palette){palette.open=true;palette.scrollIntoView({block:"nearest"});}});}
  function changeView(action:PaintViewCommand["action"]){setViewCommand(c=>({id:c.id+1,action}));focusCanvas();}
  function commitArt(next:FingerArt){onCommit(replacePaintArt(doc,finger,next));setNotice("");}
  function patchLayer(patch:Partial<PaintLayer>){if(layer&&!locked)commitArt({...art,layers:layers.map(l=>l.id===layer.id?{...l,...patch} as PaintLayer:l)});}
  function styleChange(patch:Partial<PaintStyle>){if(editingLayer)patchLayer(patch);else setBrush(s=>({...s,...patch}));}
  function remove(){if(!selectedId)return;if(locked){setNotice("ロックを解除してから削除してください。");return;}commitArt({...art,parts:art.parts.filter(p=>p.id!==selectedId),layers:layers.filter(l=>l.id!==selectedId),order:order.filter(id=>id!==selectedId)});setSelectedId(null);}
  function duplicate(){if(!selectedId||locked)return;
    if(layer){if(layers.length>=MAX_PAINT_LAYERS||layer.tool==="eraser"&&layers.filter(l=>l.tool==="eraser").length>=MAX_ERASERS||layer.type==="stroke"&&layers.reduce((n,l)=>n+(l.type==="stroke"?l.points.length:0),0)+layer.points.length>MAX_FINGER_POINTS){setNotice("レイヤー・消しゴム・点数の上限です。不要な線を削除してください。");return;}const copy={...layer,id:createLocalId("paint"),x:Math.min(.7,layer.x+.04),...(layer.type==="stroke"?{points:layer.points.map(p=>({...p}))}:{})} as PaintLayer;commitArt({...art,layers:[...layers,copy],order:[...order,copy.id],layerMeta:{...art.layerMeta,[copy.id]:{...layerState(art,layer.id)}}});setSelectedId(copy.id);}
    else if(part){if(art.parts.length>=12){setNotice("装飾パーツは1本12個までです。");return;}const copy={...part,id:createLocalId("part"),x:Math.min(.7,part.x+.04)};commitArt({...art,parts:[...art.parts,copy],order:[...order,copy.id],layerMeta:{...art.layerMeta,[copy.id]:{...layerState(art,part.id)}}});setSelectedId(copy.id);}
  }
  function moveOrder(delta:number){if(locked||index<0||index+delta<0||index+delta>=order.length)return;const next=[...order];[next[index],next[index+delta]]=[next[index+delta],next[index]];commitArt({...art,order:next});}
  function place(id:string,point:{x:number;y:number}){const p=snap?{x:Math.abs(point.x)<.025?0:point.x,y:Math.abs(point.y)<.025?0:point.y}:point;const result=placeMaterial(doc,finger,id,p,brush);if(!result){setNotice("素材を配置できません。レイヤー上限または配置位置を確認してください。");return;}onCommit(result.document);setSelectedId(result.id);setTool("select");setMaterial(null);setMaterialsOpen(false);setNotice("素材を配置しました。ハンドルまたは設定で調整できます。");}
  function drop(id:string,client:{x:number;y:number}){const c=root.current?.querySelector<HTMLCanvasElement>(".paint-canvas"),p=c?canvasDropPoint(c,client,art.base):null;if(!p){setNotice("配置を取り消しました。素材を爪の内側へ置いてください。");return;}place(id,p);}
  function copySelection(){if(!selectedId)return;onClipboard(cloneFingerArt({...art,parts:part?[part]:[],layers:layer?[layer]:[],order:[selectedId],layerMeta:{[selectedId]:{...layerState(art,selectedId)}}}));setNotice("選択レイヤーをコピーしました。この編集画面内で別の指にも貼り付けできます。");}
  function paste(){if(!clipboard)return;const copy=cloneFingerArt(clipboard),added=copy.layers?.[0],p=copy.parts[0];if(art.parts.length+copy.parts.length>12||layers.length+(copy.layers?.length??0)>MAX_PAINT_LAYERS||layers.reduce((n,l)=>n+(l.type==="stroke"?l.points.length:0),0)+(added?.type==="stroke"?added.points.length:0)>MAX_FINGER_POINTS||layers.filter(l=>l.tool==="eraser").length+(added?.tool==="eraser"?1:0)>MAX_ERASERS){setNotice("レイヤー・装飾・点数の上限のため貼り付けできません。");return;}const id=added?.id??p?.id;if(!id)return;const shifted=added?{...added,x:Math.min(.7,added.x+.04)}:undefined;commitArt({...art,parts:p?[...art.parts,{...p,x:Math.min(.7,p.x+.04)}]:art.parts,layers:shifted?[...layers,shifted]:layers,order:[...order,id],layerMeta:{...art.layerMeta,[id]:{...layerState(copy,id),visible:true,locked:false}}});setSelectedId(id);setTool("select");setMaterial(null);}
  function nudge(dx:number,dy:number){const o=editorObject(art,selectedId);if(!o||locked)return;onCommit(replaceEditorObject(doc,finger,transformObject(o,"move",{x:0,y:0},{x:dx,y:dy},1,snap)));}
  function copy(all:boolean){
    const next={...doc,fingers:doc.fingers.map((f,i)=>(all||i===copyTo)?cloneFingerArt(art):f)};
    // Upgrade every finger together; old v1 data is not mutated in place.
    onCommit(replacePaintArt(next,finger,all?next.fingers[finger]:art));setNotice(all?"5本へコピーしました。元に戻すで取り消せます。":`${fingerNames[copyTo]}へコピーしました。`);
  }
  return <section ref={root} className={`nail-paint-editor${focused?" is-focused":""}`} role={focused?"dialog":undefined} aria-modal={focused?true:undefined} aria-label="手描きと図形の拡大編集">
    <header className="paint-heading"><h3>{fingerNames[finger]}に描く</h3><button type="button" className="secondary" aria-pressed={focused} onClick={()=>{if(!focused)setOptionsOpen(false);setFocused(v=>!v);}}>{focused?"通常表示に戻る":"画面を広く使う"}</button></header>
    <p className="hint paint-input-help">1本指で描画、「移動」で画面をドラッグ。2本指ならどのモードでも移動・ピンチできます。「全体表示」で爪先から根元まで戻せます。</p>
    <PaintViewControls tool={tool} placing={!!material} zoom={zoom} onTool={chooseTool} onMaterials={openMaterials} onView={changeView}/>
    <div className="paint-materials" hidden={!materialsOpen}><MaterialPalette selected={material} onChoose={id=>{setMaterial(id);setMaterialsOpen(false);setTool("select");setNotice(`${editorMaterials.find(m=>m.id===id)?.name??"素材"}の配置位置を爪の内側でタップしてください。`);focusCanvas();}} onDrop={drop}/></div>
    {material&&<p role="status">素材の配置待ちです。<button type="button" className="secondary" onClick={()=>setMaterial(null)}>素材配置をやめる</button></p>}
    <div className="paint-stage-shell"><PaintCanvas document={doc} finger={finger} tool={tool} style={brush} mirror={mirror} viewCommand={viewCommand} getInitialView={getInitialView} onView={onView} onZoom={setZoom} guide={guide} guideDepth={guideDepth} selectedId={selectedId} material={material} snap={snap} grid={grid} onPlace={place} onSelect={id=>{setSelectedId(id);if(!id)setMaterial(null);}} onBegin={onBegin} onPreview={onPreview} onCommit={onCommit} onCancel={onCancel} onNotice={setNotice} onUndo={onUndo} onRedo={onRedo} onDelete={remove} onCopy={copySelection} onPaste={paste}/></div>
    <div className="paint-quick-actions"><button type="button" aria-label="描画を元に戻す" onClick={onUndo} disabled={!canUndo}>元に戻す</button><button type="button" aria-label="描画をやり直す" onClick={onRedo} disabled={!canRedo}>やり直す</button>{onSave&&<button type="button" aria-label="制作データを保存" onClick={()=>{const r=onSave();setNotice(r.message);}}>保存</button>}{onTryOn&&<button type="button" aria-label="制作中の模様で試着" onClick={()=>{const r=onTryOn();if(!r.ok)setNotice(r.message);}}>試着</button>}<button type="button" className="secondary" aria-label="5本一覧に戻る" onClick={onClose}>一覧へ</button></div>
    {notice&&<p role="status" className="notice paint-notice">{notice}</p>}
    <details className="paint-options" open={optionsOpen} onToggle={e=>{setOptionsOpen(e.currentTarget.open);if(focused&&e.currentTarget.open)setMaterialsOpen(false);}}><summary>ブラシ・図形・レイヤーの設定</summary><div className="paint-options-scroll">
    <label>描画ツール<select value={tool} onChange={e=>chooseTool(e.target.value as DrawingTool|"pan")}>{Object.entries(drawingTools).map(([value,label])=><option key={value} value={value}>{label}</option>)}<option value="pan">表示を移動（描かない）</option></select></label>
    <details open><summary>{editingLayer?"選んだ線・図形の見た目":"ブラシ・図形の設定"}</summary><fieldset disabled={!!editingLayer&&locked} className="paint-style-grid">
      <label className="paint-check"><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/>中央揃え・回転スナップ</label><label className="paint-check"><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/>グリッド（保存しない）</label>
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
    </fieldset><p className="hint">消しゴムは下にある手描き・図形だけを消します。ベースと装飾は残ります。図形の線は枠線色を使います。</p><button type="button" className="secondary" onClick={focusCanvas}>描くキャンバスへ戻る</button></details>
    <details open><summary>レイヤー（後ろほど手前）</summary>
      <div className="paint-layer-list" role="group" aria-label="手描き・装飾のレイヤー">{order.map((id,i)=>{const m=layerState(art,id);return <button type="button" key={id} aria-pressed={selectedId===id} onClick={()=>{setMaterial(null);setSelectedId(id);setTool("select");}}>{i+1}. {m.name}{!m.visible?"（非表示）":""}{m.locked?"（固定）":""}</button>;})}</div>
      {meta&&selectedId&&<div className="paint-style-grid"><label>レイヤー名<input maxLength={64} value={meta.name} onChange={e=>onCommit(patchLayerState(doc,finger,selectedId,{name:e.target.value||"レイヤー"}))}/></label><label className="paint-check"><input type="checkbox" checked={meta.visible} onChange={e=>onCommit(patchLayerState(doc,finger,selectedId,{visible:e.target.checked}))}/>レイヤーを表示</label><label className="paint-check"><input type="checkbox" checked={meta.locked} onChange={e=>onCommit(patchLayerState(doc,finger,selectedId,{locked:e.target.checked}))}/>レイヤーをロック</label><label>レイヤー全体の不透明度<input type="range" min="0" max="1" step=".05" disabled={locked} value={meta.opacity} onChange={e=>onCommit(patchLayerState(doc,finger,selectedId,{opacity:Number(e.target.value)}))}/></label></div>}
      {!order.length&&<p className="hint">まだレイヤーはありません。キャンバスをなぞって描いてみましょう。</p>}
      {layer&&<fieldset disabled={locked} className="paint-style-grid">
        <label>レイヤーの横位置<input type="range" min="-.7" max=".7" step=".005" value={layer.x} onChange={e=>patchLayer({x:Number(e.target.value)})}/></label>
        <label>レイヤーの縦位置<input type="range" min="-.7" max=".7" step=".005" value={layer.y} onChange={e=>patchLayer({y:Number(e.target.value)})}/></label>
        <label>レイヤーの大きさ<input type="range" min=".1" max="3" step=".05" value={layer.scale} onChange={e=>patchLayer({scale:Number(e.target.value)})}/></label>
        <label>レイヤーの回転<input type="range" min="-180" max="180" step="1" value={layer.rotation} onChange={e=>patchLayer({rotation:Number(e.target.value)})}/></label>
        {layer.type==="shape"&&<><label>図形の幅<input type="range" min=".01" max="4" step=".01" value={layer.width} onChange={e=>{const v=Number(e.target.value);patchLayer({width:v,...(["circle","square"].includes(layer.tool)?{height:v}:{})});}}/></label><label>図形の高さ<input type="range" min=".01" max="4" step=".01" value={layer.height} onChange={e=>{const v=Number(e.target.value);patchLayer({height:v,...(["circle","square"].includes(layer.tool)?{width:v}:{})});}}/></label>{["curve","french"].includes(layer.tool)&&<label>曲線の曲がり<input type="range" min="-1" max="1" step=".05" value={layer.bend} onChange={e=>patchLayer({bend:Number(e.target.value)})}/></label>}</>}
      </fieldset>}
      {part&&<fieldset disabled={locked} className="paint-style-grid"><label>レイヤーパーツの色<input type="color" value={part.color} onChange={e=>commitArt({...art,parts:art.parts.map(p=>p.id===part.id?{...p,color:e.target.value}:p)})}/></label><label>レイヤーパーツの大きさ<input type="range" min=".06" max=".6" step=".01" value={part.size} onChange={e=>commitArt({...art,parts:art.parts.map(p=>p.id===part.id?{...p,size:Number(e.target.value)}:p)})}/></label><label>レイヤーパーツの回転<input type="range" min="-180" max="180" value={part.rotation} onChange={e=>commitArt({...art,parts:art.parts.map(p=>p.id===part.id?{...p,rotation:Number(e.target.value)}:p)})}/></label><label>パーツの横位置<input type="range" min="-.7" max=".7" step=".005" value={part.x} onChange={e=>commitArt({...art,parts:art.parts.map(p=>p.id===part.id?{...p,x:Number(e.target.value)}:p)})}/></label><label>パーツの縦位置<input type="range" min="-.7" max=".7" step=".005" value={part.y} onChange={e=>commitArt({...art,parts:art.parts.map(p=>p.id===part.id?{...p,y:Number(e.target.value)}:p)})}/></label></fieldset>}
      <div className="workshop-toolbar"><button type="button" disabled={!selectedId||locked} onClick={()=>nudge(-.005,0)}>左へ微調整</button><button type="button" disabled={!selectedId||locked} onClick={()=>nudge(.005,0)}>右へ微調整</button><button type="button" disabled={!selectedId||locked} onClick={()=>nudge(0,-.005)}>上へ微調整</button><button type="button" disabled={!selectedId||locked} onClick={()=>nudge(0,.005)}>下へ微調整</button></div>
      <div className="workshop-toolbar"><button type="button" disabled={!selectedId} onClick={copySelection}>レイヤーをコピー</button><button type="button" disabled={!clipboard} onClick={paste}>レイヤーを貼り付け</button><button type="button" disabled={!selectedId||locked} onClick={duplicate}>レイヤーを複製</button><button type="button" disabled={!selectedId||locked} onClick={remove}>レイヤーを削除</button><button type="button" disabled={locked||index<0||index===order.length-1} onClick={()=>moveOrder(1)}>レイヤーを手前へ</button><button type="button" disabled={locked||index<=0} onClick={()=>moveOrder(-1)}>レイヤーを奥へ</button></div>
    </details>
    <details><summary>ほかの指へ模様をコピー</summary><label>コピー先の指<select value={copyTo} onChange={e=>setCopyTo(Number(e.target.value))}>{fingerNames.map((name,i)=><option key={i} value={i} disabled={i===finger}>{name}</option>)}</select></label><div className="workshop-toolbar"><button type="button" onClick={()=>copy(false)}>この指へデザインをコピー</button><button type="button" onClick={()=>copy(true)}>手描きも装飾も5本へコピー</button></div><p className="hint">色・形・装飾もコピーします。コピー前のデザインはUndoで戻せます。</p></details>
    <p className="hint">1本につき手描き32レイヤー・4096点まで。長い線は最大256点へ間引いて滑らかにつなぎます。消しゴムは8本まで。拡大率と表示位置はデザインに保存しません。</p>
    </div></details>
  </section>;
}
