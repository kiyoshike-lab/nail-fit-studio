// Optional maintainer-only rasterizer. SVG sources and generated PNGs are checked
// in; Vercel / npm install / build need neither Playwright nor system CJK fonts.
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const args=process.argv.slice(2);
if(!args.includes('--playwright-module'))throw Error('Pass --playwright-module <QA Playwright/index.mjs>; run on a machine with Meiryo or Noto Sans JP installed, then visually check Japanese text.');
const {chromium}=await import(pathToFileURL(path.resolve(args[args.indexOf('--playwright-module')+1])).href);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({deviceScaleFactor:1});
 async function render(source,destination,width,height){
  await mkdir(path.dirname(destination),{recursive:true});
  const svg=await readFile(source,'utf8');
  await page.setViewportSize({width,height});
  await page.setContent(`<html lang="ja"><body style="margin:0;width:${width}px;height:${height}px"><img style="display:block;width:100%;height:100%" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
  await page.locator('img').evaluate(image=>image.decode());
  await page.screenshot({path:destination,type:'png'});
 }
 await render('public/og/nail-fit-studio-ja-20261029.svg','public/og/nail-fit-studio-ja-20261029.png',1200,630);
 for(const [size,file]of [[48,'favicon-48'],[180,'apple-touch-icon'],[192,'icon-192'],[512,'icon-512']]){
  await render('public/icons/nail-fit-studio.svg',`public/icons/${file}.png`,size,size);
 }
 console.log('SEO assets rendered: 1200x630 Japanese share image, 48/180/192/512 icons; inspect PNG before committing.');
}finally{await browser.close();}
