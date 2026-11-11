// Restricted server-to-server gateway, with separate production and test tokens.
// Only the SHA256 digests appear here. Vercel keeps the actual tokens encrypted.
const TEST_DIGEST='4e55269a086cff01d8e818bc544247f8c63f644da1b027c240836be6bbdc0fa2';
const PUBLIC_DIGEST='7ec26ae6ed790124ae2274fbf3ef510e67746c42bb1e9bc3d9822d8e413a619a';
const OPS=new Set([
  'ljov_check_rate',
  'ljov_save_checkpoint',
  'ljov_resume_response_for_mode',
  'ljov_collection_status',
  'ljov_community_average',
  'ljov_reminder_candidates',
  'ljov_reminder_reserve',
  'ljov_reminder_finish'
]);
const encoder=new TextEncoder();
function reply(status:number,value:unknown){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
async function credentialMode(req:Request){
 const m=/^Bearer ([A-Za-z0-9_-]{64,128})$/.exec(req.headers.get('authorization')||'');if(!m)return null;
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(m[1])));
 const matches=(hex:string)=>{if(!/^[0-9a-f]{64}$/.test(hex))return false;let diff=0;for(let i=0;i<32;i++)diff|=digest[i]^parseInt(hex.slice(i*2,i*2+2),16);return diff===0;};
 if(matches(TEST_DIGEST))return 'test';
 if(matches(PUBLIC_DIGEST))return 'public';
 return null;
}
async function limitedBody(req:Request){
 if(!req.body)throw Error('body');const reader=req.body.getReader();
 let bytes=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>160000){await reader.cancel();throw Error('size');}chunks.push(value);}
 const array=new Uint8Array(bytes);let i=0;for(const c of chunks){array.set(c,i);i+=c.length;}
 return JSON.parse(new TextDecoder().decode(array));
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply(405,{code:'method_not_allowed'});
 const mode=await credentialMode(req);if(!mode)return reply(401,{code:'unauthorized'});
 if(!req.headers.get('content-type')?.startsWith('application/json'))return reply(415,{code:'json_required'});
 try{
  const b=await limitedBody(req);
  if(!b||!OPS.has(b.name)||!b.args||typeof b.args!=='object'||Array.isArray(b.args))return reply(400,{code:'invalid_operation'});
  if(b.name!=='ljov_check_rate'&&b.args.p_mode!==mode)return reply(403,{code:'wrong_collection_mode'});
  const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}'),key=keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),url=Deno.env.get('SUPABASE_URL');
  if(!key||!url)return reply(503,{code:'storage_unconfigured'});
  const headers:Record<string,string>={apikey:key,'Content-Type':'application/json'};
  if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
  const upstream=await fetch(url+'/rest/v1/rpc/'+b.name,{method:'POST',headers,body:JSON.stringify(b.args),signal:AbortSignal.timeout(10000)});
  const result=await upstream.json().catch(()=>({}));
  if(!upstream.ok){
   if(result.code==='P0001'||String(result.message||'').includes('Survey is not accepting changes'))return reply(423,{code:'SURVEY_CLOSED'});
   const e=result.code==='PT409'?'40001':result.code;
   return reply(e==='42501'?403:['23505','40001'].includes(e)?409:upstream.status,{code:['42501','23505','40001'].includes(e)?e:'storage_error'});
  }
  return reply(200,result);
 }catch{return reply(503,{code:'storage_unavailable'});}
});
