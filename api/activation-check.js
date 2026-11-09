'use strict';
// Temporary Round 2 verification route. Removed after activation; never allowed in production.
const crypto=require('node:crypto');
const S=require('../server/gateway.cjs');
const checkpoint=require('./checkpoint.js'),resume=require('./resume.js');
module.exports=async(req,res)=>{
 if(process.env.VERCEL_ENV==='production'||S.mode()!=='test'||req.method!=='GET')return S.send(res,404,{error:'Not found'});
 if(!S.configured())return S.send(res,503,{error:'Storage not configured'});
 const id=crypto.randomUUID(),token=crypto.randomBytes(48).toString('base64url'),checks=[];
 let stage='initial';
 const themes=S.WB.themes.map(t=>t.name).sort(),outcomes=S.M.outcomes.map(o=>o.id),codes=S.WB.topics.map(t=>t.code);
 const event=(revision,type,page,complete,after,order=codes,email='',newsletter=false,planning=false)=>({
  eventId:crypto.randomUUID(),responseId:id,revision,answerRevision:revision>4?3:revision>1?2:1,eventType:type,page,afterResultsShown:after,clientTimestamp:new Date().toISOString(),visitedPages:complete?[1,2,3,4,5]:[1],initialDisplayOrder:{themes,outcomes},
  snapshot:{responseId:id,version:'round2-activation-test',sourceVersion:S.M.id,themeRanking:themes,outcomeRanking:outcomes,topicWeights:order.map((code,i)=>({code,position:i+1,weight:999})),connections:['other'],notes:'Synthetic activation test; exclude from research.',email,communications:{newsletter,littleJamaicaUpdates:planning},inputEvidence:{continuedPages:complete?[1,2,3]:[1],page3GroupsReviewed:complete?[0,1]:[],themeOrderChanged:false,outcomeOrderChanged:false},manualPage3Changes:{},manualPage5Moves:revision>4?[{moved:order[0],fromRank:39,toRank:1}]:[],comparisonScope:'full'}
 });
 const invoke=async(fn,body,credential=token,origin=null)=>{
  let value;const response={statusCode:200,setHeader(){},end(t){value={status:this.statusCode,data:JSON.parse(t)};}};
  await fn({method:'POST',headers:{host:req.headers.host,origin:origin||'https://'+req.headers.host,'content-type':'application/json',authorization:credential?'Bearer '+credential:'','x-forwarded-for':'198.51.100.40'},body},response);
  return value;
 };
 const check=(name,passed)=>{if(!passed)throw Error(name);checks.push(name);};
 try{
  stage='blank email save';const first=event(1,'continue',1,false,false);let r=await invoke(checkpoint,first);check('blank_email_saved',r.status===200&&r.data.revision===1);
  stage='duplicate';r=await invoke(checkpoint,first);check('duplicate_checkpoint_idempotent',r.status===200&&r.data.duplicate===true);
  stage='pre-results';r=await invoke(checkpoint,event(2,'before_first_results',3,true,false));check('pre_results_snapshot_saved',r.status===200);
  const email='activation-'+id.slice(0,8)+'@example.invalid';
  stage='completion';r=await invoke(checkpoint,event(3,'complete',3,true,false,codes,email,true,false));check('completion_recorded',r.status===200&&r.data.status==='completed');
  stage='results';r=await invoke(checkpoint,event(4,'results_viewed',4,true,true,codes,email,true,false));check('results_view_recorded',r.status===200);
  const moved=[codes[codes.length-1],...codes.slice(0,-1)];const edited=event(5,'topic_moved',5,true,true,moved,email,false,true);
  stage='revision';r=await invoke(checkpoint,edited);check('post_completion_revision_recorded',r.status===200&&r.data.status==='edited_after_completion');
  stage='restore';r=await invoke(resume,{responseId:id,sourceVersion:S.M.id});
  check('private_link_restores_latest_answers',r.status===200&&r.data.revision===5&&r.data.resumeState.editorGroups[0][0]===moved[0]);
  check('independent_contact_preferences_restored',r.data.resumeState.email===email&&r.data.resumeState.newsletterOptIn===false&&r.data.resumeState.planningOptIn===true);
  check('pre_results_snapshot_excludes_contact',r.data.preResultsSnapshot&&!('email' in r.data.preResultsSnapshot)&&!('communications' in r.data.preResultsSnapshot));
  stage='authorization';r=await invoke(resume,{responseId:id,sourceVersion:S.M.id},crypto.randomBytes(48).toString('base64url'));check('wrong_private_token_rejected',r.status===403);
  r=await invoke(resume,{responseId:crypto.randomUUID(),sourceVersion:S.M.id});check('other_response_unavailable',r.status===403);
  r=await invoke(resume,{responseId:id,sourceVersion:S.M.id},'');check('missing_token_rejected',r.status===401);
  stage='stale revision';r=await invoke(checkpoint,event(4,'results_viewed',4,true,true));check('out_of_order_revision_rejected',r.status===409);
  stage='invalid topic';const bad=event(6,'topic_moved',5,true,true,moved);bad.snapshot.topicWeights[0].code=bad.snapshot.topicWeights[1].code;r=await invoke(checkpoint,bad);check('invalid_topic_permutation_rejected',r.status===400);
  stage='cross-site';r=await invoke(checkpoint,edited,token,'https://example.invalid');check('cross_site_submission_rejected',r.status===403);
  stage='duplicate latest';r=await invoke(checkpoint,edited);check('retry_after_edit_idempotent',r.status===200&&r.data.duplicate===true);
  stage='gateway authentication';const unauthorized=await fetch(process.env.SUPABASE_URL+'/functions/v1/survey-storage',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});check('unauthenticated_gateway_rejected',unauthorized.status===401);
  S.send(res,200,{ok:true,checksPassed:checks.length,checks,syntheticResponseId:id,mode:'test'});
 }catch(e){S.send(res,500,{ok:false,stage,checkFailed:String(e.message),checksPassed:checks.length,syntheticResponseId:id});}
};
