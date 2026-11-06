"use client";
import { isStrokeTool, type DrawingTool } from "@/lib/paintTypes";
import { MIN_PAINT_ZOOM, MAX_PAINT_ZOOM, type PaintViewCommand } from "@/lib/paintViewport";
type Props={tool:DrawingTool|"pan";placing:boolean;zoom:number;onTool:(tool:DrawingTool|"pan")=>void;onMaterials:()=>void;onView:(action:PaintViewCommand["action"])=>void};
export function PaintViewControls({tool,placing,zoom,onTool,onMaterials,onView}:Props){
  return <div className="paint-navigation-controls">
    <div className="paint-mode-controls" role="group" aria-label="編集の操作モード">
      <button type="button" aria-pressed={!placing&&tool!=="pan"&&isStrokeTool(tool)} onClick={()=>onTool("pen")}>描く</button>
      <button type="button" aria-pressed={!placing&&tool==="pan"} onClick={()=>onTool("pan")}>移動</button>
      <button type="button" aria-pressed={!placing&&tool==="select"} onClick={()=>onTool("select")}>選択</button>
      <button type="button" aria-pressed={!placing&&tool!=="pan"&&tool!=="select"&&!isStrokeTool(tool)} onClick={()=>onTool("circle")}>図形</button>
      <button type="button" aria-pressed={placing} onClick={onMaterials}>素材</button>
    </div>
    <div className="paint-view-controls" role="group" aria-label="キャンバスの表示操作">
      <button type="button" className="secondary" aria-label="縮小" disabled={zoom<=MIN_PAINT_ZOOM+.001} onClick={()=>onView("out")}>−</button>
      <output aria-label="編集の表示倍率" aria-live="off">{Math.round(zoom*100)}%</output>
      <button type="button" className="secondary" aria-label="拡大" disabled={zoom>=MAX_PAINT_ZOOM-.001} onClick={()=>onView("in")}>＋</button>
      <button type="button" className="secondary" onClick={()=>onView("actual")}>100%表示</button>
      <button type="button" className="secondary" onClick={()=>onView("fit")}>全体表示</button>
    </div>
  </div>;
}
