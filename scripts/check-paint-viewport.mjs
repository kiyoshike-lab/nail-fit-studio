import assert from 'node:assert/strict';import{importTypescript}from'./lib/import-typescript.mjs';
const v=await importTypescript('src/lib/paintViewport.ts'),g=await importTypescript('src/lib/paintGeometry.ts'),{defaultDesign}=await importTypescript('src/lib/defaults.ts');
let cases=0;
for(const width of[248,303,318,358,600,1000])for(const height of[100,180,240,350,520])for(const shape of['natural','round','oval','squoval','almond','coffin','square','stiletto'])for(const length of[.75,1,1.6,2.5]){
 const base={...defaultDesign,shape,length},size={width,height},baseWidth=Math.min(400,width),fit=v.fittedPaintView(size,baseWidth,base),layout=v.paintViewLayout(fit,size,baseWidth,base),geo=g.paintGeometry(layout.width,layout.height,base);
 const left=layout.padX+geo.center.x-geo.width*.51-layout.left,right=layout.padX+geo.center.x+geo.width*.51-layout.left;
 const top=layout.padY+geo.center.y-geo.height*.54-layout.top,bottom=layout.padY+geo.center.y+geo.height*.5-layout.top;
 assert.ok(left>=0&&right<=width&&top>=0&&bottom<=height,JSON.stringify({size,shape,length,fit,left,right,top,bottom}));
 const manual={zoom:1.25,center:{x:.08,y:.06},fit:false},screen={x:width*.4,y:height*.6},anchor=v.paintPointAtViewPoint(manual,screen,size,baseWidth,base),next=v.viewKeepingAnchor(anchor,screen,2,size,baseWidth,base),back=v.paintPointAtViewPoint(next,screen,size,baseWidth,base);
 assert.ok(Math.hypot(back.x-anchor.x,back.y-anchor.y)<1e-9);
 const bounded=v.paintViewLayout({zoom:99,fit:false,center:{x:1e9,y:-1e9}},size,baseWidth,base);assert.equal(bounded.view.zoom,3);assert.ok(bounded.left>=0&&bounded.left<=bounded.width&&bounded.top>=0&&bounded.top<=bounded.height);
 for(const dpr of[1,2,3]){const rect={left:-89.2,top:102.6,width:layout.width,height:layout.height},backing={width:Math.round(layout.width*dpr),height:Math.round(layout.height*dpr)},p={x:.23,y:-.31},client=g.paintToClient(p,rect,backing,base),roundtrip=g.clientToPaint(client,rect,backing,base);assert.ok(Math.hypot(roundtrip.x-p.x,roundtrip.y-p.y)<1e-9);}
 cases++;
}
assert.equal(v.boundedZoom(NaN),1);assert.equal(v.boundedZoom(-100),.1);assert.equal(v.boundedZoom(100),3);
console.log(`paint-viewport: ${cases} size/shape/length cases: full tip/root fit, focal zoom, bounded pan, DPR/CSS/scroll roundtrips; view never serialized into artwork`);
