// Reproducible gallery renderer. Run locally with the allowlisted generated
// bare-hand WebPs checked in; no user files or network input is accepted.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {importTypescript,typescriptModuleUrl} from './lib/import-typescript.mjs';
const args=process.argv.slice(2);
const pm=args[args.indexOf('--playwright-module')+1];
if(!args.includes('--playwright-module')||!pm)throw Error('Supply the local Playwright module path');
const {chromium}=await import(pathToFileURL(path.resolve(pm)).href);
const {showcaseExamples,showcaseImage}=await importTypescript('src/lib/showcaseCatalog.ts');
const {showcaseHand,showcaseSize,withShowcaseMasks}=await importTypescript('src/lib/showcaseHands.ts');
const {createShowcaseDesign}=await importTypescript('src/lib/showcaseDesigns.ts');
const {parseDocument}=await importTypescript('src/lib/workshopData.ts');
const renderer=await typescriptModuleUrl('src/lib/nailRenderer.ts');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 for(const example of showcaseExamples){
   const hand=showcaseHand(example.hand),design=createShowcaseDesign(example);
   assert.ok(parseDocument(design));assert.equal(hand.nails.length,5);
   const source='data:image/webp;base64,'+(await readFile('public'+hand.src)).toString('base64');
   const webp=await page.evaluate(async({renderer,design,nails,source,size})=>{
     const {drawNails}=await import(renderer),image=new Image();
     image.src=source;await image.decode();
     if(image.width!==size.width||image.height!==size.height)throw Error('Wrong source geometry');
     const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
     const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
     let drawn=0;
     await drawNails(ctx,canvas.width,canvas.height,nails,design.fingers[0].base,{fingers:design.fingers,onPainted:count=>drawn=count});
     if(drawn!==5)throw Error('All five nails must be rendered');
     return canvas.toDataURL('image/webp',.85);
   },{renderer,design,nails:withShowcaseMasks(hand.src,hand.nails,design.fingers.map(f=>f.base.length)),source,size:showcaseSize});
   assert.match(webp,/^data:image\/webp;base64,/);
   const out='public'+showcaseImage(example),bytes=Buffer.from(webp.split(',')[1],'base64');
   await writeFile(out,bytes);console.log(example.id,bytes.length);
 }
}finally{await browser.close();}
