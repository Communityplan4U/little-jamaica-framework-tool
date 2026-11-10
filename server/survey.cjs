'use strict';
const crypto=require('node:crypto');
const WB=require('../data/assessment.json');
const M=require('../data/methodology.json');
const THEMES=WB.themes.map(t=>t.name),OUTCOMES=M.outcomes.map(t=>t.id),CODES=WB.surveyTopics.map(t=>t.code);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
function fail(code,msg){throw new ApiError(code,msg);}
function uuid(x,label){if(typeof x!=='string'||!UUID.test(x))fail(400,'Invalid '+label);return x;}
function permutation(a,expected,label){
 if(!Array.isArray(a)||a.length!==expected.length||new Set(a).size!==expected.length||a.some(x=>!expected.includes(x)))fail(400,'Invalid '+label);return a.slice();
}
function selected(a,max,label){
 if(!Array.isArray(a)||a.length>max||new Set(a).size!==a.length||a.some(x=>!CODES.includes(x)))fail(400,'Invalid '+label);return a.slice();
}
function text(x,max,label){if(typeof x!=='string'||x.length>max)fail(400,'Invalid '+label);return x;}
const WEIGHTS=Object.fromEntries(M.groupNames.map((n,i)=>[n,M.groupShares[i]/100/M.groupCounts[i]]));
// Preserve legacy connection options for saved responses; accept the new public form choices.
const WHO=['resident','former','business','worker','organization','culture','services','visit','representation','other'];
function canonicalSnapshot(input,rid){
 if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Missing survey response');
 if(input.sourceVersion!==M.id||input.responseId!==rid)fail(409,'Survey version mismatch');
 const ranking=permutation(input.themeRanking,THEMES,'themes');
 const outcomes=permutation(input.outcomeRanking,OUTCOMES,'outcomes');
 const top=selected(input.topSelected||[],M.groupCounts[0],'top-six selection');
 const bottom=selected(input.bottomSelected||[],M.groupCounts[2],'lowest-two selection');
 const excludedTop=selected(input.excludedTop||[],M.topicCount-M.groupCounts[0],'demoted top suggestions');
 const promotedTop=selected(input.promotedTop||[],M.groupCounts[0],'participant-selected highest suggestions');
 if(top.some(x=>bottom.includes(x)))fail(400,'A topic cannot be highest and lowest');
 if(top.some(x=>excludedTop.includes(x)))fail(400,'A topic moved to middle cannot remain in the highest group');
 if(promotedTop.some(x=>!top.includes(x)))fail(400,'A participant-added highest topic must remain in the highest group');
 const order=permutation((input.topicWeights||[]).slice().sort((a,b)=>a.position-b.position).map(x=>x.code),CODES,'topic order');
 const completeChoices=top.length===M.groupCounts[0]&&bottom.length===M.groupCounts[2];
 if(completeChoices){
  if(order.slice(0,M.groupCounts[0]).some(x=>!top.includes(x))||order.slice(-M.groupCounts[2]).some(x=>!bottom.includes(x)))fail(400,'Explicit selections do not match topic weights');
 }
 let pos=0,weighted=[];
 for(let k=0;k<M.groupCounts.length;k++){
  const name=M.groupNames[k],n=M.groupCounts[k],weight=WEIGHTS[name];
  for(let i=0;i<n;i++){const code=order[pos];weighted.push({code,position:pos+1,group:name,weight});pos++;}
 }
 const connections=selectedConnections(input.connections||[]);
 const notes=text(input.notes||'',1500,'comments');
 const email=text(input.email||'',254,'email').trim();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Email must be valid or blank');
 const cm=input.communications||{};
 const contact={email:email||null,results_updates:!!email,newsletter:!!email&&cm.newsletter===true,planning_updates:!!email&&cm.littleJamaicaUpdates===true,notice_version:'ljov-consent-v2-early-averages'};
 const evidence=input.inputEvidence||{};
 const pages=Array.isArray(evidence.continuedPages)?[...new Set(evidence.continuedPages.filter(x=>Number.isInteger(x)&&x>=1&&x<=6))]:[];
 const coreCompleted=completeChoices&&[1,2,3,4].every(n=>pages.includes(n));
 const criteriaByCode=Object.fromEntries(WB.topics.map(t=>[t.code,t]));
 const score=WB.surveyTopics.reduce((sum,t)=>{
  const weight=WEIGHTS[weighted.find(w=>w.code===t.code).group];
  const criteria=t.criterionCodes.map(code=>criteriaByCode[code]);
  if(!criteria.length||criteria.some(c=>!c))fail(500,'Assessment crosswalk is incomplete');
  return sum+weight*criteria.reduce((total,c)=>total+c.score,0)/criteria.length;
 },0);
 const snap={type:'Little Jamaica community weighting survey',version:text(input.version||'',100,'survey version'),sourceVersion:M.id,responseId:rid,topicCount:M.topicCount,sourceWorkbook:WB.filename,
  themeRanking:ranking,outcomeRanking:outcomes,topSelected:top,bottomSelected:bottom,excludedTop,promotedTop,connections,notes,score,
  comparisonScope:input.comparisonScope==='full'?'full':'vision',topicWeights:weighted,
  priorityGroups:M.groupNames.map((name,k)=>({group:name,totalShare:M.groupShares[k]/100,topics:weighted.filter(w=>w.group===name).map(w=>w.code)})),
  inputEvidence:{continuedPages:pages,coreStepsCompleted:coreCompleted,explicitTopSix:top.length===M.groupCounts[0],explicitLowestTwo:bottom.length===M.groupCounts[2]}};
 return{snapshot:snap,contact,coreCompleted};
}
function selectedConnections(a){if(!Array.isArray(a)||a.length>8||a.some(x=>!WHO.includes(x)))fail(400,'Invalid neighbourhood connection');return [...new Set(a)];}
function validateEvent(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail(400,'Invalid checkpoint');
 const rid=uuid(raw.responseId,'response ID'),eid=uuid(raw.eventId,'event ID'),rev=raw.revision,page=raw.page,ar=raw.answerRevision;
 if(!Number.isInteger(rev)||rev<1||rev>1000000||!Number.isInteger(ar)||ar<0||ar>1000000||!Number.isInteger(page)||page<1||page>6)fail(400,'Invalid revision or page');
 const allowed=['continue','complete','navigation','results_viewed','community_viewed','revision','comments_shared','preferences_saved'];
 if(!allowed.includes(raw.eventType))fail(400,'Invalid event type');
 const c=canonicalSnapshot(raw.snapshot,rid);
 if(raw.eventType==='complete'&&!c.coreCompleted)fail(400,'Complete the topic selections first');
 const resumeState={page:Math.min(5,Math.max(0,Number.isInteger(raw.resumeState?.page)?raw.resumeState.page:0)),
  ranking:c.snapshot.themeRanking,outcomeRanking:c.snapshot.outcomeRanking,top:c.snapshot.topSelected,bottom:c.snapshot.bottomSelected,excludedTop:c.snapshot.excludedTop,promotedTop:c.snapshot.promotedTop,
  connections:c.snapshot.connections,feedback:c.snapshot.notes,scope:c.snapshot.comparisonScope,
  email:'',newsletterOptIn:false,planningOptIn:false,completed:c.coreCompleted};
 const event={eventId:eid,responseId:rid,revision:rev,answerRevision:ar,eventType:raw.eventType,
  surveyVersion:c.snapshot.version,sourceVersion:M.id,clientTimestamp:typeof raw.clientTimestamp==='string'?raw.clientTimestamp:null,
  page,visitedPages:Array.isArray(raw.visitedPages)?raw.visitedPages.filter(x=>Number.isInteger(x)&&x>=1&&x<=6):[],
  continuedPages:c.snapshot.inputEvidence.continuedPages,afterResultsShown:raw.afterResultsShown===true,
  snapshot:c.snapshot,resumeState,initialDisplayOrder:{themes:THEMES,outcomes:OUTCOMES}};
 return {...c,event};
}
function credentials(req){const m=/^Bearer ([A-Za-z0-9_-]{64,128})$/.exec(req.headers.authorization||'');if(!m)fail(401,'A private response token is required');return crypto.createHash('sha256').update(m[1]).digest('hex');}
function mode(){return process.env.VERCEL_ENV==='production'&&process.env.SURVEY_COLLECTION_MODE==='public'?'public':'test';}
function send(res,status,data){res.setHeader('Cache-Control','no-store, private');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');res.statusCode=status;res.end(JSON.stringify(data));}
function sameOrigin(req){const origin=req.headers.origin;if(origin){let host;try{host=new URL(origin).host;}catch{fail(403,'Invalid origin');}if(host!==req.headers.host)fail(403,'Cross-site submission rejected');}if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Cross-site submission rejected');}
async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Use JSON');const max=150000;if(Number(req.headers['content-length']||0)>max)fail(413,'Request too large');let raw;if(req.body!==undefined)raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);else{raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>max)fail(413,'Request too large');}}if(Buffer.byteLength(raw)>max)fail(413,'Request too large');try{return JSON.parse(raw);}catch{fail(400,'Invalid JSON');}}
function endpoint(fn){return async(req,res)=>{try{if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});sameOrigin(req);await fn(req,res);}catch(e){send(res,e instanceof ApiError?e.status:503,{error:e instanceof ApiError?e.message:'The survey service is temporarily unavailable'});}};}
module.exports={M,WB,ApiError,validateEvent,canonicalSnapshot,credentials,mode,send,sameOrigin,body,endpoint,uuid};
