// Local PHOTO benchmark. Source images/labels are never written into the repo or sent off localhost.
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { typescriptModuleUrl } from "./lib/import-typescript.mjs";

const args = process.argv.slice(2), opt = key => args[args.indexOf(key) + 1];
const base = new URL(opt("--base-url")), root = opt("--data-root"), out = opt("--output-dir");
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname));
const development = new Set(JSON.parse(await readFile(opt("--development"), "utf8")).rows.map(x => x.file));
const inputs = (await readdir(path.join(root, "labels"))).filter(x => /\.jpe?g$/i.test(x)).sort();
const source = names => Object.fromEntries(names.map(name => [name, typescriptModuleUrl("src/lib/" + name + ".ts")]));
const refs = source(["photoPreparation", "nailGeometry", "handPose", "nailVisibility", "nailFrameRefiner", "photoContourFit", "nailRenderer", "defaults"]);
for (const id of Object.keys(refs)) refs[id] = await refs[id];
const { chromium } = await import(pathToFileURL(path.resolve(opt("--playwright-module"))).href);
const b = await chromium.launch({ channel: "chrome", headless: true });
await mkdir(out, { recursive: true });
const rows = [], external = [];
try {
  const p = await b.newPage();
  await p.route("**/*", r => {
    const url = new URL(r.request().url());
    if (url.protocol.startsWith("http") && url.origin !== base.origin) {
      external.push(url.hostname); return r.abort();
    }
    return r.continue();
  });
  await p.route("**/__photo_qa__/vision.mjs", r => r.fulfill({ contentType: "application/javascript", path: "node_modules/@mediapipe/tasks-vision/vision_bundle.mjs" }));
  await p.goto(base.origin + "/try-on");
  await p.evaluate(async refs => {
    globalThis.qa = Object.assign({}, ...await Promise.all(Object.values(refs).map(url => import(url))));
    const { FilesetResolver, HandLandmarker } = await import("/__photo_qa__/vision.mjs");
    globalThis.model = await HandLandmarker.createFromOptions(await FilesetResolver.forVisionTasks("/mediapipe"), {
      baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task", delegate: "CPU" },
      runningMode: "IMAGE", numHands: 1, minHandDetectionConfidence: .35, minHandPresenceConfidence: .35, minTrackingConfidence: .35,
    });
  }, refs);
  let group = 0;
  for (const file of inputs) {
    const [photo, mask] = await Promise.all(["images", "labels"].map(folder => readFile(path.join(root, folder, file))));
    const split = development.has(file) ? "previous-28" : "additional-same-source";
    const row = await p.evaluate(async ({ photo, mask, split, pictures }) => {
      const load = async src => { const image = new Image(); image.src = src; await image.decode(); return image; };
      const bytes = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
      const url = await qa.preparePhoto(new File([bytes(photo)], "test.jpg", { type: "image/jpeg" }));
      try {
        const image = await load(url), label = await load("data:image/jpeg;base64," + mask);
        const sw = image.naturalWidth, sh = image.naturalHeight;
        if (Math.abs(sw/sh - label.naturalWidth/label.naturalHeight) > .01) return { skipped: "label-aspect" };
        const scale = Math.min(1, 640 / Math.max(sw, sh)), width = Math.round(sw*scale), height = Math.round(sh*scale);
        const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false; ctx.drawImage(label, 0, 0, width, height); ctx.imageSmoothingEnabled = true;
        const truth = ctx.getImageData(0, 0, width, height).data, seen = new Uint8Array(width*height), components = [];
        for (let i=0;i<seen.length;i++) {
          if (seen[i] || truth[i*4] < 128) continue;
          const q=[i]; seen[i]=1; let sx=0,sy=0,minX=width,maxX=0,minY=height,maxY=0;
          for (let j=0;j<q.length;j++) {
            const k=q[j],x=k%width,y=Math.floor(k/width); sx+=x; sy+=y;
            minX=Math.min(x,minX); maxX=Math.max(x,maxX); minY=Math.min(y,minY); maxY=Math.max(y,maxY);
            for (const n of [x ? k-1 : -1,x<width-1?k+1:-1,k-width,k+width]) {
              if(n>=0&&n<seen.length&&!seen[n]&&truth[n*4]>=128) {q.push(n);seen[n]=1;}
            }
          }
          if (q.length >= 13) components.push({ q, x: sx/q.length, y: sy/q.length, w: maxX-minX+1, h: maxY-minY+1 });
        }
        const t0=performance.now(), result=model.detect(image), inferenceMs=performance.now()-t0;
        const landmarks=result.landmarks[0];
        if (!landmarks) return { undetected: true, labelled: components.length, inferenceMs };
        const coarse=qa.buildNailsFromLandmarks(landmarks,false,sw/sh);
        const pose=qa.estimateHandPose(landmarks,result.worldLandmarks[0],result.handedness[0]?.[0],sw/sh);
        const refiner=new qa.NailFrameRefiner();
        const t1=performance.now();
        const fit=refiner.refine(image,sw,sh,coarse,false,t1,pose.view!=="back"||pose.fingers.some(f=>f.facing<.3));
        const base=qa.withNailVisibility(fit.nails,qa.assessNailVisibility(pose,landmarks,fit.nails,fit.diagnostics,sw*scale,sh*scale,false));
        refiner.dispose(); const fitMs=performance.now()-t1;
        const gates=[],t2=performance.now(),clip=qa.withPhotoContourFit(base,fit.diagnostics,sw*scale,sh*scale,(i,r)=>gates[i]=r);
        const clipMs=performance.now()-t2;
        const center = n => {
          const a=(n.rotation-90)*Math.PI/180;
          return {x: n.x*width/100+Math.cos(a)*n.height*height/200,y:n.y*height/100+Math.sin(a)*n.height*height/200};
        };
        // Fix the association from landmarks alone before comparing any post-processing.
        const choices=coarse.flatMap((n,finger)=>{const a=center(n);return components.map((c,j)=>({finger,j,d:Math.hypot(a.x-c.x,a.y-c.y)}));}).sort((a,b)=>a.d-b.d);
        const pairs=[], used=new Set();
        for(const m of choices) {
          const c=components[m.j];
          if(!used.has(m.j)&&!pairs.some(x=>x.finger===m.finger)&&m.d<2.5*Math.max(c.w,c.h)) {pairs.push(m);used.add(m.j);}
        }
        const design={ ...qa.defaultDesign, shape:"natural", length:1 };
        const feather=clip.map((n,i)=>{
          if (n===base[i] || !n.clipContour) return n;
          const c=center(n);
          // Research only: recover the antialiased edge by allowing one pixel
          // around an already eligible outline. Does not relax its evidence gate.
          return {...n,clipContour:n.clipContour.map(p=>{
            const x=p.x*width/100-c.x,y=p.y*height/100-c.y,d=Math.max(1,Math.hypot(x,y));
            return { x:p.x+x/d*100/width,y:p.y+y/d*100/height };
          })};
        });
        const nails=[];
        for(const {finger,j} of pairs) {
          const c=components[j], gold=new Set(c.q), variants={};
          for(const [name,n] of Object.entries({standard:base[finger], clipped:clip[finger], margin:feather[finger],
            jointsOnly:base[finger].visibilityState==="visible"?{...base[finger],...coarse[finger]}:base[finger]})) {
            await qa.drawNails(ctx,width,height,[n],design,{clear:true});
            const image=ctx.getImageData(0,0,width,height).data;
            let inside=0,outside=0;
            for(let i=0;i<width*height;i++)if(image[i*4+3]>=128){ if(gold.has(i))inside++;else outside++; }
            const a=center(n);
            variants[name]={iou:inside/(c.q.length+outside),outside,inside,label:c.q.length,error:Math.hypot(a.x-c.x,a.y-c.y)};
          }
          const angle=(base[finger].rotation-90)*Math.PI/180;
          const longitudinal=c.q.map(i=>(i%width-c.x)*Math.cos(angle)+(Math.floor(i/width)-c.y)*Math.sin(angle));
          const lateral=c.q.map(i=>-(i%width-c.x)*Math.sin(angle)+(Math.floor(i/width)-c.y)*Math.cos(angle));
          const ratio=(Math.max(...longitudinal)-Math.min(...longitudinal)+1)/(Math.max(...lateral)-Math.min(...lateral)+1);
          nails.push({finger,state:base[finger].visibilityState,ratio,face:pose.fingers[finger]?.facing,bend:pose.fingers[finger]?.bendDegrees,variants});
        }
        let picture;
        if (pictures) {
          canvas.width = width*3; canvas.height = height;
          for (const [index,nails] of [base,clip,feather].entries()) {
            ctx.drawImage(image,index*width,0,width,height);
            await qa.drawNails(ctx,width,height,nails,design,{clear:false,viewport:{x:index*width,y:0,width,height}});
          }
          picture=canvas.toDataURL("image/jpeg",.88).split(",")[1];
        }
        return {split,width,height,view:pose.view,labelled:components.length,states:base.map(n=>n.visibilityState),gates,
          fits:fit.diagnostics.map(f=>({reason:f.reason,confidence:f.confidence,support:f.supportThresholds,rejected:f.rejected})),
          inferenceMs,fitMs,clipMs,nails,picture};
      } finally { URL.revokeObjectURL(url); }
    }, { photo: photo.toString("base64"), mask: mask.toString("base64"), split,
      pictures: group<2 || file.startsWith("964c") || file.startsWith("bf93") });
    if (row.picture) {
      await writeFile(path.join(out, "qa-" + (group++) + ".jpg"), Buffer.from(row.picture,"base64"));
      delete row.picture; row.pictureName="qa-"+(group-1)+".jpg";
    }
    rows.push({file,split,...row});
  }
  await p.evaluate(() => model.close());
  await writeFile(path.join(out,"result.json"),JSON.stringify({rows,external:[...new Set(external)]},null,2));
  console.log(JSON.stringify({files:rows.length,detected:rows.filter(x=>x.states).length,matched:rows.flatMap(x=>x.nails??[]).length}));
} finally { await b.close(); }
