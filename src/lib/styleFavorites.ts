import { surfaceKinds } from "./surfaceTypes";
export const STYLE_FAVORITES = "nail-fit-studio-next.style-favorites.v1";
export const STYLE_FAVORITES_EVENT = "nail-style-favorites-changed";
export function favoriteSnapshot(): string {
  if(typeof window==="undefined")return "";
  try {const s=window.localStorage.getItem(STYLE_FAVORITES)??"";return s.length>4000?"invalid":s;}catch{return "unavailable";}
}
export function parseStyleFavorites(s:string): string[] | null {
  if(!s)return [];
  try {const v=JSON.parse(s);return v&&v.schema===1&&Array.isArray(v.ids)&&v.ids.length<=surfaceKinds.length&&new Set(v.ids).size===v.ids.length&&v.ids.every((id:unknown)=>typeof id==="string"&&(surfaceKinds as readonly string[]).includes(id))?[...v.ids]:null;}catch{return null;}
}
export function toggleStyleFavorite(id:string): boolean {
  const old=parseStyleFavorites(favoriteSnapshot());if(!old||!(surfaceKinds as readonly string[]).includes(id))return false;
  const ids=old.includes(id)?old.filter(v=>v!==id):[...old,id];
  try {window.localStorage.setItem(STYLE_FAVORITES,JSON.stringify({schema:1,ids}));window.dispatchEvent(new Event(STYLE_FAVORITES_EVENT));return true;}catch{return false;}
}
export function subscribeStyleFavorites(listener:()=>void) {
  const changed=(e:StorageEvent)=>{if(e.key===STYLE_FAVORITES||e.key===null)listener();};
  window.addEventListener("storage",changed);window.addEventListener(STYLE_FAVORITES_EVENT,listener);
  return ()=>{window.removeEventListener("storage",changed);window.removeEventListener(STYLE_FAVORITES_EVENT,listener);};
}
