'use strict';
const S=require('../server/gateway.cjs');
module.exports=S.endpoint(async(req,res)=>{const hash=S.credentials(req),b=await S.body(req);S.uuid(b.responseId,'response ID');if(b.sourceVersion!==S.M.id)throw new S.ApiError(409,'This link belongs to a different survey methodology.');await S.rateLimit(req);S.send(res,200,await S.rpc('ljov_resume_response',{p_response_id:b.responseId,p_token_hash:hash,p_source_version:S.M.id}));});
