'use strict';
const crypto=require('node:crypto'),WB=require('../data/assessment.json'),M=require('../data/methodology.json');
const THEMES=WB.themes.map(x=>x.name),OUTCOMES=M.outcomes.map(x=>x.id),CODES=WB.topics.map(x=>x.code);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(s,m)=>{throw new ApiError(s,m)};
function permutation(v,a,n){if(!Array.isArray(v)||v.length!==a.length||new Set(v).size!==a.length||v.some(x=>!a.includes(x)))fail(400,'Invalid '+n);return v.slice();}
function integer(v,min,max,n){if(!Number.isInteger(v)||v<min||v>max)fail(400,'Invalid '+n);return v;}
function text(v,max,n){if(typeof v!=='string'||v.length>max)fail(400,'Invalid '+n);return v;}
function uuid(v,n){if(typeof v!=='string'||!UUID.test(v))fail(400,'Invalid '+n);return v;}
function canonicalSnapshot(input,responseId){
 if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Missing response snapshot');
 if(input.sourceVersion!==M.id)fail(409,'This survey version is not accepted by this endpoint.');
 if(input.responseId!==responseId)fail(400,'Response ID mismatch');
 const themeRanking=permutation(input.themeRanking,THEMES,'theme ranking'),outcomeRanking=permutation(input.outcomeRanking,OUTCOMES,'outcome ranking');
 if(!Array.isArray(input.topicWeights)||input.topicWeights.length!==CODES.length)fail(400,'Invalid topic positions');
 const sorted=input.topicWeights.slice().sort((a,b)=>a.position-b.position);
 if(sorted.some((x,i)=>x.position!==i+1))fail(400,'Topic positions must be unique and consecutive');
 const order=permutation(sorted.map(x=>x.code),CODES,'topics'),weights={},lookup={};let start=0;
 const groups=M.groupCounts.map((n,i)=>{const topics=order.slice(start,start+n),totalShare=M.groupShares[i]/100;topics.forEach((code,j)=>{weights[code]=totalShare/n;lookup[code]={code,position:start+j+1,group:M.groupNames[i],weight:weights[code]};});start+=n;return{group:M.groupNames[i],totalShare,topics};});
 const connections=Array.isArray(input.connections)?[...new Set(input.connections)]:[];
 if(connections.some(x=>!['resident','former','business','worker','organization','culture','services','other'].includes(x)))fail(400,'Invalid connection option');
 const notes=text(input.notes||'',1500,'comments'),email=text(input.email||'',254,'email').trim();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Email is optional; use a valid address or leave it blank.');
 const cm=input.communications||{},contact={email:email||null,results_updates:!!email,newsletter:!!email&&cm.newsletter===true,planning_updates:!!email&&cm.littleJamaicaUpdates===true,notice_version:'ljov-consent-v1'};
 const e=input.inputEvidence||{},continuedPages=Array.isArray(e.continuedPages)?[...new Set(e.continuedPages.filter(x=>Number.isInteger(x)&&x>=1&&x<=6))]:[],reviewed=Array.isArray(e.page3GroupsReviewed)?[...new Set(e.page3GroupsReviewed.filter(x=>x===0||x===1))]:[];
 const coreCompleted=[1,2,3].every(x=>continuedPages.includes(x))&&reviewed.length===2;
 const manualPage3Changes={};for(const [code,d] of Object.entries(input.manualPage3Changes||{})){if(!CODES.includes(code)||!d||!['pin','min'].includes(d.kind)||!Number.isInteger(d.band)||d.band<0||d.band>5||(d.kind==='pin'&&d.band>2))fail(400,'Invalid topic adjustment');manualPage3Changes[code]={kind:d.kind,band:d.band};}
 const manualPage5Moves=Array.isArray(input.manualPage5Moves)?input.manualPage5Moves.slice(-500).map(m=>({moved:CODES.includes(m.moved)?m.moved:fail(400,'Invalid moved topic'),fromRank:integer(m.fromRank,1,39,'previous position'),toRank:integer(m.toRank,1,39,'new position'),shiftCount:Math.abs(m.fromRank-m.toRank)})):[];
 const snapshot={type:'Little Jamaica community weighting survey',version:text(input.version||'',100,'survey version'),sourceVersion:M.id,responseId,sourceWorkbook:WB.filename,topicCount:CODES.length,themeRanking,outcomeRanking,connections,outcomeMultipliers:Object.fromEntries(outcomeRanking.map((id,i)=>[id,M.outcomeRankMultipliers[i]])),priorityGroups:groups,topicWeights:CODES.map(c=>lookup[c]),score:WB.topics.reduce((n,t)=>n+weights[t.code]*t.score,0),comparisonScope:input.comparisonScope==='full'?'full':'vision',notes,manualPage3Changes,manualPage5Moves,inputEvidence:{themeOrderChanged:e.themeOrderChanged===true,outcomeOrderChanged:e.outcomeOrderChanged===true,continuedPages,page3GroupsReviewed:reviewed,coreStepsCompleted:coreCompleted}};
 return {snapshot,contact,coreCompleted};
}
function validateEvent(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail(400,'Invalid checkpoint');
 const responseId=uuid(raw.responseId,'response ID'),eventId=uuid(raw.eventId,'event ID'),revision=integer(raw.revision,1,1000000,'revision'),answerRevision=integer(raw.answerRevision,0,1000000,'answer revision'),page=integer(raw.page,1,6,'page');
 const types=['continue','complete','navigation','back','before_first_results','results_viewed','editor_viewed','community_viewed','comments_shared','topic_moved','topic_move_undone','topic_moves_reset','resume','export'];
 if(!types.includes(raw.eventType))fail(400,'Invalid checkpoint event');
 const c=canonicalSnapshot(raw.snapshot,responseId),s=c.snapshot;
 if(raw.eventType==='complete'&&!c.coreCompleted)fail(400,'Complete the three priority steps first.');
 const resumeState={page:page-1,communityView:['topics','themes','outcomes'].includes(raw.resumeState?.communityView)?raw.resumeState.communityView:'topics',ranking:s.themeRanking,outcomeRanking:s.outcomeRanking,decisions:s.manualPage3Changes,history:[],scope:s.comparisonScope,movedTheme:s.inputEvidence.themeOrderChanged,movedOutcomes:s.inputEvidence.outcomeOrderChanged,refineBand:raw.resumeState?.refineBand===1?1:0,editorGroups:s.priorityGroups.map(g=>g.topics),editorSignature:JSON.stringify({theme:s.themeRanking,outcomes:s.outcomeRanking,choices:s.manualPage3Changes}),editorHistory:[],editorMoves:s.manualPage5Moves,feedback:s.notes,connections:s.connections,email:'',newsletterOptIn:false,planningOptIn:false,resultsMode:'gap',matrixWeighting:'weighted',completed:c.coreCompleted};
 let initialDisplayOrder={themes:THEMES.slice().sort(),outcomes:OUTCOMES.slice()};
 if(raw.initialDisplayOrder){try{initialDisplayOrder={themes:permutation(raw.initialDisplayOrder.themes,THEMES,'initial themes'),outcomes:permutation(raw.initialDisplayOrder.outcomes,OUTCOMES,'initial outcomes')};}catch{}}
 const event={eventId,responseId,surveyVersion:s.version,sourceVersion:M.id,revision,answerRevision,eventType:raw.eventType,clientTimestamp:typeof raw.clientTimestamp==='string'&&Number.isFinite(Date.parse(raw.clientTimestamp))?raw.clientTimestamp:null,page,substep:raw.substep===1||raw.substep===2?raw.substep:null,afterResultsShown:raw.afterResultsShown===true,visitedPages:Array.isArray(raw.visitedPages)?raw.visitedPages.filter(x=>Number.isInteger(x)&&x>=1&&x<=6):[],continuedPages:s.inputEvidence.continuedPages,snapshot:s,resumeState,initialDisplayOrder};
 return {...c,event};
}
function credentials(req){const m=/^Bearer ([A-Za-z0-9_-]{64,128})$/.exec(req.headers.authorization||'');if(!m)fail(401,'A private response token is required.');return crypto.createHash('sha256').update(m[1]).digest('hex');}
function mode(){return process.env.VERCEL_ENV==='production'&&process.env.SURVEY_COLLECTION_MODE==='public'?'public':'test';}
function configured(){return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(process.env.SUPABASE_URL||'')&&!!process.env.SUPABASE_SECRET_KEY;}
function send(res,status,data){res.setHeader('Cache-Control','no-store, private');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');res.statusCode=status;res.end(JSON.stringify(data));}
function sameOrigin(req){const origin=req.headers.origin;if(origin){let host;try{host=new URL(origin).host;}catch{fail(403,'Invalid origin');}if(host!==req.headers.host)fail(403,'Cross-site submission rejected');}if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Cross-site submission rejected');}
async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Use JSON');const max=150000;if(Number(req.headers['content-length']||0)>max)fail(413,'Checkpoint too large');let raw;if(req.body!==undefined)raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);else{raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>max)fail(413,'Checkpoint too large');}}if(Buffer.byteLength(raw)>max)fail(413,'Checkpoint too large');try{return JSON.parse(raw);}catch{fail(400,'Invalid JSON');}}
async function rpc(name,args){if(!configured())fail(503,'Online response storage is awaiting setup.');const key=process.env.SUPABASE_SECRET_KEY,headers={'apikey':key,'Content-Type':'application/json'};if(key.startsWith('eyJ'))headers.Authorization='Bearer '+key;const r=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(9000)});const d=await r.json().catch(()=>({}));if(!r.ok){if(d.code==='42501')fail(403,'This private return link is not authorized.');if(d.code==='23505'||d.code==='40001')fail(409,'A newer response is saved. Reopen your private return link.');fail(503,'Response storage is temporarily unavailable. Please retry.');}return d;}
async function rateLimit(req){const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();const key=crypto.createHmac('sha256',process.env.SUPABASE_SECRET_KEY||'').update(new Date().toISOString().slice(0,13)+'|'+ip).digest('hex');if(await rpc('ljov_check_rate',{p_key:key})!==true)fail(429,'Please wait a moment and try saving again.');}
function endpoint(fn){return async(req,res)=>{try{if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{error:'Method not allowed'});}sameOrigin(req);await fn(req,res);}catch(e){send(res,e instanceof ApiError?e.status:503,{error:e instanceof ApiError?e.message:'The save service is temporarily unavailable. Please retry.'});}};}
module.exports={M,WB,ApiError,validateEvent,canonicalSnapshot,credentials,mode,configured,send,sameOrigin,body,rpc,rateLimit,endpoint,uuid};
