export function clearLocalAppData(storage:Pick<Storage,"length"|"key"|"removeItem"|"getItem">):{ok:boolean;removed:number} {
  let removed=0;
  try{
    const keys:string[]=[];
    for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith("nail-fit-studio-next."))keys.push(key);}
    for(const key of keys){storage.removeItem(key);if(storage.getItem(key)!==null)return{ok:false,removed};removed++;}
    return{ok:true,removed};
  }catch{return{ok:false,removed};}
}
