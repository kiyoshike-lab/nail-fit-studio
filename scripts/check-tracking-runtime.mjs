import assert from "node:assert/strict";
import { importTypescript } from "./lib/import-typescript.mjs";

const previousEnv=process.env.NODE_ENV;
process.env.NODE_ENV="production";
const frames=new Map();
let frameId=0;
const logs=[];
let saveDepth=0;
let pixelReads=0;
let capturedVideoInput;
const gradients={addColorStop(){}};
const values={globalAlpha:1};
const stack=[];
const context=new Proxy(values,{
  get(target,key) {
    if(key in target) return target[key];
    if(key==="save") return ()=>{stack.push({...target});saveDepth++;};
    if(key==="restore") return ()=>{Object.assign(target,stack.pop());saveDepth--;};
    if(String(key).startsWith("create")) return ()=>gradients;
    if(key==="getImageData") return (_x,_y,width,height)=>{
      pixelReads++;
      return {data:new Uint8ClampedArray(width*height*4),width,height};
    };
    return (...args)=>logs.push({method:key,args,alpha:target.globalAlpha});
  },
});
class TestCanvas {width=640;height=480;getContext(){return context;}}
globalThis.HTMLCanvasElement=TestCanvas;
globalThis.document={createElement:()=>new TestCanvas()};
globalThis.requestAnimationFrame=(callback)=>{frames.set(++frameId,callback);return frameId;};
globalThis.cancelAnimationFrame=(id)=>frames.delete(id);
globalThis.window={setTimeout,clearTimeout};
const images=[];
globalThis.Image=class {width=128;height=128;set src(value){this.url=value;images.push(this);}};

const hand=[
  [.5,.88],[.4,.72],[.32,.63],[.24,.55],[.17,.48],
  [.4,.62],[.39,.45],[.39,.33],[.39,.24],
  [.49,.59],[.49,.4],[.49,.28],[.49,.18],
  [.58,.62],[.59,.45],[.6,.33],[.61,.24],
  [.67,.67],[.69,.52],[.71,.43],[.73,.36],
].map(([x,y])=>({x,y,z:0}));
const instances=[];
let failure=false;
let handVisible=true;
globalThis.__nailTrackingMock={
  FilesetResolver:{forVisionTasks:async()=>({})},
  HandLandmarker:{createFromOptions:async(_vision,options)=>{
    const instance={
      options,videoCalls:0,imageCalls:0,closed:0,timestamps:[],
      detectForVideo(_input,timestamp){
        capturedVideoInput=_input;
        assert.equal(options.runningMode,"VIDEO");
        if(failure) throw Error("mock frame failure");
        this.videoCalls++;
        this.timestamps.push(timestamp);
        return {landmarks:handVisible?[hand]:[],handedness:[[{categoryName:"Left",score:.99}]]};
      },
      detect(){assert.equal(options.runningMode,"IMAGE");this.imageCalls++;return {landmarks:[hand]};},
      close(){this.closed++;},
    };
    instances.push(instance);
    return instance;
  }},
};
const stub=`export const { FilesetResolver, HandLandmarker }=globalThis.__nailTrackingMock;`;
const tracking=await importTypescript("src/lib/handTracking.ts",{
  "@mediapipe/tasks-vision":`data:text/javascript;base64,${Buffer.from(stub).toString("base64")}`,
});
const video={videoWidth:1280,videoHeight:720,readyState:4,currentTime:0};
const updates=[];
let failed=0;
const stream={active:true};
let naturalLength="auto";
const tracker=await tracking.startHandTracking(video,(nails,detected)=>updates.push({nails,detected}),false,()=>failed++,undefined,()=>naturalLength);
function tick(timestamp){
  video.currentTime+=.05;
  const callbacks=[...frames.values()];
  frames.clear();
  callbacks.forEach((callback)=>callback(timestamp));
}
tick(50);
assert.equal(updates.at(-1).nails.length,5);
assert.equal(updates.at(-1).detected,true);
assert.ok(capturedVideoInput instanceof TestCanvas,"inference did not inspect a frozen camera frame");
assert.ok(logs.some(entry=>entry.method==="drawImage"&&entry.args[0]===capturedVideoInput),"pixel refinement read a different frame from MediaPipe");
assert.ok(pixelReads>0,"realtime tracking skipped image-boundary refinement");
handVisible=false;
for(let timestamp=100;timestamp<=10000;timestamp+=50) tick(timestamp);
assert.equal(frames.size,1,"10 seconds without a hand stopped tracking");
handVisible=true;
// Inference may be skipped by the adaptive budget; wait a bounded number of
// scheduled frames instead of assuming the very next RAF performs detection.
for(let timestamp=10050;timestamp<=10450;timestamp+=100) tick(timestamp);
assert.equal(updates.at(-1).detected,true,"re-detection failed");

const photoNails=await tracking.detectHandNails({naturalWidth:1280,naturalHeight:720});
assert.equal(photoNails.length,5);
const longPhotoNails=await tracking.detectHandNails({naturalWidth:1280,naturalHeight:720},"long");
longPhotoNails.forEach((nail,index)=>{
  assert.equal(nail.x,photoNails[index].x);
  assert.equal(nail.y,photoNails[index].y);
  assert.ok(Math.abs(nail.height/photoNails[index].height-1.45)<.001);
});
tick(10550);
const beforeModeChange=updates.at(-1).nails;
naturalLength="long";
tick(10800);
updates.at(-1).nails.forEach((nail,index)=>{
  assert.ok(Math.abs(nail.height/beforeModeChange[index].height-1.45)<.001);
  assert.ok(Math.abs(nail.x-beforeModeChange[index].x)<.001);
  assert.ok(Math.abs(nail.y-beforeModeChange[index].y)<.001);
});
assert.equal(stream.active,true,"changing natural nail length stopped the camera");
assert.equal(frames.size,1,"changing natural nail length duplicated tracking");
assert.equal(instances.filter((instance)=>instance.options.runningMode==="VIDEO").length,1);
assert.equal(instances.filter((instance)=>instance.options.runningMode==="IMAGE").length,1);
const videoInstance=instances[0];
assert.ok(videoInstance.timestamps.every((value,index)=>index===0||value>videoInstance.timestamps[index-1]),"VIDEO timestamps went backward");

video.videoWidth=640;
video.videoHeight=480;
const nextTracker=await tracking.startHandTracking(video,()=>{},false,()=>failed++);
assert.equal(frames.size,1,"switching cameras left multiple inference loops");
tracker.stop();
failure=true;
for(let timestamp=11000;timestamp<12500;timestamp+=150) tick(timestamp);
assert.equal(failed,1);
assert.equal(stream.active,true,"tracker failure stopped the independent stream");
assert.equal(frames.size,0);
nextTracker.stop();
await Promise.resolve();
assert.ok(instances.every((instance)=>instance.closed===1),"reset leaked or double-closed a model");

const {drawNails}=await importTypescript("src/lib/nailRenderer.ts");
const {defaultDesign}=await importTypescript("src/lib/defaults.ts");
const pending=drawNails(context,640,480,photoNails,{...defaultDesign,textureUrl:"pending.png"},{isCurrent:()=>false,clear:true});
assert.equal(saveDepth,0,"Canvas save/clip happened while texture I/O was pending");
await drawNails(context,640,480,photoNails,defaultDesign,{clear:true});
const afterNew=logs.length;
images[0].onload();
assert.equal(await pending,false);
assert.equal(logs.length,afterNew,"stale texture frame overwrote the current frame");
assert.equal(saveDepth,0,"Canvas transforms leaked");

logs.length=0;
await drawNails(context,640,480,[photoNails[2]],defaultDesign,{opacity:.3});
const firstTranslations=logs.filter((entry)=>entry.method==="translate");
logs.length=0;
await drawNails(context,640,480,[photoNails[2]],{...defaultDesign,length:2.4},{opacity:.3});
const longTranslations=logs.filter((entry)=>entry.method==="translate");
assert.deepEqual(firstTranslations[1].args,longTranslations[1].args,"length changes shifted the cuticle anchor");
assert.ok(logs.filter((entry)=>entry.method==="fillRect").every((entry)=>entry.alpha<=.3),"material rendering undid the tracking fade");
assert.equal(saveDepth,0);

const broken=drawNails(context,640,480,photoNails,{...defaultDesign,textureUrl:"missing.png"});
images.at(-1).onerror(Error("404"));
assert.equal(await broken,true,"missing texture broke try-on");
assert.equal(saveDepth,0);
process.env.NODE_ENV=previousEnv;
console.log("tracking-runtime: real tracking loop with mocked MediaPipe covers VIDEO/IMAGE isolation, 10s loss/recovery, camera switch, failure cleanup, stale draw rejection, root lock and fade passed");
