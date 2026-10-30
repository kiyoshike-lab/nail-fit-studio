import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {importTypescript} from './lib/import-typescript.mjs';
const {VideoFrameGate}=await importTypescript('src/lib/videoFrameGate.ts');
const {withTrackingTimeout,initializeWithDelegateFallback}=await importTypescript('src/lib/trackingFallback.ts');
const diagnostics=await importTypescript('src/lib/trackingDiagnostics.ts');
const gate=new VideoFrameGate();
for(let index=1;index<=10;index++){
 gate.observe(index*60,index);assert.equal(gate.take(index*60,0),true,'frozen currentTime blocked a NEW compositor frame');
 assert.equal(gate.take(index*60+1,index/30),false,'media clock inferred the compositor frame twice');
 gate.observe(index*60+2,index);assert.equal(gate.take(index*60+2,index/30),false,'duplicate presentedFrames inferred twice');
}
assert.equal(gate.updates,10);
const legacy=new VideoFrameGate();
assert.equal(legacy.take(0,0,0),true);assert.equal(legacy.take(100,0,0),false);assert.equal(legacy.take(200,.1,0),true);
const quality=new VideoFrameGate();assert.equal(quality.take(0,0,1),true);assert.equal(quality.take(100,0,2),true);assert.equal(quality.take(200,0,2),false);
assert.equal(quality.take(300,.1,2),true,'stale playback counter suppressed a fresh media clock');
let lateResolve,disposed=0;
const late=new Promise(resolve=>lateResolve=resolve);
await assert.rejects(withTrackingTimeout(late,5,()=>disposed++),{name:'TimeoutError'});
lateResolve({});await new Promise(resolve=>setImmediate(resolve));assert.equal(disposed,1,'late initialization leaked');
const attempts=[];
assert.equal(await initializeWithDelegateFallback(delegate=>{attempts.push(delegate);return delegate==='GPU'?withTrackingTimeout(new Promise(()=>{}),5):Promise.resolve('cpu');}),'cpu');
assert.deepEqual(attempts,['GPU','CPU']);
assert.equal(diagnostics.diagnosticsEnabled(),false);
diagnostics.diagnosticError('initialization',new Error('https://private.test/?token=SECRET deviceId=PRIVATE'),'engine-initialization-failed');
assert.ok(!JSON.stringify(diagnostics.readTrackingDiagnostics()).match(/SECRET|PRIVATE|private\.test/),'diagnostics exported arbitrary SDK error messages');
const oldPerf=globalThis.performance;
let now=0;Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'Mozilla/5.0 (iPhone) AppleWebKit Safari/604.1',maxTouchPoints:5}});
const frames=new Map(),vf=new Map();let id=0;
globalThis.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
const context=new Proxy({}, {get:(_target,key)=>key==='getImageData'?(_x,_y,w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}):key.toString().startsWith('create')?()=>({addColorStop(){}}):()=>{}});
class Canvas{width=1;height=1;getContext(){return context;}}
globalThis.HTMLCanvasElement=Canvas;globalThis.document={createElement:()=>new Canvas(),visibilityState:'visible'};
const fixture=JSON.parse(await readFile('scripts/fixtures/dorsal-world-disagreement.json','utf8'));
let result={landmarks:[fixture.landmarks],worldLandmarks:[fixture.worldLandmarks],handedness:[[fixture.handedness]]};
let gpuFail=false,cpuFail=false,detectFailure=false,hangFactories=false;const lateFactories=[];const instances=[],inputs=[],inputSizes=[];
globalThis.__mobileTrackingMock={FilesetResolver:{forVisionTasks:async()=>({})},HandLandmarker:{createFromOptions:async(_v,options)=>{
 if(options.baseOptions.delegate==='GPU'&&gpuFail||options.baseOptions.delegate==='CPU'&&cpuFail)throw new TypeError('test init failure');
 const instance={options,closed:0,detectForVideo(input){inputs.push(input);inputSizes.push(input.width);if(detectFailure)throw new Error('test inference failure');return result;},close(){this.closed++;}};instances.push(instance);if(hangFactories)return new Promise(resolve=>lateFactories.push(()=>resolve(instance)));return instance;
}}};
const stub=`export const {FilesetResolver,HandLandmarker}=globalThis.__mobileTrackingMock;`;
process.env.NODE_ENV='production';
const tracking=await importTypescript('src/lib/handTracking.ts',{'@mediapipe/tasks-vision':`data:text/javascript;base64,${Buffer.from(stub).toString('base64')}`});
const video={videoWidth:1280,videoHeight:720,readyState:4,currentTime:0,paused:false,ended:false,
 requestVideoFrameCallback:cb=>{vf.set(++id,cb);return id;},cancelVideoFrameCallback:id=>vf.delete(id)};
const stream={active:true};let failed=0;const updates=[],health=[];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function tick(time,fresh=true){now=time;if(fresh){const callbacks=[...vf.values()];vf.clear();callbacks.forEach(cb=>cb(now,{presentedFrames:time}));}const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(now));}
gpuFail=true;
let tracker=await tracking.startHandTracking(video,(n,d)=>updates.push({n,d}),false,()=>failed++,undefined,undefined,h=>health.push(h));
assert.equal(instances.at(-1).options.baseOptions.delegate,'CPU');
for(let t=60;t<=600;t+=60)tick(t);
assert.equal(updates.at(-1).n.filter(n=>n.visibility>0).length,5,'frozen clock lost dorsal nails');
assert.equal(diagnostics.readTrackingDiagnostics().inference.landmarks,21);assert.equal(diagnostics.readTrackingDiagnostics().nails.eligible,5);
const consumed=inputs.length;for(let t=610;t<=700;t+=10)tick(t,false);assert.equal(inputs.length,consumed,'same frame inferred repeatedly');
video.paused=true;tick(760);assert.equal(inputs.length,consumed,'paused video inferred');video.paused=false;
video.videoWidth=0;tick(820);assert.equal(inputs.length,consumed,'zero dimension video inferred');video.videoWidth=1280;
for(let t=900;t<=4000;t+=100)tick(t,false);
assert.ok(health.includes('waiting-frames'),'stalled frames never offered recovery');
result={landmarks:[],worldLandmarks:[],handedness:[]};
for(let t=4100;t<=13000;t+=100)tick(t);
assert.ok(inputs.some(input=>input===video),'direct VIDEO fallback was only a label');
assert.ok(inputSizes.includes(1280),'native Canvas never tried');
// Canvas dimensions mutate; retain sizes on each inference in later assertions via diagnostic fields.
assert.equal(diagnostics.readTrackingDiagnostics().inference.input,'canvas-640');
assert.equal(diagnostics.readTrackingDiagnostics().inference.width,640);
assert.equal(diagnostics.readTrackingDiagnostics().stage,'D-no-hands');assert.ok(health.includes('no-hand'));
assert.equal(frames.size,1,'10s without hand stopped tracker');assert.equal(stream.active,true);
tracker.stop();tracking.resetHandTrackingEngine();await flush();gpuFail=false;
result={landmarks:[fixture.landmarks],worldLandmarks:[fixture.worldLandmarks],handedness:[[fixture.handedness]]};
tracker=await tracking.startHandTracking(video,()=>{},false,()=>failed++);
detectFailure=true;for(let t=13100;t<13800;t+=100)tick(t);await flush();
assert.equal(instances.at(-1).options.baseOptions.delegate,'CPU','GPU runtime failure did not recover');
detectFailure=false;tick(13900);assert.equal(diagnostics.readTrackingDiagnostics().inference.landmarks,21);assert.equal(stream.active,true);assert.equal(failed,0);
// Malformed geometry and open palm are different from zero-hand inference.
result={landmarks:[[{x:.5,y:.5,z:0}]],worldLandmarks:[],handedness:[]};tick(14000);assert.equal(diagnostics.readTrackingDiagnostics().stage,'E-geometry');
result={landmarks:[fixture.landmarks],worldLandmarks:[],handedness:[[{...fixture.handedness,categoryName:fixture.handedness.categoryName==='Left'?'Right':'Left'}]]};
for(let t=14100;t<=14700;t+=100)tick(t);assert.equal(diagnostics.readTrackingDiagnostics().stage,'F-visibility');
tracking.resetHandTrackingEngine();await flush();gpuFail=cpuFail=true;
await assert.rejects(tracking.startHandTracking(video,()=>{},false));
gpuFail=cpuFail=false;
tracker=await tracking.startHandTracking(video,()=>{},false);
assert.equal(frames.size,1,'retry retained a rejected Promise or duplicated loops');tracker.stop();tracking.resetHandTrackingEngine();await flush();
assert.ok(instances.every(instance=>instance.closed===1),'engine leak/double close');assert.equal(vf.size,0);assert.equal(frames.size,0);
// A mobile GPU that returns zero hands gets only ONE CPU recovery, never a stream restart.
result={landmarks:[],worldLandmarks:[],handedness:[]};now=15000;
tracker=await tracking.startHandTracking(video,()=>{},false);
const cpuBefore=instances.filter(i=>i.options.baseOptions.delegate==='CPU').length;
for(let t=15100;t<=27000;t+=100)tick(t);await flush();
assert.equal(instances.filter(i=>i.options.baseOptions.delegate==='CPU').length,cpuBefore+1);
for(let t=27100;t<=40000;t+=100)tick(t);await flush();
assert.equal(instances.filter(i=>i.options.baseOptions.delegate==='CPU').length,cpuBefore+1,'no-hand recovery repeated forever');
assert.equal(frames.size,1);assert.equal(stream.active,true);
tracking.resetHandTrackingEngine();await flush();
assert.ok(instances.every(instance=>instance.closed===1));
// Real factory timeout/retry guard: two pending SDK initializers, then reject
// further retries without creating more engines; late results must close once.
const realSetTimeout=globalThis.setTimeout;
globalThis.setTimeout=(callback,ms,...args)=>realSetTimeout(callback,ms===15000?5:ms,...args);
hangFactories=true;
await assert.rejects(tracking.startHandTracking(video,()=>{},false),{name:'TimeoutError'});
assert.equal(lateFactories.length,2);
await assert.rejects(tracking.startHandTracking(video,()=>{},false));assert.equal(lateFactories.length,2,'retry spawned unlimited pending factories');
lateFactories.forEach(resolve=>resolve());await flush();hangFactories=false;globalThis.setTimeout=realSetTimeout;
assert.ok(instances.every(instance=>instance.closed===1),'late SDK factory leaked');
tracker=await tracking.startHandTracking(video,()=>{},false);tracker.stop();tracking.resetHandTrackingEngine();await flush();
Object.defineProperty(globalThis,'performance',{configurable:true,value:oldPerf});
console.log('mobile-tracking: compositor/clock/quality gating, duplicate suppression, timeout/late disposal, GPU→CPU init/runtime recovery, retry, real VIDEO/Canvas inputs, A–G separation and privacy passed (mocked SDK, not physical iPhone)');
