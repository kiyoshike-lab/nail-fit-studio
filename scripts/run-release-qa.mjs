// Read-only LOCAL QA orchestration. Never pushes, deploys or contacts Formspree.
// Each child launches fresh browser contexts; distinct rounds have distinct jobs.
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
const args=process.argv.slice(2),opt=n=>args.includes(n)?args[args.indexOf(n)+1]:undefined;
const round=Number(opt('--round')),base=opt('--base-url'),ready=opt('--ready-base-url'),out=path.resolve(opt('--output-dir')??'.');
if(![1,3].includes(round))throw Error('This runner covers functional round1 or fresh final round3. Round2 has a separate visual/UX protocol.');
for(const url of[base,ready])if(!url||!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Local servers required');
const pm=opt('--playwright-module'),image=opt('--image'),palm=opt('--palm-image'),curled=opt('--curled-image');
for(const file of[pm,image,palm,curled]){if(!file)throw Error('All QA fixture paths required');await access(file);}
await mkdir(out,{recursive:true});
const git=(...a)=>execFileSync('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,...a],{encoding:'utf8'}).trim();
const now=()=>({utc:new Date().toISOString(),jst:new Date().toLocaleString('sv-SE',{timeZone:'Asia/Tokyo',hour12:false})+' JST'});
const report={round,purpose:round===1?'functional correctness, storage failures and component integration':'fresh final code regression after fixes; separate performance/security follow-up',targetCommit:git('rev-parse','HEAD'),branch:git('branch','--show-current'),workingChanges:git('status','--short'),started:now(),jobs:[],unexecuted:[
 {id:'physical-camera',reason:'No physical webcam/phone manipulation; real bundled model uses local photographs and captureStream'},
 {id:'iphone-safari',reason:'Desktop responsive/CDP touch tests are not iPhone hardware'},
 {id:'android-chrome',reason:'Desktop responsive/CDP touch tests are not Android hardware'},
 {id:'provider-delivery-captcha',reason:'Formspree/Turnstile are mocked locally; no real emails or third-party attack tests'},
 {id:'live-ad-analytics',reason:'Ad/GA tags are checked; real delivery and overlays are blocked in local browser QA'},
]};
const flush=()=>writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
async function run(id,argv){
 const job={id,command:[process.execPath,...argv],started:now(),log:id+'.log'};report.jobs.push(job);await flush();
 const child=spawn(process.execPath,argv,{cwd:process.cwd(),env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 job.exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>resolve(code??(signal?128:1)));});
 job.ended=now();job.status=job.exitCode===0?'passed':'failed';await writeFile(path.join(out,job.log),output);await flush();console.log(`round${round} ${id}: ${job.status}`);
}
const pkg=JSON.parse(await readFile('package.json','utf8'));
for(const [i,part]of pkg.scripts.test.split('&&').entries()){
 const match=part.trim().match(/^node (scripts\/[a-z0-9-]+\.mjs)$/);if(!match)throw Error('Unexpected npm test command');await run(`unit-${String(i+1).padStart(2,'0')}-${path.basename(match[1],'.mjs')}`,[match[1]]);
}
const jobs=[
 ['site-quality','check-site-quality-browser.mjs',['--assert-fixed']],
 ['workshop','check-workshop-browser.mjs',['--image',image]],
 ['paint','check-nail-paint-browser.mjs',['--image',image]],
 ['materials','check-material-placement-browser.mjs',['--image',image]],
 ['styles','check-nail-styles-browser.mjs',['--image',image]],
 ['navigation','check-paint-navigation-browser.mjs',[]],
 ['recovery','check-workshop-recovery-browser.mjs',[]],
 ['preview-contact','check-preview-contact-browser.mjs',['--ready-base-url',ready,'--image',image]],
 ['photo-race','check-photo-race-browser.mjs',['--assert-fixed']],
 ['distance','check-distance-browser.mjs',['--image',image]],
 ['curled','check-curled-browser.mjs',['--back-image',image,'--palm-image',palm,'--curled-image',curled]],
 ['mobile-diagnostics','check-mobile-diagnostics-browser.mjs',['--image',image]],
 ['seo','check-seo-browser.mjs',[]],
];
for(const[id,file,extra]of jobs)await run(id,['scripts/'+file,'--base-url',base,'--playwright-module',pm,'--output',path.join(out,id+'.json'),...extra]);
await run('model-delivery',['scripts/check-startup-delivery.mjs','--base-url',base]);
if(round===3){
 await run('studio-settings',['scripts/check-studio-settings-browser.mjs','--base-url',base,'--playwright-module',pm,'--output-dir',path.join(out,'studio-settings'),'--assert-fixed']);
 if(!opt('--before-root'))throw Error('--before-root required for independent final rendering comparison');
 await run('render-equality',['scripts/check-render-cache-browser.mjs','--base-url',base,'--playwright-module',pm,'--before-root',opt('--before-root'),'--output',path.join(out,'render-equality.json')]);
 await run('visual-recheck',['scripts/check-release-visual-browser.mjs','--base-url',base,'--playwright-module',pm,'--output-dir',path.join(out,'visual-recheck'),'--strict']);
 await run('legacy-material-quality',['scripts/check-legacy-preset-quality-browser.mjs','--base-url',base,'--playwright-module',pm,'--output-dir',path.join(out,'legacy-material-quality'),'--strict']);
}
report.ended=now();report.summary={planned:report.jobs.length+report.unexecuted.length,executed:report.jobs.length,passed:report.jobs.filter(j=>j.status==='passed').length,failed:report.jobs.filter(j=>j.status==='failed').length,unexecuted:report.unexecuted.length};await flush();console.log(JSON.stringify(report.summary));if(report.summary.failed)process.exitCode=1;
