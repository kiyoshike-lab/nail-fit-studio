import { createLocalId } from "./storage";
import { artOrder, layerState, replacePaintArt } from "./paintData";
import { drawingTools, MAX_PAINT_LAYERS, type PaintPoint, type PaintStyle, type ShapeLayer, type ShapeTool } from "./paintTypes";
import { partNames, type DesignDocument, type FingerArt, type NailPart, type PartKind } from "./workshopTypes";
import { paintGeometry } from "./paintGeometry";

export type Material = {id:string;name:string;group:"基本図形"|"ネイル模様"|"立体風装飾";shape?:ShapeTool;part?:PartKind};
const basic:ShapeTool[]=["circle","ellipse","square","rectangle","diamond","triangle","pentagon","hexagon","star","heart","crescent","line","curve"];
const motifs:ShapeTool[]=["polka","tinyStars","flower","check","stripes","wave","lace","french","sparkle","bow","hearts","gradient"];
export const editorMaterials:readonly Material[]=[
  ...basic.map(shape=>({id:`shape:${shape}`,name:drawingTools[shape],group:"基本図形" as const,shape})),
  ...motifs.map(shape=>({id:`shape:${shape}`,name:drawingTools[shape],group:"ネイル模様" as const,shape})),
  ...(Object.keys(partNames) as PartKind[]).map(part=>({id:`part:${part}`,name:partNames[part],group:"立体風装飾" as const,part})),
];
export const materialCategories={basic:"基本図形",nature:"フラワー・自然",cute:"かわいい系",geometry:"幾何学・模様",elegant:"エレガント系",shiny:"光沢・装飾"} as const;
export type MaterialCategory=keyof typeof materialCategories;
export function materialCategoryIds(m:Material):MaterialCategory[]{
  const ids:MaterialCategory[]=[];
  if(m.group==="基本図形")ids.push("basic");
  if(["crescent","flower","wave"].includes(m.shape??"")||["flower","shell"].includes(m.part??""))ids.push("nature");
  if(["heart","hearts","bow","tinyStars"].includes(m.shape??"")||["heart","ribbon","star","flower"].includes(m.part??""))ids.push("cute");
  if(["polka","check","stripes","line","curve","hexagon","pentagon","diamond","triangle","square","rectangle","gradient"].includes(m.shape??""))ids.push("geometry");
  if(["lace","french","curve","line","gradient"].includes(m.shape??"")||["pearl","crystal","rhinestone"].includes(m.part??""))ids.push("elegant");
  if(m.part||m.shape==="sparkle")ids.push("shiny");
  return ids;
}
export function filterEditorMaterials(query:string,group:Material["group"]|"すべて",category:MaterialCategory|""){
  const words=query.slice(0,120).normalize("NFKC").toLocaleLowerCase("ja").split(/\s+/).filter(Boolean);
  return editorMaterials.filter(m=>(group==="すべて"||m.group===group)&&(!category||materialCategoryIds(m).includes(category))&&words.every(q=>`${m.name} ${m.id} ${materialCategoryIds(m).map(id=>materialCategories[id]).join(" ")}`.toLocaleLowerCase("ja").includes(q)));
}
export function materialObject(material:Material,point:PaintPoint,aspect:number,style:PaintStyle):ShapeLayer|NailPart {
  const common={id:createLocalId("material"),x:point.x,y:point.y/aspect,rotation:0};
  if(material.part)return {...common,kind:material.part,color:material.part==="pearl"?"#fff1e6":material.part==="gold-holo"?"#e6bc65":"#d9dfed",size:.24};
  const tool=material.shape!;
  const width=["gradient"].includes(tool)?1:["polka","check","stripes","lace","hearts","tinyStars"].includes(tool)?.65:["line","curve","french","wave"].includes(tool)?.55:.3;
  const height=tool==="gradient"?Math.min(4,aspect):["ellipse","rectangle"].includes(tool)?.2:["line","curve","french","wave"].includes(tool)?.14:width;
  return {...style,...common,type:"shape",tool,width,height,bend:.6,scale:1,mirror:false};
}
export function placeMaterial(doc:DesignDocument,finger:number,id:string,point:PaintPoint,style:PaintStyle) {
  const material=editorMaterials.find(m=>m.id===id),art=doc.fingers[finger];
  if(!material||!art||![point.x,point.y].every(Number.isFinite))return null;
  const g=paintGeometry(100,160,art.base),object=materialObject(material,point,g.height/g.width,style);
  if(Math.abs(object.x)>.7||Math.abs(object.y)>.7)return null;
  if("kind"in object?art.parts.length>=12:(art.layers?.length??0)>=MAX_PAINT_LAYERS)return null;
  const next:FingerArt="kind"in object?{...art,parts:[...art.parts,object]}:{...art,layers:[...(art.layers??[]),object]};
  next.order=[...artOrder(art),object.id];
  return {document:replacePaintArt(doc,finger,next),id:object.id};
}
export function patchLayerState(doc:DesignDocument,finger:number,id:string,patch:Partial<ReturnType<typeof layerState>>) {
  const art=doc.fingers[finger];if(!artOrder(art).includes(id))return doc;
  return replacePaintArt(doc,finger,{...art,layerMeta:{...art.layerMeta,[id]:{...layerState(art,id),...patch}}});
}
