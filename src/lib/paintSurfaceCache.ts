import { artOrder } from "./paintData";
import type { PaintLayer, StrokeLayer } from "./paintTypes";
import type { FingerArt, NailPart } from "./workshopTypes";

type Eraser = { layer:StrokeLayer; opacity:number };
export type PaintCommand = { object:PaintLayer|NailPart; opacity:number; erasers:readonly Eraser[] };
export type PaintSurfaceEntry = { commands:readonly PaintCommand[]; surface:HTMLCanvasElement; prefix?:HTMLCanvasElement; w:number; h:number; light:boolean; brightness:number };
const defaultVisual={visible:true,opacity:1};
const visual=(art:FingerArt,id:string)=>art.layerMeta&&Object.hasOwn(art.layerMeta,id)?art.layerMeta[id]:defaultVisual;

// Only visual dependencies belong in the key: names, locks, base color and the
// FingerArt wrapper change while editing but do not change this transparent art.
// Objects/point arrays are immutable, as required by the existing editor/history.
export function paintCommands(art:FingerArt):PaintCommand[]{
  const objects=new Map<string,PaintLayer|NailPart>([...art.parts,...art.layers??[]].map(o=>[o.id,o]));
  const order=artOrder(art),commands:PaintCommand[]=[],erasers:Eraser[]=[];
  for(let i=order.length-1;i>=0;i--){const object=objects.get(order[i]),m=visual(art,order[i]);if(!object||!m.visible||m.opacity===0)continue;
    if("tool"in object&&object.type==="stroke"&&object.tool==="eraser")erasers.push({layer:object,opacity:m.opacity});
    else commands.push({object,opacity:m.opacity,erasers:"kind"in object?[]:[...erasers]});
  }
  return commands.reverse();
}
export function samePaintCommands(a:readonly PaintCommand[],b:readonly PaintCommand[],length?:number):boolean{
  if(length===undefined){if(a.length!==b.length)return false;length=a.length;}
  if(a.length<length||b.length<length)return false;
  for(let i=0;i<length;i++){
    const x=a[i],y=b[i];if(x.object!==y.object||x.opacity!==y.opacity||x.erasers.length!==y.erasers.length)return false;
    for(let j=0;j<x.erasers.length;j++)if(x.erasers[j].layer!==y.erasers[j].layer||x.erasers[j].opacity!==y.erasers[j].opacity)return false;
  }return true;
}

// Exact destination sizes, NOT scale buckets/resampled thumbnails. Multiple
// recent sizes survive distance jitter. Shared immutable prefix canvases have
// reference counts so eviction never clears a canvas still used by another entry.
export class PaintSurfaceCache {
  readonly maxPixels=4_000_000;
  private entries:PaintSurfaceEntry[]=[];
  private refs=new Map<HTMLCanvasElement,number>();
  private counters={hits:0,prefixHits:0,misses:0,evictions:0};
  private pixels(){let n=0;for(const c of this.refs.keys())n+=c.width*c.height;return n;}
  private touch(e:PaintSurfaceEntry){this.entries.splice(this.entries.indexOf(e),1);this.entries.push(e);}
  find(commands:readonly PaintCommand[],w:number,h:number,light:boolean,brightness:number,prefixAllowed=true){
    const sizes=this.entries.filter(e=>e.w===w&&e.h===h&&e.light===light&&e.brightness===brightness);
    const exact=[...sizes].reverse().find(e=>e.commands.length===commands.length&&samePaintCommands(e.commands,commands));
    if(exact){this.counters.hits++;this.touch(exact);return{surface:exact.surface,prefix:undefined};}
    const n=commands.length-1;
    if(n>0&&prefixAllowed)for(let i=sizes.length-1;i>=0;i--){const e=sizes[i];
      if(e.commands.length===n&&samePaintCommands(e.commands,commands,n)){this.counters.prefixHits++;this.touch(e);return{surface:undefined,prefix:e.surface};}
      if(e.prefix&&e.commands.length===commands.length&&samePaintCommands(e.commands,commands,n)){this.counters.prefixHits++;this.touch(e);return{surface:undefined,prefix:e.prefix};}
    }
    this.counters.misses++;return{surface:undefined,prefix:undefined};
  }
  add(entry:PaintSurfaceEntry){
    if(entry.surface.width*entry.surface.height+(entry.prefix?entry.prefix.width*entry.prefix.height:0)>this.maxPixels)throw Error("Paint cache entry exceeds safety limit");
    for(const c of new Set([entry.surface,...entry.prefix?[entry.prefix]:[]])){
      if(!this.refs.has(c))c.addEventListener?.("contextlost",()=>this.clear(),{once:true});
      this.refs.set(c,(this.refs.get(c)??0)+1);
    }
    this.entries.push(entry);
    while(this.entries.length>20||this.pixels()>this.maxPixels){const old=this.entries.shift()!;this.counters.evictions++;
      for(const c of new Set([old.surface,...old.prefix?[old.prefix]:[]])){const refs=this.refs.get(c)!-1;if(refs)this.refs.set(c,refs);else{this.refs.delete(c);c.width=c.height=1;}}
    }
  }
  clear(){for(const c of this.refs.keys())c.width=c.height=1;this.refs.clear();this.entries=[];this.counters={hits:0,prefixHits:0,misses:0,evictions:0};}
  stats(){return{...this.counters,entries:this.entries.length,surfaces:this.refs.size,pixels:this.pixels(),maxPixels:this.maxPixels};}
}
