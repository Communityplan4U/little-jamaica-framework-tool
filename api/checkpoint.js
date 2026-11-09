'use strict';
const S=require('../server/survey.cjs');
module.exports=S.endpoint(async(req,res)=>{const hash=S.credentials(req),c=S.validateEvent(await S.body(req));await S.rateLimit(req);S.send(res,200,await S.rpc('ljov_save_checkpoint',{p_token_hash:hash,p_event:c.event,p_contact:c.contact,p_mode:S.mode(),p_core_completed:c.coreCompleted}));});
