import { parseDocument } from "./workshopData";
import type { DesignDocument } from "./workshopTypes";
export const WORKSHOP_RECOVERY="nail-fit-studio-next.workshop-recovery.v1";
const MAX_RECOVERY_CHARS=700_000,MAX_RECOVERY_DOCUMENTS=5;
export function readWorkshopRecovery():{ok:boolean;documents:DesignDocument[]}{
  if(typeof window==="undefined")return{ok:true,documents:[]};
  try{
    const raw=window.localStorage.getItem(WORKSHOP_RECOVERY);if(!raw)return{ok:true,documents:[]};
    if(raw.length>MAX_RECOVERY_CHARS)return{ok:false,documents:[]};const v=JSON.parse(raw);
    if(!v||v.schema!==1||!Array.isArray(v.documents)||v.documents.length>MAX_RECOVERY_DOCUMENTS)return{ok:false,documents:[]};
    const documents:DesignDocument[]=[];for(const value of v.documents){const d=parseDocument(value);if(!d||documents.some(old=>old.id===d.id))return{ok:false,documents:[]};documents.push(d);}
    return{ok:true,documents};
  }catch{return{ok:false,documents:[]};}
}
function write(documents:DesignDocument[]):boolean{
  try{const json=JSON.stringify({schema:1,documents});if(json.length>MAX_RECOVERY_CHARS)return false;window.localStorage.setItem(WORKSHOP_RECOVERY,json);return true;}catch{return false;}
}
export function saveWorkshopRecovery(document:DesignDocument):boolean{
  const d=parseDocument(document),old=readWorkshopRecovery();if(!d||!old.ok)return false;
  const other=old.documents.filter(o=>o.id!==d.id);if(other.length>=MAX_RECOVERY_DOCUMENTS)return false;
  // Never evict another unsaved project to make room for a new one.
  return write([d,...other]);
}
export function deleteWorkshopRecovery(id:string):boolean{
  const old=readWorkshopRecovery();if(!old.ok)return false;if(!old.documents.some(d=>d.id===id))return true;
  return write(old.documents.filter(d=>d.id!==id));
}
