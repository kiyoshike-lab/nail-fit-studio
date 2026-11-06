import { createLocalId } from "./storage";
import { drawingTools, isStrokeTool, MAX_ERASERS, MAX_FINGER_POINTS, MAX_PAINT_LAYERS, MAX_STROKE_POINTS, type DrawingTool, type PaintLayer, type PaintPoint, type PaintStyle, type ShapeLayer, type StrokeTool } from "./paintTypes";
import type { DesignDocument, FingerArt } from "./workshopTypes";

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const range = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const hex = (v: unknown): v is string => typeof v === "string" && /^#[\da-f]{6}$/i.test(v);
export function parsePaintLayers(value: unknown): PaintLayer[] | null {
  if (!Array.isArray(value) || value.length > MAX_PAINT_LAYERS) return null;
  let points = 0, erasers = 0;
  const result: PaintLayer[] = [], ids = new Set<string>();
  for (const v of value) {
    if (!record(v) || typeof v.id !== "string" || !v.id.trim() || v.id.length > 120 || /[\u0000-\u001f]/.test(v.id) || ids.has(v.id)
      || typeof v.tool !== "string" || v.tool === "select" || !Object.hasOwn(drawingTools, v.tool)
      || !range(v.x, -.7, .7) || !range(v.y, -.7, .7) || !range(v.scale, .1, 3) || !range(v.rotation, -180, 180)
      || typeof v.mirror !== "boolean" || !hex(v.color) || !hex(v.strokeColor) || !hex(v.secondary) || !range(v.opacity, 0, 1)
      || !range(v.lineWidth, .003, .3) || !range(v.spacing, .3, 6) || typeof v.fill !== "boolean" || typeof v.stroke !== "boolean") return null;
    ids.add(v.id);
    const shared = {id:v.id,x:v.x,y:v.y,scale:v.scale,rotation:v.rotation,mirror:v.mirror,color:v.color,strokeColor:v.strokeColor,secondary:v.secondary,opacity:v.opacity,lineWidth:v.lineWidth,spacing:v.spacing,fill:v.fill,stroke:v.stroke};
    if (v.type === "stroke" && isStrokeTool(v.tool as DrawingTool)) {
      if (!Array.isArray(v.points) || !v.points.length || v.points.length > MAX_STROKE_POINTS) return null;
      const path: PaintPoint[] = [];
      for (const p of v.points) { if (!record(p) || !range(p.x,-4,4) || !range(p.y,-4,4)) return null; path.push({x:p.x,y:p.y}); }
      points += path.length; if (v.tool === "eraser") erasers++;
      result.push({...shared,type:"stroke",tool:v.tool as StrokeTool,points:path});
    } else if (v.type === "shape" && !isStrokeTool(v.tool as DrawingTool)) {
      if (!range(v.width,.01,4) || !range(v.height,.01,4) || !range(v.bend,-1,1)
        || (["circle","square"].includes(v.tool) && Math.abs(v.width-v.height)>1e-8)) return null;
      result.push({...shared,type:"shape",tool:v.tool as ShapeLayer["tool"],width:v.width,height:v.height,bend:v.bend});
    } else return null;
  }
  return points <= MAX_FINGER_POINTS && erasers <= MAX_ERASERS ? result : null;
}

export function artOrder(art: FingerArt): string[] {
  const ids = [...art.parts.map(p=>p.id), ...(art.layers??[]).map(l=>l.id)], valid = new Set(ids);
  const order = (art.order??[]).filter((id,i,list)=>valid.has(id)&&list.indexOf(id)===i);
  return [...order,...ids.filter(id=>!order.includes(id))];
}
export function upgradePaintDocument(doc: DesignDocument): DesignDocument {
  if(doc.schema===2)return doc;
  return {...doc,schema:2,fingers:doc.fingers.map(f=>({...f,layers:f.layers??[],order:artOrder(f)}))};
}
export function replacePaintArt(doc: DesignDocument, finger: number, art: FingerArt): DesignDocument {
  const upgraded=upgradePaintDocument(doc);
  return {...upgraded,fingers:upgraded.fingers.map((f,i)=>i===finger?{...art,layers:art.layers??[],order:artOrder(art)}:f)};
}
export function cloneFingerArt(art: FingerArt): FingerArt {
  const ids = new Map<string,string>();
  const fresh = (id:string) => {const next=createLocalId("layer");ids.set(id,next);return next;};
  const parts=art.parts.map(p=>({...p,id:fresh(p.id)}));
  const layers=art.layers?.map(l=>({...l,id:fresh(l.id),...(l.type==="stroke"?{points:l.points.map(p=>({...p}))}:{})}) as PaintLayer);
  return {...art,base:{...art.base},parts,...(layers?{layers,order:artOrder(art).map(id=>ids.get(id)!)}:{})};
}
export const defaultPaintStyle: PaintStyle = {color:"#83324e",strokeColor:"#83324e",secondary:"#fff7fa",opacity:1,lineWidth:.035,fill:true,stroke:true,spacing:1.8};
export const boundedPoint = (p:PaintPoint): PaintPoint => ({x:Math.round(Math.max(-4,Math.min(4,p.x))*100000)/100000,y:Math.round(Math.max(-4,Math.min(4,p.y))*100000)/100000});
export function appendPoint(points: PaintPoint[], p: PaintPoint, limit=MAX_STROKE_POINTS): PaintPoint[] {
  const next=boundedPoint(p), last=points.at(-1);
  if(last&&Math.hypot(next.x-last.x,next.y-last.y)<.002) return points;
  const all=[...points,next];
  // Reduce only the active gesture; retain both endpoints, bounded work/storage.
  return all.length>limit ? [all[0],...all.slice(1,-1).filter((_,i)=>i%2===0).slice(0,Math.max(0,limit-2)),all.at(-1)!] : all;
}
export function makeShape(tool: ShapeLayer["tool"], a:PaintPoint, b:PaintPoint, aspect:number, style:PaintStyle, mirror:boolean): ShapeLayer {
  let dx=b.x-a.x,dy=b.y-a.y;
  if(tool==="circle"||tool==="square"){const side=Math.max(Math.abs(dx),Math.abs(dy),.01);dx=(dx<0?-1:1)*side;dy=(dy<0?-1:1)*side;}
  const width=Math.min(4,Math.max(.01,Math.abs(dx))),height=Math.min(4,Math.max(.01,Math.abs(dy)));
  const lineLike=["line","curve","french"].includes(tool);
  return {...style,id:createLocalId("shape"),type:"shape",tool,x:Math.max(-.7,Math.min(.7,a.x+dx/2)),y:Math.max(-.7,Math.min(.7,(a.y+dy/2)/aspect)),width:lineLike?Math.min(4,Math.max(.01,Math.hypot(dx,dy))):width,height:lineLike?Math.max(.01,Math.hypot(dx,dy)*.35):height,rotation:lineLike?Math.atan2(dy,dx)*180/Math.PI:0,scale:1,mirror,bend:tool==="french"?.7:.35};
}
