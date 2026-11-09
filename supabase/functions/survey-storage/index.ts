// Server-to-server only. Custom authentication replaces Supabase JWT validation.
// The digest below is NOT the private token; the token exists only in Vercel preview secrets.
const EXPECTED_DIGEST='4e55269a086cff01d8e818bc544247f8c63f644da1b027c240836be6bbdc0fa2';
const ALLOWED=new Set(['ljov_check_rate','ljov_save_checkpoint','ljov_resume_response']);
const encoder=new TextEncoder();
function reply(status:number,value:unknown){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
async function authorized(req:Request){const m=/^Bearer ([A-Za-z0-9_-]{64,128})$/.exec(req.headers.get('authorization')||'');if(!m)return false;const d=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(m[1])));let diff=0;for(let i=0;i<32;i++)diff|=d[i]^parseInt(EXPECTED_DIGEST.slice(i*2,i*2+2),16);return diff===0;}
async function limitedBody(req:Request){if(!req.body)throw new Error('body');const reader=req.body.getReader();let size=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>160000){await reader.cancel();throw new Error('size');}chunks.push(value);}const combined=new Uint8Array(size);let offset=0;for(const c of chunks){combined.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(combined));}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply(405,{code:'method_not_allowed'});
 if(!await authorized(req))return reply(401,{code:'unauthorized'});
 if(!req.headers.get('content-type')?.startsWith('application/json'))return reply(415,{code:'json_required'});
 try{
  const input=await limitedBody(req);if(!input||!ALLOWED.has(input.name)||!input.args||typeof input.args!=='object'||Array.isArray(input.args))return reply(400,{code:'invalid_request'});
  if(input.name==='ljov_save_checkpoint'&&input.args.p_mode!=='test')return reply(403,{code:'test_environment_only'});
  const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');const key=keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const url=Deno.env.get('SUPABASE_URL');if(!key||!url)return reply(503,{code:'storage_unconfigured'});
  const headers:Record<string,string>={'apikey':key,'Content-Type':'application/json'};if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;
  const upstream=await fetch(url+'/rest/v1/rpc/'+input.name,{method:'POST',headers,body:JSON.stringify(input.args),signal:AbortSignal.timeout(8000)});
  const result=await upstream.json().catch(()=>({}));
  if(!upstream.ok){const raw=result.code==='PT409'?'40001':result.code;const code=['42501','23505','40001'].includes(raw)?raw:'storage_error';return reply(upstream.status,{code});}
  return reply(200,result);
 }catch{return reply(503,{code:'storage_unavailable'});}
});
