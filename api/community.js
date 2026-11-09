'use strict';
const S=require('../server/gateway.cjs');
// A comparison can be viewed only with the private link for a completed response.
// This is not anonymous public access to a one-person average.
module.exports=S.endpoint(async(req,res)=>{
 const hash=S.credentials(req),b=await S.body(req);
 S.uuid(b.responseId,'response ID');
 if(b.sourceVersion!==S.M.id)throw new S.ApiError(409,'This response belongs to a different survey version.');
 await S.rateLimit(req);
 const own=await S.rpc('ljov_resume_response_for_mode',{
  p_response_id:b.responseId,p_token_hash:hash,p_source_version:S.M.id,p_mode:S.mode()
 });
 if(!own.firstCompletedAt)throw new S.ApiError(403,'Complete your priorities before viewing the community comparison.');
 const d=await S.rpc('ljov_community_average',{p_source:S.M.id,p_mode:S.mode()});
 if(d.available!==true)return S.send(res,200,{...d,collectionMode:S.mode()});
 const tw=d.topicWeights||{},themeWeights={},outcomeWeights={};
 for(const t of S.WB.topics){
  const n=Number(tw[t.code]);if(!Number.isFinite(n))continue;
  themeWeights[t.theme]=(themeWeights[t.theme]||0)+n;
  for(const [outcome,active] of Object.entries(t.outcomeFlags||{})){
   if(active===1)outcomeWeights[outcome]=(outcomeWeights[outcome]||0)+n;
  }
 }
 S.send(res,200,{...d,themeWeights,outcomeWeights,collectionMode:S.mode()});
});