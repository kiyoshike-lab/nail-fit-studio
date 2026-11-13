// Scratch/mask images only: never retain finished artwork here. Exact-size reuse
// avoids reallocating backing stores while editing; there is NO resampling.
const pool:HTMLCanvasElement[]=[];
const maxPixels=1_000_000,maxEntries=24;
let pixels=0;
export const paintScratchStats=()=>({entries:pool.length,pixels,maxPixels,maxEntries});
export function clearPaintScratch(){for(const c of pool)c.width=c.height=1;pool.length=0;pixels=0;}
export function takePaintScratch(w:number,h:number):HTMLCanvasElement{
  const i=pool.findIndex(c=>c.width===w&&c.height===h);
  if(i>=0){
    const c=pool.splice(i,1)[0];pixels-=w*h;
    const ctx=c.getContext("2d");
    // Returned contexts have balanced save/restore and identity transforms.
    if(ctx&&!ctx.isContextLost?.()){ctx.clearRect(0,0,w,h);return c;}
    c.width=c.height=1;
  }
  const c=document.createElement("canvas");c.width=w;c.height=h;
  c.addEventListener("contextlost",clearPaintScratch,{once:true});return c;
}
export function returnPaintScratch(c:HTMLCanvasElement){
  if(c.width*c.height>maxPixels){c.width=c.height=1;return;}
  pool.push(c);pixels+=c.width*c.height;
  while(pool.length>maxEntries||pixels>maxPixels){const old=pool.shift()!;pixels-=old.width*old.height;old.width=old.height=1;}
}
