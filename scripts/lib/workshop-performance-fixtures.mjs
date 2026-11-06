import assert from 'node:assert/strict';
import {importTypescript} from './import-typescript.mjs';
// Rounded, deterministic ORIGINAL vectors. All fixtures must pass the actual
// parser and whole-library 700k storage bound; no impossible "maximum" payload.
export async function workshopPerformanceFixtures(){
 const w=await importTypescript('src/lib/workshopData.ts'),p=await importTypescript('src/lib/paintData.ts'),styles=await importTypescript('src/lib/nailStyles.ts');
 const round=n=>Math.round(n*100000)/100000;
 const fixtures=[];
 for(const [name,count,parts]of[['light',0,0],['objects10',1,1],['standard',3,3],['objects100',12,8],['heavy',24,8],['maximum',32,12]]){
  let d=p.upgradePaintDocument(w.createDocument());d={...d,id:'qa-'+name,name:'性能評価 '+name,createdAt:'2026-11-06T00:00:00Z',updatedAt:'2026-11-06T00:00:00Z',schema:4};
  d.fingers=d.fingers.map((f,finger)=>{
   const layers=Array.from({length:count},(_,i)=>{
    const eraser=count>=24&&i>=count-(count===32?8:4),shape=!eraser&&count===24&&i%5===0;
    const tool=eraser?'eraser':shape?['circle','diamond','heart','lace'][Math.floor(i/5)%4]:['pen','brush','dots','holo'][i%4];
    const common={...p.defaultPaintStyle,id:`f${finger}-l${i}`,tool,x:0,y:0,rotation:i*4-60,scale:1,mirror:i%7===0,opacity:eraser?.4:.8,lineWidth:.025,spacing:1.8};
    return shape?{...common,type:'shape',width:.4,height:.4,bend:.4}:{...common,type:'stroke',points:Array.from({length:count===32?128:count===24?96:32},(_,n)=>({x:round(n/(count===32?127:count===24?95:31)*.6-.3),y:round(Math.sin(n*.14+i)*.2)}))};
   });
   const ps=Array.from({length:parts},(_,i)=>({id:`f${finger}-p${i}`,kind:['pearl','crystal','ribbon','shell'][i%4],x:round((i%3-1)*.2),y:round((Math.floor(i/3)-1.5)*.15),size:.14,color:'#efd5e4',rotation:i*12-60}));
   return p.withLayerMeta({...f,...(count?{surface:{...styles.nailStyles.find(s=>s.id==='sheer').surface}}:{}),layers,parts:ps,order:[...ps.map(v=>v.id),...layers.map(v=>v.id)]});
  });
  assert.ok(w.parseDocument(d),name+' parser');const json=JSON.stringify({schema:1,entries:[{folder:'created',document:d}]});assert.ok(json.length<=700000,name+' must really be saveable');
  fixtures.push({name,document:d,serializedCharacters:json.length,layersPerFinger:count,partsPerFinger:parts,pointsPerFinger:d.fingers[0].layers.reduce((n,l)=>n+(l.points?.length??0),0)});
 }
 return fixtures;
}
