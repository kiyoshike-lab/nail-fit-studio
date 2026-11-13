import assert from 'node:assert/strict';
import {importTypescript} from './import-typescript.mjs';
import {workshopPerformanceFixtures} from './workshop-performance-fixtures.mjs';

// Same valid documents on both sides of the comparison. No impossible payload
// or new runtime schema; E is also the existing --max-art camera fixture F.
export async function realismPerformanceFixtures(){
 const fixtures=await workshopPerformanceFixtures(),{nailStyles}=await importTypescript('src/lib/nailStyles.ts'),{parseDocument}=await importTypescript('src/lib/workshopData.ts'),{withLayerMeta}=await importTypescript('src/lib/paintData.ts');
 const make=(id,style,parts)=>{
  const d=structuredClone(fixtures.find(f=>f.name==='light').document),s=nailStyles.find(s=>s.id===style);
  d.id='qa-realism-'+id;d.fingers=d.fingers.map((f,finger)=>{const ps=Array.from({length:parts},(_,i)=>({id:`f${finger}-p${i}`,kind:id==='C'?(i%2?'crystal':'rhinestone'):['rhinestone','pearl','crystal'][i%3],x:(i%3-1)*.2,y:(Math.floor(i/3)-1.5)*.15,size:.14,color:'#efd5e4',rotation:i*12-60}));return withLayerMeta({...f,base:{...f.base,color:s.color,tipColor:s.tipColor},surface:{...s.surface},parts:ps,order:ps.map(p=>p.id),layerMeta:{}});});
  assert.ok(parseDocument(d));return{id,document:d};
 };
 const result=[make('A','color',0),make('B','glitter',0),make('C','color',12),make('D','glitter',12),{id:'E',document:fixtures.find(f=>f.name==='maximum').document}];
 for(const f of result){assert.ok(parseDocument(f.document));assert.ok(JSON.stringify({schema:1,entries:[{folder:'created',document:f.document}]}).length<=700000);}
 return result;
}
