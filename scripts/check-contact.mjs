import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importTypescript } from './lib/import-typescript.mjs';
const { contactConfiguration } = await importTypescript('src/lib/contactConfiguration.ts');
const { validateContact } = await importTypescript('src/lib/contactValidation.ts');
const { handleContact, contactRateLimiter } = await importTypescript('src/lib/contactServer.ts');
const env = {CONTACT_FORMSPREE_FORM_ID:'qaform00',CONTACT_TURNSTILE_SITE_KEY:'qa-public-widget-key',CONTACT_FORMSPREE_TURNSTILE_ENABLED:'true'};
const config = contactConfiguration(env);
assert.equal(config.ready,true);
for(const partial of [{},{...env,CONTACT_FORMSPREE_TURNSTILE_ENABLED:''},{...env,CONTACT_FORMSPREE_FORM_ID:'../arbitrary'},{...env,CONTACT_TURNSTILE_SITE_KEY:'1x00000000000000000000AA'}])assert.equal(contactConfiguration(partial).ready,false);
assert.equal(Object.hasOwn(config,'secretKey'),false,'an unused provider secret should not be collected');
const valid={name:'',email:'',kind:'bug',message:'端末とブラウザを確認したいです。',website:'',token:'qa-valid-token'};
assert.ok(validateContact(valid).fields);
assert.ok(validateContact({...valid,name:'利用者',email:'test@example.test'}).fields);
for(const email of ['a','a@b','a\n@b.test','a\u0000@b.test','a@example.test,other@example.test'])assert.ok(validateContact({...valid,email}).errors.email);
for(const value of [null,[],{...valid,name:{}},{...valid,name:'a'.repeat(81)},{...valid,kind:'__proto__'},{...valid,message:''},{...valid,message:'a'.repeat(3001)},{...valid,message:'null\u0000byte'}])assert.equal(validateContact(value).fields,undefined);
const request=(data=valid,headers={},body)=>new Request('https://nail-fit-studio.vercel.app/api/contact',{method:'POST',headers:{origin:'https://nail-fit-studio.vercel.app','content-type':'application/json',...headers},body:body??JSON.stringify(data)});
const calls=[];
const send=async(url,options)=>{calls.push({url,options});return Response.json({ok:true});};
const invoke=(r=request(),c=config,fetch=send,allow=()=>true)=>handleContact(r,c,{fetch,allow});
let response=await invoke();assert.equal(response.status,200);assert.equal((await response.json()).ok,true);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(calls.length,1);
const payload=JSON.parse(calls[0].options.body);assert.deepEqual(Object.keys(payload).sort(),['category','message','_subject','cf-turnstile-response'].sort());assert.equal(payload['cf-turnstile-response'],valid.token);assert.equal(payload.category,'不具合');assert.equal(calls[0].options.redirect,'error');assert.match(calls[0].url,/^https:\/\/formspree\.io\/f\/qaform00$/);
assert.ok(!calls[0].options.body.includes('camera'));assert.equal(calls[0].options.headers.Origin,'https://nail-fit-studio.vercel.app');
const internal=new Request('http://localhost:3000/api/contact',{method:'POST',headers:{host:'nail-fit-studio.vercel.app',origin:'https://nail-fit-studio.vercel.app','x-forwarded-proto':'https','content-type':'application/json'},body:JSON.stringify(valid)});
assert.equal((await invoke(internal)).status,200,'Next internal localhost URL rejected a valid HTTP Host/Origin');
const noSend=async()=>{throw Error('outbound called before validation');};
for(const [r,c,status]of[
 [request(),contactConfiguration({}),503],
 [request(valid,{origin:'https://attacker.test'}),config,403],
 [request(valid,{origin:'https://attacker.test','x-forwarded-host':'attacker.test'}),config,403],
 [request(valid,{origin:'http://nail-fit-studio.vercel.app','x-forwarded-proto':'https'}),config,403],
 [request(valid,{'sec-fetch-site':'cross-site'}),config,403],
 [request(valid,{'content-type':'text/plain'}),config,415],
 [request({...valid,message:''}),config,400],
 [request({...valid,token:''}),config,400],
 [request({...valid,token:'a'.repeat(2049)}),config,400],
 [request({...valid,website:'bot-filled'}),config,400],
 [request({...valid,to:'attacker@example.test'}),config,400],
 [request({...valid,_cc:'attacker@example.test'}),config,400],
 [request(valid,{},'not JSON'),config,400],
 [request(valid,{},'x'.repeat(17000)),config,413],
]){response=await invoke(r,c,noSend);assert.equal(response.status,status);assert.notEqual((await response.json()).ok,true);}
response=await invoke(request(),config,noSend,()=>false);assert.equal(response.status,429);
for(const [status,body,expected]of[[400,{errors:['private-provider-detail']},400],[422,{},400],[429,{},429],[500,{ok:true},502],[200,{ok:false},502],[200,{},502]]){
 response=await invoke(request(),config,async()=>Response.json(body,{status}));assert.equal(response.status,expected);const text=await response.text();assert.ok(!text.includes('private-provider-detail'));assert.ok(!text.includes('"ok":true'));
}
for(const fetch of [async()=>{throw Error('SECRET_KEY_AND_PERSONAL_BODY');},async()=>new Response('not JSON')]){response=await invoke(request(),config,fetch);assert.equal(response.status,502);assert.ok(!(await response.text()).includes('SECRET_KEY'));}
let clock=0;const allow=contactRateLimiter(()=>clock);for(let i=0;i<5;i++)assert.equal(allow('one-client'),true);assert.equal(allow('one-client'),false);clock=600001;assert.equal(allow('one-client'),true);
const global=contactRateLimiter(()=>0);for(let i=0;i<20;i++)assert.equal(global('client'+i),true);assert.equal(global('other'),false);
for(const file of ['src/lib/contactServer.ts','src/components/ContactForm.tsx']){const text=await readFile(file,'utf8');assert.ok(!text.includes('console.'),'contact information may be logged');assert.ok(!text.includes('localStorage'));}
const page=await readFile('app/contact/page.tsx','utf8');assert.ok(page.includes('enabled={config.ready} siteKey={config.ready ? config.siteKey : ""}'));assert.ok(page.includes('github.com/kiyoshike-lab/nail-fit-studio/issues/new'));
console.log('contact: unconfigured fail-closed, optional identity/email validation, bounded body, origin/type/honeypot/field whitelist, local limits, single-use token forwarding once to configured Formspree CAPTCHA, provider success/failures, no logs/photos/local storage passed (mock transport, NOT mail delivery)');
