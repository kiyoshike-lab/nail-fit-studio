import { artOrder } from "./paintData";
import type { PaintLayer, StrokeLayer } from "./paintTypes";
import type { FingerArt, NailPart } from "./workshopTypes";

type Eraser = { layer:StrokeLayer; opacity:number };
export type PaintCommand = { object:PaintLayer|NailPart; opacity:number; erasers:readonly Eraser[] };
export type PaintSurfaceEntry = { commands:readonly PaintCommand[]; surface:HTMLCanvasElement; prefix?:HTMLCanvasElement; w:number; h:number; light:boolean; brightness:number };
const defaultVisual={visible:true,opacity:1};
const visual=(art:FingerArt,id:string)=>art.layerMeta&&Object.hasOwn(art.layerMeta,id)?art.layerMeta[id]:defaultVisual;
const recipes=new WeakMap<FingerArt,{parts:FingerArt["parts"];layers:FingerArt["layers"];order:FingerArt["order"];meta:FingerArt["layerMeta"];commands:PaintCommand[]}>();

// Only visual dependencies belong in the key: names, locks, base color and the
// FingerArt wrapper change while editing but do not change this transparent art.
// Objects/point arrays are immutable, as required by the existing editor/history.
export function paintCommands(art:FingerArt):PaintCommand[]{
  const prior=recipes.get(art);
  if(prior&&prior.parts===art.parts&&prior.layers===art.layers&&prior.order===art.order&&prior.meta===art.layerMeta)return prior.commands;
  const objects=new Map<string,PaintLayer|NailPart>([...art.parts,...art.layers??[]].map(o=>[o.id,o]));
  const order=artOrder(art),commands:PaintCommand[]=[],erasers:Eraser[]=[];
  for(let i=order.length-1;i>=0;i--){const object=objects.get(order[i]),m=visual(art,order[i]);if(!object||!m.visible||m.opacity===0)continue;
    if("tool"in object&&object.type==="stroke"&&object.tool==="eraser")erasers.push({layer:object,opacity:m.opacity});
    else commands.push({object,opacity:m.opacity,erasers:"kind"in object?[]:[...erasers]});
  }
  commands.reverse();recipes.set(art,{parts:art.parts,layers:art.layers,order:art.order,meta:art.layerMeta,commands});return commands;
}
export function samePaintCommands(a:readonly PaintCommand[],b:readonly PaintCommand[],length?:number):boolean{
  if(length===undefined){if(a.length!==b.length)return false;length=a.length;}
  if(a.length<length||b.length<length)return false;
  if(a===b)return true;
  for(let i=0;i<length;i++){
    const x=a[i],y=b[i];if(x.object!==y.object||x.opacity!==y.opacity||x.erasers.length!==y.erasers.length)return false;
    for(let j=0;j<x.erasers.length;j++)if(x.erasers[j].layer!==y.erasers[j].layer||x.erasers[j].opacity!==y.erasers[j].opacity)return false;
  }return true;
}

// Exact destination sizes, NOT scale buckets/resampled thumbnails. Multiple
// recent sizes survive distance jitter. Shared immutable prefix canvases have
// reference counts so eviction never clears a canvas still used by another entry.
export class PaintSurfaceCache {
  constructor(readonly maxPixels=4_000_000,private readonly maxEntries=512,private readonly maxPerSize=16){}
  private entries=new Map<PaintSurfaceEntry,string>();
  private sizes=new Map<string,PaintSurfaceEntry[]>();
  private refs=new Map<HTMLCanvasElement,number>();
  private usedPixels=0;
  private counters={hits:0,prefixHits:0,misses:0,evictions:0};
  private key(w:number,h:number,light:boolean,brightness:number){return `${w}/${h}/${light?1:0}/${brightness}`;}
  private touch(e:PaintSurfaceEntry){const key=this.entries.get(e)!;this.entries.delete(e);this.entries.set(e,key);const bucket=this.sizes.get(key)!;if(bucket.at(-1)!==e){bucket.splice(bucket.indexOf(e),1);bucket.push(e);}}
  private hold(c:HTMLCanvasElement){if(!this.refs.has(c)){c.addEventListener?.("contextlost",()=>this.clear(),{once:true});this.usedPixels+=c.width*c.height;}this.refs.set(c,(this.refs.get(c)??0)+1);}
  private release(c:HTMLCanvasElement){const refs=this.refs.get(c)!-1;if(refs)this.refs.set(c,refs);else{this.refs.delete(c);this.usedPixels-=c.width*c.height;c.width=c.height=1;}}
  private evict(old:PaintSurfaceEntry){const key=this.entries.get(old)!;this.entries.delete(old);this.counters.evictions++;const bucket=this.sizes.get(key)!;bucket.splice(bucket.indexOf(old),1);if(!bucket.length)this.sizes.delete(key);this.release(old.surface);if(old.prefix&&old.prefix!==old.surface)this.release(old.prefix);}
  find(commands:readonly PaintCommand[],w:number,h:number,light:boolean,brightness:number,prefixAllowed=true):{surface:HTMLCanvasElement|undefined;prefix:HTMLCanvasElement|undefined;retainPrefix?:boolean}{
    const sizes=this.sizes.get(this.key(w,h,light,brightness));
    if(sizes)for(let i=sizes.length-1;i>=0;i--){const e=sizes[i];if(e.commands.length===commands.length&&samePaintCommands(e.commands,commands)){this.counters.hits++;this.touch(e);return{surface:e.surface,prefix:undefined};}}
    const n=commands.length-1;
    let retainPrefix=false;
    if(n>0&&prefixAllowed&&sizes)for(let i=sizes.length-1;i>=0;i--){const e=sizes[i];
      if(e.commands.length===n&&samePaintCommands(e.commands,commands,n)){this.counters.prefixHits++;this.touch(e);return{surface:undefined,prefix:e.surface};}
      if(e.commands.length===commands.length&&samePaintCommands(e.commands,commands,n)){
        if(e.prefix){this.counters.prefixHits++;this.touch(e);return{surface:undefined,prefix:e.prefix};}
        retainPrefix=true;
      }
    }
    this.counters.misses++;return{surface:undefined,prefix:undefined,retainPrefix};
  }
  add(entry:PaintSurfaceEntry){
    if(entry.surface.width*entry.surface.height+(entry.prefix?entry.prefix.width*entry.prefix.height:0)>this.maxPixels)throw Error("Paint cache entry exceeds safety limit");
    if(this.entries.has(entry)){this.touch(entry);return;}
    this.hold(entry.surface);if(entry.prefix&&entry.prefix!==entry.surface)this.hold(entry.prefix);
    const key=this.key(entry.w,entry.h,entry.light,entry.brightness),bucket=this.sizes.get(key);
    if(bucket)bucket.push(entry);else this.sizes.set(key,[entry]);this.entries.set(entry,key);
    const versions=this.sizes.get(key)!;while(versions.length>this.maxPerSize)this.evict(versions[0]);
    while(this.entries.size>this.maxEntries||this.usedPixels>this.maxPixels)this.evict(this.entries.keys().next().value!);
  }
  clear(){for(const c of this.refs.keys())c.width=c.height=1;this.refs.clear();this.entries.clear();this.sizes.clear();this.usedPixels=0;this.counters={hits:0,prefixHits:0,misses:0,evictions:0};}
  stats(){return{...this.counters,entries:this.entries.size,surfaces:this.refs.size,pixels:this.usedPixels,maxPixels:this.maxPixels,maxEntries:this.maxEntries,maxPerSize:this.maxPerSize};}
}
