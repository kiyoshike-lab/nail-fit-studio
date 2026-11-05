// Explicit QA-only Node preload. NEVER a production flag/backdoor. No requests
// to Formspree leave this test process; success is mocked, NOT mail delivery.
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
 if(url.hostname!=='formspree.io')return realFetch(input,init);
 const body=JSON.parse(init.body);
 await new Promise(resolve=>setTimeout(resolve,250));
 if(body['cf-turnstile-response']!=='qa-valid-turnstile-token')return Response.json({errors:[{code:'CAPTCHA_FAILED'}]},{status:400});
 if(body.message.startsWith('[QA FAIL]'))return Response.json({error:'PRIVATE_PROVIDER_DETAIL'},{status:500});
 if(body.message.startsWith('[QA FALSE OK]'))return Response.json({ok:false});
 if(body.message.startsWith('[QA LIMIT]'))return Response.json({errors:[]},{status:429});
 return Response.json({ok:true});
};
