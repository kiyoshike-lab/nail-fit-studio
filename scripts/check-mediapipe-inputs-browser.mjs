// Real SDK/delegates/input comparison. Camera is a still-driven captureStream,
// not iPhone Safari, Android Chrome or a physical webcam performance benchmark.
import assert from 'node:assert/strict';
import path from 'node:path';import{pathToFileURL}from'node:url';import{writeFile}from'node:fs/promises';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const base=opt('--base-url')??'http://localhost:4210';if(!opt('--image')||!opt('--playwright-module'))throw Error('image and Playwright module required');if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA only');
const{chromium}=await import(pathToFileURL(path.resolve(opt('--playwright-module'))).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.route(/googlesyndication|googletagmanager|google-analytics/,r=>r.abort());
 await page.route('**/__qa__/sdk.mjs',r=>r.fulfill({path:path.resolve('node_modules/@mediapipe/tasks-vision/vision_bundle.mjs'),contentType:'text/javascript'}));
 await page.route('**/__qa__/hand.jpg',r=>r.fulfill({path:path.resolve(opt('--image')),contentType:'image/jpeg'}));
 await page.goto(base,{waitUntil:'networkidle'});
 const rows=await page.evaluate(async()=>{
  const{FilesetResolver,HandLandmarker}=await import('/__qa__/sdk.mjs');const vision=await FilesetResolver.forVisionTasks('/mediapipe');
  const image=new Image();image.src='/__qa__/hand.jpg';await image.decode();const source=document.createElement('canvas');source.width=1280;source.height=720;const ctx=source.getContext('2d');
  const paint=()=>{ctx.fillStyle='#777';ctx.fillRect(0,0,1280,720);const h=650,w=h*image.width/image.height;ctx.drawImage(image,640-w/2,360-h/2,w,h);};paint();const timer=setInterval(paint,33);
  const video=document.createElement('video');video.muted=true;video.playsInline=true;const stream=source.captureStream(30);video.srcObject=stream;await video.play();
  const rows=[];let timestamp=0;
  try{for(const delegate of['GPU','CPU']){
   const started=performance.now();const model=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'/mediapipe/hand_landmarker.task',delegate},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.35,minHandPresenceConfidence:.35,minTrackingConfidence:.35});const initializationMs=performance.now()-started;
   try{for(const mode of['video','canvas-native','canvas-960','canvas-640']){
    const canvas=document.createElement('canvas');const width=mode==='canvas-640'?640:mode==='canvas-960'?960:1280;canvas.width=width;canvas.height=width*720/1280;
    const samples=[];for(let index=0;index<3;index++){canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);const began=performance.now();const result=model.detectForVideo(mode==='video'?video:canvas,timestamp+=100);samples.push({hands:result.landmarks.length,landmarks:result.landmarks[0]?.length??0,ms:performance.now()-began});await new Promise(r=>setTimeout(r,60));}
    rows.push({delegate,mode,width,height:canvas.height,initializationMs,samples});
   }}finally{model.close();}
  }}finally{clearInterval(timer);stream.getTracks().forEach(t=>t.stop());video.srcObject=null;}
  return rows;
 });
 for(const row of rows)assert.ok(row.samples.some(s=>s.landmarks===21),`${row.delegate}/${row.mode}: no hand`);
 if(opt('--output'))await writeFile(opt('--output'),JSON.stringify({kind:'headless Chrome with software WebGL; real SDK and delegates; still-driven video, NOT physical phone performance',rows},null,2));
 console.log(JSON.stringify(rows.map(({delegate,mode,samples})=>({delegate,mode,landmarks:samples.map(s=>s.landmarks),meanMs:samples.reduce((n,s)=>n+s.ms,0)/samples.length})),null,2));
}finally{await browser.close();}
