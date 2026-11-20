// Chrome touch/desktop emulation; no physical handset or image delivery.
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
const argv=process.argv.slice(2),opt=key=>argv[argv.indexOf(key)+1];
const base=new URL(opt("--base-url")).origin, out=opt("--output-dir");
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const {chromium}=await import(pathToFileURL(path.resolve(opt("--playwright-module"))).href);
const browser=await chromium.launch({channel:"chrome",headless:true,args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const checks=[], external=[], pageErrors=[];
await mkdir(out,{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2});
 p.setDefaultTimeout(45000);
 p.on("pageerror",e=>pageErrors.push(e.message));
 await p.route("**/*",route=>{
   const r=route.request(), u=new URL(r.url());
   if(u.protocol.startsWith("http")&&u.origin!==base){external.push({host:u.hostname,method:r.method()});return route.abort();}
   return route.continue();
 });
 await p.addInitScript(()=>{
   const revoke=URL.revokeObjectURL; globalThis.removed=[];
   URL.revokeObjectURL=value=>{globalThis.removed.push(value);return revoke(value)};
 });
 await p.goto(base+"/try-on?photoFit=1",{waitUntil:"networkidle"});
 const upload=p.locator(".intro-actions input[type=file]");
 const poseKey="nail-fit-studio-next.nails.v1";
 const poses=()=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),poseKey);
 const stage=p.locator(".preview-stage img");
 const metadata=await sharp(opt("--image")).metadata();
 const oriented=await sharp(opt("--image")).rotate(270).withMetadata({orientation:6}).jpeg({quality:95}).toBuffer();
 const thumbnail=()=>stage.evaluate(image=>{
   const canvas=document.createElement("canvas");canvas.width=canvas.height=12;
   const context=canvas.getContext("2d");context.drawImage(image,0,0,12,12);
   return Array.from(context.getImageData(0,0,12,12).data);
 });
 await upload.setInputFiles({name:"qa-orientation-6.jpg",mimeType:"image/jpeg", buffer:oriented});
 await p.waitForFunction(()=>document.querySelector(".preview-stage img")?.naturalWidth>0
   && /自動配置/.test(document.querySelector(".preview-heading")?.textContent??"")&&!document.querySelector(".loading-badge"));
 assert.deepEqual(await stage.evaluate(i=>[i.naturalWidth,i.naturalHeight]),[metadata.width,metadata.height]);
 const exifPixels=await thumbnail();
 // Use the unchanged original file for the historically supported contour.
 const previous=await stage.getAttribute("src");
 await upload.setInputFiles(opt("--image"));
 await p.waitForFunction(old=>document.querySelector(".preview-stage img")?.getAttribute("src")!==old,previous);
 await p.waitForFunction(()=>!document.querySelector(".loading-badge")&&/自動配置/.test(document.querySelector(".preview-heading")?.textContent??""));
 await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).filter(n=>n.visibility>0).length===5,poseKey);
 const regularPixels=await thumbnail();
 const mae=exifPixels.reduce((sum,n,i)=>sum+Math.abs(n-regularPixels[i]),0)/exifPixels.length;
 assert.ok(mae<3,"EXIF output did not visually align with the original");
 checks.push({case:"EXIF geometry and oriented image pixels match; standard fixture has five visible nails",intrinsic:[metadata.width,metadata.height],mae});
 const original=await poses(), url=await stage.getAttribute("src");
 const edit=p.locator("#finger-position-controls");
 await p.getByRole("button",{name:"爪の位置・大きさを調整",exact:true}).click();
 assert.equal(await edit.getAttribute("open"),"");
 assert.equal(await p.evaluate(()=>document.activeElement?.textContent),"詳細調整");
 const group=edit.getByRole("group",{name:"指を選択"});
 const range=edit.getByLabel("横位置",{exact:true});
 for(const [index,name] of [[0,"親指"],[4,"小指"]]){
   await group.getByRole("button",{name,exact:true}).click();
   await range.focus(); await range.press("ArrowRight");
   await p.waitForFunction(({index,key})=>JSON.parse(localStorage.getItem(key))[index].visibilityState==="manual",{index,key:poseKey});
 }
 const manual=await poses();
 await p.getByText("はみ出しが気になるとき",{exact:true}).click();
 const toggle=p.getByLabel("自爪の輪郭内に収める",{exact:true});
 await p.evaluate(()=>{
   globalThis.busyTransitions=0;
   new MutationObserver(()=>{if(document.querySelector(".loading-badge"))globalThis.busyTransitions++})
     .observe(document.body,{childList:true,subtree:true});
 });
 for(const enabled of [true,false,true]){
   await toggle.setChecked(enabled);
   await p.waitForFunction(({key,enabled})=>JSON.parse(localStorage.getItem(key)).some(n=>n.visibilityState==="visible"&&n.clipContour)===enabled,{key:poseKey,enabled});
   const current=await poses();
   assert.deepEqual(current[0],manual[0]);assert.deepEqual(current[4],manual[4]);
 }
 assert.equal(await p.evaluate(()=>globalThis.busyTransitions),0);
 await edit.getByRole("button",{name:"この指だけ元の位置に戻す",exact:true}).click();
 await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key))[4].visibilityState!=="manual",poseKey);
 const restored=await poses();
 assert.deepEqual(restored[0],manual[0]);
 assert.deepEqual(restored[4],original[4]);
 checks.push({case:"three clip toggles preserve manually edited fingers; reset only selected finger"});
 const picker=p.locator(".photo-design-picker");
 await picker.locator("summary").click();
 const text=picker.getByLabel("テキストで指定",{exact:true}),submit=picker.getByRole("button",{name:"テキスト指定を反映"});
 for(const [prompt,status] of [["親指だけハートを付けたい",/親指だけ：ハート/],["薬指だけマグネットネイル",/薬指だけ：マグネット風/]]){
   await text.fill(prompt);await submit.click();
   await picker.getByRole("status").filter({hasText:status}).waitFor();
 }
 await p.getByRole("button",{name:"5本のデザインを編集",exact:true}).click();
 const editor=p.locator(".workshop-editor");
 await editor.getByRole("button",{name:"デザインを保存",exact:true}).click();
 const doc=await p.evaluate(()=>JSON.parse(localStorage.getItem("nail-fit-studio-next.workshop-library.v1")??"null")?.entries[0].document);
 assert.ok(doc);
 assert.deepEqual(doc.fingers.map(f=>f.parts.map(part=>part.kind)),[["heart"],[],[],[],[]]);
 assert.deepEqual(doc.fingers.map(f=>f.surface?.kind??null),[null,null,null,"magnet",null]);
 assert.equal(await stage.getAttribute("src"),url);
 for(const width of [320,375,390,430,1280]){
   await p.setViewportSize({width,height:900});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await p.screenshot({path:path.join(out,"photo-desktop.png")});
 await p.getByRole("button",{name:"写真だけ外す",exact:true}).click();
 await p.getByText("写真を外しました。デザインはそのままです。",{exact:true}).waitFor();
 assert.ok(await p.evaluate(url=>globalThis.removed.includes(url),url));
 assert.equal(await stage.getAttribute("src"),null);
 assert.ok(await p.evaluate(()=>!Object.values(localStorage).some(v=>v.includes("blob:")||v.includes("data:image/"))));
 assert.deepEqual(pageErrors,[]);
 assert.ok(external.every(r=>r.host==="odml.pa.googleapis.com"),JSON.stringify(external));
 checks.push({case:"text design preserved per finger, save, widths, removal revokes photo but keeps design"});
}finally{
 await writeFile(path.join(out,"result.json"),JSON.stringify({checks,external,pageErrors},null,2));
 await browser.close();
}
console.log(JSON.stringify({checks,external:external.length}));
