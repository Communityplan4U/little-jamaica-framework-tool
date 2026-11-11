'use strict';
// Preserve the reviewed validation and weighting code. Database keys stay in Supabase.
const S=require('./survey.cjs'),crypto=require('node:crypto');

const ALLOWED=new Set([
  'ljov_check_rate',
  'ljov_save_checkpoint',
  'ljov_resume_response_for_mode',
  'ljov_collection_status',
  'ljov_community_average',
  'ljov_reminder_candidates'
]);

function configured(){return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(process.env.SUPABASE_URL||'')&&/^[A-Za-z0-9_-]{64,128}$/.test(process.env.SURVEY_GATEWAY_TOKEN||'');}
async function rpc(name,args){
 if(!configured())throw new S.ApiError(503,'Online response storage is awaiting setup.');
 if(!ALLOWED.has(name))throw new S.ApiError(400,'Unsupported storage operation.');
 const r=await fetch(process.env.SUPABASE_URL+'/functions/v1/survey-storage',{method:'POST',headers:{Authorization:'Bearer '+process.env.SURVEY_GATEWAY_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({name,args}),signal:AbortSignal.timeout(12000)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok){
  if(d.code==='SURVEY_CLOSED')throw new S.ApiError(423,'The survey has closed. Saved responses are read-only.');
  if(d.code==='42501')throw new S.ApiError(403,'This private return link is not authorized.');
  if(d.code==='23505'||d.code==='40001')throw new S.ApiError(409,'A newer response is saved. Reopen your private return link.');
  throw new S.ApiError(503,'Response storage is temporarily unavailable. Please retry.');
 }
 return d;
}
async function rateLimit(req){
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const key=crypto.createHmac('sha256',process.env.SURVEY_GATEWAY_TOKEN||'').update(new Date().toISOString().slice(0,13)+'|'+ip).digest('hex');
 if(await rpc('ljov_check_rate',{p_key:key})!==true)throw new S.ApiError(429,'Please wait a moment and try saving again.');
}
module.exports={...S,configured,rpc,rateLimit};
