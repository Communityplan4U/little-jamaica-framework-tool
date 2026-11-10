'use strict';
const STEPS=['Rank planning areas and community outcomes','Rank topics by expected community impact','Compare planning frameworks','Your assessment weight, and the community'];
const STORE='cip.ljov.20.top6.bottom2.combined-ranking.drag-order.v3.';

// Direct source documents; framework columns follow WB.comparators in the assessment workbook.
const FRAMEWORK_REPORTS={
 local:'https://drive.google.com/file/d/120GGehAkWSTByvfSLy4vcQEEqMcRE5XQ/view?usp=drive_link',
 localProposals:'https://www.toronto.ca/legdocs/mmis/2026/ph/bgrd/backgroundfile-285675.pdf',
 comparators:[
  'https://www.toronto.ca/legdocs/mmis/2026/te/bgrd/backgroundfile-288691.pdf',
  'https://www.toronto.ca/wp-content/uploads/2021/12/8d32-CityPlanning-Picture-Mount-Dennis-Planning-Framework-Final-Report.pdf',
  'https://www.toronto.ca/legdocs/mmis/2025/ec/bgrd/backgroundfile-260161.pdf',
  'https://www.toronto.ca/legdocs/mmis/2026/te/bgrd/backgroundfile-284297.pdf',
  'https://www.toronto.ca/legdocs/mmis/2021/te/bgrd/backgroundfile-167765.pdf',
  'https://www.toronto.ca/legdocs/mmis/2020/te/bgrd/backgroundfile-141418.pdf',
  'https://www.waterfrontoronto.ca/sites/default/files/documents/port-lands-planning-framework-aoda---reduced.pdf'
 ]
};
// City Council agenda items identify the study wards. Numbers use the current 25-ward system.
// Source items: 2026.PH29.2, 2026.TE34.17, 2022.EY29.2, 2025.EC25.4,
// 2026.TE29.15, 2020.TE16.77, 2020.TE12.30 and 2017.PG24.6.
// Port Lands was Ward 30 before the 2018 ward redistribution; it is now Ward 14.
const FRAMEWORK_WARDS={
 "local": "Wards 5 (York South–Weston), 8 (Eglinton–Lawrence), 9 (Davenport), 12 (Toronto–St. Paul's)",
 "comparators": {
  "Chinatown Tomorrow": "Wards 10 (Spadina–Fort York), 11 (University–Rosedale)",
  "Picture Mount Dennis": "Ward 5 (York South–Weston)",
  "Mount Dennis Community for All Action Plan": "Ward 5 (York South–Weston)",
  "St. Clair Avenue West and Bathurst Street Planning Framework": "Ward 12 (Toronto–St. Paul's)",
  "Bloor Street Planning Framework": "Ward 9 (Davenport)",
  "Yonge-St. Clair Planning Framework": "Ward 12 (Toronto–St. Paul's)",
  "Port Lands Planning Framework": "Ward 14 (Toronto–Danforth; Ward 30 when adopted in 2017)"
 }
};
// Organizational credits from LJOVPF_Comparator_Assessment_Outcomes_Aligned.xlsx,
// Plan staffing summary. Keep unverified/consulted units separate from confirmed support.
const FRAMEWORK_RESPONSIBILITIES={
 "local": {
  "lead": "Development Review — Toronto & East York North, Midtown Section",
  "support": "None confirmed",
 },
 "comparators": {
  "Chinatown Tomorrow": {
   "lead": "Development Review — Toronto & East York South, South Section",
   "support": "Development Review; City Planning",
  },
  "Picture Mount Dennis": {
   "lead": "City Planning — Community Planning, Etobicoke York Central and South Sections",
   "support": "More than 4 divisions, including: Economic Development & Culture; Social Development, Finance & Administration"
  },
  "Mount Dennis Community for All Action Plan": {
   "lead": "Housing Secretariat — Renters Strategy Unit; Social Development — Community Development Unit",
   "support": "4 divisions, including: Development Review; Economic Development & Culture",
  },
  "St. Clair Avenue West and Bathurst Street Planning Framework": {
   "lead": "Development Review — Toronto & East York North, Midtown Section",
   "support": "Transportation Services",
  },
  "Bloor Street Planning Framework": {
   "lead": "City Planning — Community Planning, Toronto & East York District",
   "support": "None confirmed",
  },
  "Yonge-St. Clair Planning Framework": {
   "lead": "City Planning — Community Planning, Toronto & East York District, Midtown section",
     "support": "None confirmed"
  },
  "Port Lands Planning Framework": {
   "lead": "City Planning — Toronto & East York waterfront planning; Waterfront Toronto — Port Lands planning",
   "support": "Transportation Services"
  }
 }
};
function reportLink(label,href){
 return '<a class="framework-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" title="Open the linked source document in a new tab">'+esc(label)+' <span aria-hidden="true">↗</span></a>';
}

let record=null,collection={isOpen:false,checked:false,offlineDraft:false,closesAt:null,mode:'public'},saving=false,navigating=false;
// Step 5 edits are a draft until the participant explicitly applies and saves them.
let priorityDraft=null,priorityEditorExpanded=false;
const PRIORITY_EDITOR_LABELS=['High expected impact','Moderate expected impact','Low Priority'];
function priorityDraftKey(){
 return JSON.stringify([state.ranking,state.outcomeRanking,state.excludedTop,state.promotedTop,state.bottom,state.topicOrder]);
}
function ensurePriorityDraft(calculation){
 const key=priorityDraftKey();
 if(!priorityDraft||priorityDraft.key!==key){
  priorityDraft={key,groups:Object.fromEntries(calculation.topics.map(t=>[t.code,t.groupIndex]))};
 }
 return priorityDraft;
}
function priorityGroupCounts(groups){
 const result=COUNTS.map(()=>0);
 for(const code of CODES){
  const index=groups?.[code];
  if(Number.isInteger(index)&&index>=0&&index<result.length)result[index]++;
 }
 return result;
}
function priorityDraftValid(){
 if(!priorityDraft||Object.keys(priorityDraft.groups).length!==CODES.length)return false;
 return priorityGroupCounts(priorityDraft.groups).every((count,i)=>count===COUNTS[i]);
}
function priorityCountLabel(){
 const counts=priorityGroupCounts(priorityDraft?.groups);
 return counts.map((count,i)=>PRIORITY_EDITOR_LABELS[i]+': '+count+' / '+COUNTS[i]).join(' · ');
}
function updatePriorityDraftControls(){
 const counts=document.getElementById('priority-counts');
 if(counts)counts.textContent=priorityCountLabel();
 const guidance=document.getElementById('priority-guidance');
 if(guidance)guidance.textContent=priorityDraftValid()?
  'Your groups are ready. Apply this ranking to recalculate the assessments.':
  'Choose exactly 6 high, 12 moderate, and 2 low-priority topics before applying.';
 const apply=document.getElementById('apply-priority-ranking');
 if(apply)apply.disabled=!canEdit()||!priorityDraftValid();
}
function applyPriorityDraft(){
 if(!priorityDraftValid())return false;
 const high=CODES.filter(code=>priorityDraft.groups[code]===0);
 const low=CODES.filter(code=>priorityDraft.groups[code]===2);
 // Pinned top selections ensure the requested groups survive the suggestion algorithm,
 // private-link restoration, and server-side canonical scoring unchanged.
 state.promotedTop=high;
 state.excludedTop=[];
 state.bottom=low;
 syncTop();
 state.community=null;
 priorityDraft=null;
 return true;
}

function freshId(){return crypto.randomUUID();}
function networkSignal(ms){
 return typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'?
  AbortSignal.timeout(ms):undefined;
}
function write(){try{localStorage.setItem(STORE+record.responseId,JSON.stringify({record,state:{...state,community:null,loading:false,communityError:'',flash:''}}));localStorage.setItem(STORE+'active',record.responseId);}catch(e){notice('Browser storage is unavailable. Keep a copy of your private return link.','warning');}}
function init(){
 let saved=null;try{const id=localStorage.getItem(STORE+'active');saved=id?JSON.parse(localStorage.getItem(STORE+id)||'null'):null;}catch{}
 if(saved&&saved.record?.sourceVersion===METHOD.id){
  record=saved.record;const d=saved.state||{};
  for(const key of ['step','ranking','outcomeRanking','top','bottom','excludedTop','promotedTop','topicOrder','email','newsletterOptIn','planningOptIn','connections','feedback','scope','communityView','complete']){
   if(Object.prototype.hasOwnProperty.call(d,key))state[key]=d[key];
  }
  if(!Array.isArray(d.excludedTop)&&Array.isArray(d.top)&&d.top.length===COUNTS[0])
   state.excludedTop=CODES.filter(code=>!d.top.includes(code));
 }
 if(!record){
  record={responseId:freshId(),responseToken:freshId().replace(/-/g,'')+freshId().replace(/-/g,''),
   sourceVersion:METHOD.id,revision:0,answerRevision:0,continuedPages:[],visitedPages:[1],
   firstCompletedAt:null,confirmedRevision:0,outbox:[],createdAt:new Date().toISOString(),lastSnapshot:null};
 }
 syncTop();state.step=Math.min(state.step,highUnlockedStep());write();
}
function notice(s,kind='info'){const n=document.getElementById('notice');if(!n)return;n.textContent=s;n.dataset.kind=kind;n.hidden=false;}
function clearNotice(){const n=document.getElementById('notice');if(n)n.hidden=true;}
function validOrder(v,all){return Array.isArray(v)&&v.length===all.length&&new Set(v).size===all.length&&v.every(x=>all.includes(x));}
function canEdit(){return collection.checked&&(collection.isOpen||collection.offlineDraft===true);}
// Step 1 completes both rankings; Step 2 completes all topic choices.
function highUnlockedStep(){
 if(!record)return 0;
 const continued=new Set(Array.isArray(record.continuedPages)?record.continuedPages:[]);
 if(!continued.has(1))return 0;
 if(!continued.has(2)||!record.firstCompletedAt||state.bottom.length!==COUNTS[2])return 1;
 return continued.has(3)?3:2;
}
async function status(){
 try{const r=await fetch('/api/status',{cache:'no-store',signal:networkSignal(8000)});if(!r.ok)throw Error('status');const d=await r.json();
  collection={checked:true,isOpen:d.configured===true&&d.isOpen===true,offlineDraft:false,closesAt:d.closesAt,mode:d.mode||'public'};
 }catch{
  // A temporary outage should not prevent people preparing their answers.
  // The server still enforces survey closure and the validity of every submission.
  collection={...collection,checked:true,isOpen:false,offlineDraft:true};
 }
 const label=document.getElementById('collection-status');
 if(label)label.textContent=collection.offlineDraft?
  'Online status is temporarily unavailable. You may continue answering on this device. Your responses will save online when service returns, if the survey is still open.':
  !collection.isOpen?'Survey closed. Saved responses can still be reviewed.':
  'Voting is open until January 15, 2027 at 11:59 p.m. Toronto time. You may revisit and revise your response.';
 render();
 if(collection.isOpen&&record?.outbox?.length&&!saving)flush();
}
function privateLink(){return location.origin+location.pathname+'#resume='+encodeURIComponent(record.responseId+'.'+record.responseToken);}
function serialize(){return {page:state.step,ranking:state.ranking,outcomeRanking:state.outcomeRanking,top:state.top,bottom:state.bottom,excludedTop:state.excludedTop,promotedTop:state.promotedTop,connections:state.connections,
 feedback:state.feedback,scope:state.scope,topicOrder:preferredTopicOrder(),email:'',newsletterOptIn:false,planningOptIn:false};}
function checkpoint(kind){
 if(!canEdit())throw Error('The survey is closed. No changes can be submitted.');
 const data=snapshot();record.revision++;record.answerRevision++;
 const event={eventId:freshId(),responseId:record.responseId,sourceVersion:METHOD.id,
  revision:record.revision,answerRevision:record.answerRevision,eventType:kind,page:state.step+1,
  clientTimestamp:new Date().toISOString(),afterResultsShown:!!record.firstCompletedAt,
  continuedPages:record.continuedPages.slice(),visitedPages:record.visitedPages.slice(),
  snapshot:data,resumeState:serialize()};
 record.outbox.push(event);record.lastSnapshot=data;write();return event;
}
// Stale response revisions are recoverable. Keep local answers until the server
// acknowledges an authenticated checkpoint; never discard them on a conflict.
function reconcilePending(saved){
 const rev=Number(saved.revision),answer=Number(saved.answerRevision);
 if(!Number.isSafeInteger(rev)||rev<0||!Number.isSafeInteger(answer)||answer<0)
  throw Error('The saved response could not be synchronized safely.');
 if(rev<(record.confirmedRevision||0))throw Error('Online revision is inconsistent. Your answers are unchanged.');
 if(!record.outbox.length)return;
 const last=record.outbox[record.outbox.length-1];
 const pendingCompletion=record.outbox.some(e=>e.eventType==='complete');
 const pages=arr=>Array.isArray(arr)?arr.filter(n=>Number.isInteger(n)&&n>=1&&n<=6):[];
 record.continuedPages=[...new Set([...pages(saved.continuedPages),...pages(record.continuedPages)])];
 record.visitedPages=[...new Set([...pages(saved.visitedPages),...pages(record.visitedPages)])];
 record.firstCompletedAt=record.firstCompletedAt||saved.firstCompletedAt||null;
 record.confirmedRevision=rev;
 record.revision=rev+1;
 record.answerRevision=Math.max(answer,record.answerRevision||0)+1;
 const latest=snapshot();
 const completedNow=latest.inputEvidence?.coreStepsCompleted===true;
 const eventType=pendingCompletion&&completedNow?'complete':last.eventType;
 // A single new checkpoint represents the latest unsent choices; accepted
 // server checkpoints remain in the database history.
 record.outbox=[{...last,eventId:freshId(),eventType,responseId:record.responseId,
  revision:record.revision,answerRevision:record.answerRevision,
  page:state.step+1,clientTimestamp:new Date().toISOString(),
  afterResultsShown:!!record.firstCompletedAt,
  continuedPages:record.continuedPages.slice(),visitedPages:record.visitedPages.slice(),
  snapshot:latest,resumeState:serialize()}];
 record.lastSnapshot=latest;write();
}
async function authenticatedServerRevision(){
 const r=await fetch('/api/resume',{method:'POST',credentials:'same-origin',signal:networkSignal(16000),
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+record.responseToken},
  body:JSON.stringify({responseId:record.responseId,sourceVersion:METHOD.id})});
 if(r.status===403&&(record.confirmedRevision||0)===0){
  // A first checkpoint may not have reached the server at all.
  return {revision:0,answerRevision:0,continuedPages:[],visitedPages:[]};
 }
 if(!r.ok)throw Error('Could not verify the saved version. Your local answers are unchanged.');
 const d=await r.json();
 if(d.sourceVersion!==METHOD.id)throw Error('The online response uses another survey version.');
 return d;
}
async function flush(){
 if(saving)return false;
 if(!record.outbox.length)return true;
 saving=true;let reconciliations=0;
 try{
  while(record.outbox.length){
   const e=record.outbox[0];
   const response=await fetch('/api/checkpoint',{method:'POST',credentials:'same-origin',signal:networkSignal(16000),
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+record.responseToken},body:JSON.stringify(e)});
   if(response.status===423){collection.isOpen=false;collection.offlineDraft=false;throw Error('The survey has closed. Your unsent answers remain on this device.');}
   if(response.status===409){
    if(++reconciliations>2)throw Error('Could not finish synchronizing this response. Please retry.');
    reconcilePending(await authenticatedServerRevision());
    continue;
   }
   if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'Saving failed: '+response.status);}
   const result=await response.json();
   if(result.eventId!==e.eventId||!result.receivedAt)throw Error('The server could not confirm this save.');
   record.confirmedRevision=e.revision;record.outbox.shift();write();
  }
  clearNotice();
  if(reconciliations)notice('Your latest answers were saved online. This tab was synchronized with your saved response.');
  return true;
 }catch(e){
  notice('Your answers are stored on this device but online saving has not been confirmed. Use Retry save when connected. '+e.message,'warning');
  return false;
 }finally{saving=false;renderSaveBadge();}
}
function renderSaveBadge(){
 const el=document.getElementById('save-state');if(!el)return;
el.textContent=record.outbox.length?
 record.outbox.length+' local save'+(record.outbox.length===1?'':'s')+' waiting for online confirmation':
 '';
 if(record.outbox.length&&typeof document.createElement==='function'){
  const button=document.createElement('button');
  button.type='button';button.className='secondary retry-save';
  button.textContent='Retry save';button.disabled=saving;
  button.addEventListener('click',()=>flush());
  el.appendChild(button);
 }
}
async function save(kind){
 try{checkpoint(kind);return await flush();}
 catch(e){notice(e.message,'warning');return false;}
}
async function copyLink(){
 if(record.outbox.length){const ok=await flush();if(!ok)return;}
 if(!record.confirmedRevision){notice('Complete at least one step and save online before copying a private return link.','warning');return;}
 const link=privateLink();
 try{await navigator.clipboard.writeText(link);notice('Private return link copied. Keep it safe: anyone with it can access your response.');}
 catch{window.prompt('Copy your private return link:',link);}
}
async function restore(raw){
 const m=/^([a-f0-9-]{36})\.([A-Za-z0-9_-]{64,128})$/.exec(raw||'');if(!m){notice('This private return link is invalid.','warning');return;}
 try{
  const r=await fetch('/api/resume',{method:'POST',signal:networkSignal(16000),headers:{'Content-Type':'application/json','Authorization':'Bearer '+m[2]},
   body:JSON.stringify({responseId:m[1],sourceVersion:METHOD.id})});
  if(!r.ok)throw Error('The private link was not recognized for this survey version.');
  const d=await r.json(),p=d.resumeState||{};
  // Reopening this same private link must not discard any unsent local answers.
  if(record?.responseId===m[1]&&record?.responseToken===m[2]&&record.outbox?.length){
   reconcilePending(d);
   const synced=await flush();
   render();
   if(synced)notice('Your latest answers were synchronized and saved online.');
   return;
  }
  if(!validOrder(p.ranking,THEMES)||!validOrder(p.outcomeRanking,OUTCOMES))throw Error('Saved rankings are incompatible.');
  const top=p.top||[],bottom=p.bottom||[];
  if(!Array.isArray(top)||!Array.isArray(bottom)||top.some(x=>!CODES.includes(x))||bottom.some(x=>!CODES.includes(x)))throw Error('Invalid saved topic selections.');
  Object.assign(state,{step:Math.max(0,Math.min(3,Number.isInteger(p.page)?p.page:(d.firstCompletedAt?2:0))),
   ranking:p.ranking,outcomeRanking:p.outcomeRanking,top,bottom,excludedTop:Array.isArray(p.excludedTop)?p.excludedTop:(top.length===COUNTS[0]?CODES.filter(code=>!top.includes(code)):[]),promotedTop:Array.isArray(p.promotedTop)?p.promotedTop:[],topicOrder:validOrder(p.topicOrder,CODES)?p.topicOrder:[],connections:p.connections||[],feedback:p.feedback||'',scope:p.scope||'vision',
   email:p.email||'',newsletterOptIn:!!p.newsletterOptIn,planningOptIn:!!p.planningOptIn,complete:!!d.firstCompletedAt,community:null});
  record={responseId:m[1],responseToken:m[2],sourceVersion:METHOD.id,
   revision:d.revision||0,answerRevision:d.answerRevision||0,continuedPages:d.continuedPages||[],
   visitedPages:d.visitedPages||[1],firstCompletedAt:d.firstCompletedAt||null,confirmedRevision:d.revision||0,
   createdAt:d.createdAt,outbox:[],lastSnapshot:null};
  syncTop();state.step=Math.min(state.step,highUnlockedStep());write();notice('Your response has been restored. You may revise it until the survey closes.');render();
 }catch(e){notice(e.message+' Your existing browser response was not changed.','warning');}
}
function selectPage(i){
 if(i<0||i>=STEPS.length)return;
 if(i>highUnlockedStep()){
  notice('Complete each step with Continue before opening the next step.','warning');return;
 }
 if(i===state.step)return;state.step=i;record.visitedPages=[...new Set([...record.visitedPages,i+1])];state.community=null;write();render();
 window.scrollTo({top:0,behavior:'smooth'});
 if(i===3)loadCommunity();
}
function optionRank(items,listKey){
 return '<div class="rank-items">'+state[listKey].map((id,i)=>{
  const title=listKey==='ranking'?id:METHOD.outcomes.find(o=>o.id===id).title;
 const help=listKey==='ranking'?'':METHOD.outcomes.find(o=>o.id===id).desc;
  return '<div class="rank-item" draggable="'+canEdit()+'" data-drag-rank="'+listKey+'" data-index="'+i+'"><span class="drag-handle" aria-hidden="true">⋮⋮</span>'+
  '<div class="rank-number">'+(i+1)+'</div><div><strong>'+esc(title)+'</strong>'+(help?'<p>'+esc(help)+'</p>':'')+'</div><div class="rank-buttons">'+   '<button type="button" data-rank="'+listKey+'" data-index="'+i+'" data-dir="-1" '+(i===0?'disabled':'')+' aria-label="Move '+esc(title)+' up">↑</button>'+
   '<button type="button" data-rank="'+listKey+'" data-index="'+i+'" data-dir="1" '+(i===state[listKey].length-1?'disabled':'')+' aria-label="Move '+esc(title)+' down">↓</button></div></div>';
 }).join('')+'</div>';
}
function connectionForm(){
 const choices=[['resident','I live in the neighbourhood'],['former','I used to live in the neighbourhood'],['business','I own or operate a local business'],
 ['worker','I work/volunteer here'],['visit','I regularly spend time here (school, worship, visiting, etc.)'],
 ['representation','My current councillor is also a councillor of this neighbourhood (Colle, Matlow, Padovani, Bravo)'],['other','Another connection']];
 return '<section class="subpanel"><h3>How are you connected to Little Jamaica / Oakwood Vaughan?</h3><p>Optional. Select any that apply.</p>'+
  '<div class="connections">'+choices.map(([key,label])=>'<label><input type="checkbox" data-connection="'+key+'" '+(state.connections.includes(key)?'checked':'')+'><span>'+esc(label)+'</span></label>').join('')+'</div>'+
  '<label class="field-label" for="participant-email">Your email address (optional)</label>'+
'<input id="participant-email" class="email-input" type="text" autocomplete="off" maxlength="254" value="'+esc(state.email)+'" placeholder="you@example.com">'+
  '<p class="help">Add your email if you would like Community in Public to send you your results and updates on the final results.</p>'+
  '<fieldset class="consent"><legend>Would you like to stay involved? (Select all that apply)</legend>'+
  '<label><input id="newsletter" type="checkbox" '+(state.newsletterOptIn?'checked':'')+'> Community in Public newsletter</label>'+
  '<label><input id="planning-updates" type="checkbox" '+(state.planningOptIn?'checked':'')+'> Other updates about the Little Jamaica planning process</label></fieldset></section>';
}
function topicBrowserResults(){
 const high=new Set(syncTop()),q=(state.topicSearch||'').trim().toLowerCase();
 const eligible=suggestions().filter(code=>!high.has(code));
 const visible=eligible.filter(code=>{
  const t=byCode[code];
  return !q||[t.code,t.title,t.theme,t.summary,t.assesses].some(x=>String(x||'').toLowerCase().includes(q));
 });
 const limitReached=state.promotedTop.length>=COUNTS[0];
 return '<p class="help" role="status">'+visible.length+' of '+eligible.length+' topics outside your current top six'+
  (q?' match your search.':'.')+'</p>'+
  (limitReached?'<p class="help">Remove an earlier addition if you want to add a different topic.</p>':'')+
  (visible.map(code=>{
   const t=byCode[code];
   return '<article class="topic-browser-row"><div class="topic-browser-body"><span class="topic-id">'+esc(code)+'</span> <small>'+esc(t.theme)+'</small>'+
    '<strong>'+esc(t.title)+'</strong><p>'+esc(t.summary||t.assesses)+'</p>'+
    '</div>'+
    '<button type="button" class="topic-add" data-add-top="'+esc(code)+'" '+(!canEdit()||limitReached?'disabled':'')+
    '>Add to top 6 ↑</button></article>';
  }).join('')||'<p class="help">No other topics match this search.</p>');
}
function topicBrowser(){
 const chosen=state.promotedTop.filter(code=>state.top.includes(code));
 return '<section class="subpanel topic-browser" id="browse-topics"><h3>Explore all other planning topics</h3>'+
  '<p>Search or browse topics outside your current top six. You can add any topic that matters more to you. Each addition moves the lower-ranked unselected suggestion into the moderate.</p>'+
  '<p class="weight-note">Your high group always contains six topics.</p>'+
  (chosen.length?'<div class="topic-browser-pins"><strong>Topics you added directly</strong>'+
   chosen.map(code=>'<button type="button" data-unpin-top="'+esc(code)+'" '+(!canEdit()?'disabled':'')+'>'+esc(code)+' · '+esc(byCode[code].title)+' × Remove</button>').join('')+'</div>':'')+
  '<label class="field-label" for="topic-search">Search by keyword, title, code or Planning Area</label>'+
  '<input id="topic-search" class="search" type="search" autocomplete="off" value="'+esc(state.topicSearch||'')+'" placeholder="e.g. tenant, displacement, cultural space, housing">'+
  '<div id="topic-browser-results" class="topic-browser-results">'+topicBrowserResults()+'</div></section>';
}
// The visible three groups always contain all twenty survey topics. Unlike
// calculate(), this list shows only *explicitly* selected lower topics.
function selectionGroups(){
 const top=orderByPreference(syncTop());
 const bottom=orderByPreference(state.bottom.filter(code=>byCode[code]&&!top.includes(code)));
 const chosen=new Set([...top,...bottom]);
 const moderate=orderByPreference(CODES.filter(code=>!chosen.has(code)));
 return [top,moderate,bottom];
}
// Reassign groups using explicit topic membership; no point changes from order.
// If a full group receives another topic, its last member returns to moderate.
function moveTopicGroup(code,destination,replacedCode=null){
 if(!canEdit()||!byCode[code]||!Number.isInteger(destination)||destination<0||destination>2)return false;
 const groups=selectionGroups();
 const source=groups.findIndex(group=>group.includes(code));
 if(source<0)return false;
 if(source===destination)return true;
 const targetGroup=groups[destination];
 const target=replacedCode&&targetGroup.includes(replacedCode)?replacedCode:null;
 groups[source]=groups[source].filter(c=>c!==code);
 let displaced=null;
 if(target){
  const pos=groups[destination].indexOf(target);
  groups[destination].splice(pos,1,code);
  groups[source].push(target);
  displaced=target;
 }else{
  if(destination===0&&groups[0].length>=COUNTS[0]){
   displaced=groups[0].pop();
   groups[1].push(displaced);
  }else if(destination===2&&groups[2].length>=COUNTS[2]){
   displaced=groups[2].pop();
   groups[1].push(displaced);
  }
  groups[destination].push(code);
 }
 // When a high-priority topic is moved out without a direct swap, promote
 // the next high-ranked eligible moderate topic, never the topic just moved.
 if(groups[0].length<COUNTS[0]){
  const replacement=suggestions().find(c=>groups[1].includes(c)&&c!==code);
  if(!replacement)return false;
  groups[1]=groups[1].filter(c=>c!==replacement);
  groups[0].push(replacement);
  if(!displaced)displaced=replacement;
 }
 if(groups[0].length!==COUNTS[0]||groups[2].length>COUNTS[2]||new Set(groups.flat()).size!==CODES.length)
  throw Error('Topic groups are inconsistent after moving '+code);
 state.promotedTop=groups[0].slice();
 state.excludedTop=[];
 state.bottom=groups[2].slice();
 state.topicOrder=groups.flat();
 syncTop();state.community=null;priorityDraft=null;write();render();
 notice(escTextMove(code,destination,displaced));
 return true;
}
function escTextMove(code,group,other){
 const name=['high','moderate','lower'][group];
 return byCode[code].title+' moved to '+name+' expected-impact group.'+
  (other&&other!==code?' Another topic was repositioned to keep the Expected impact groups balanced.':'');
}
// Dragging inside one group changes presentation order, not its weight.
// A same-group drop on the group background places the topic at the end.
function reorderTopic(code,targetCode=null,after=false){
 const groups=selectionGroups(),group=groups.find(g=>g.includes(code));
 if(!group)return false;
 const to=targetCode?group.indexOf(targetCode):-1;
 if(targetCode&&to<0)return false;
 const old=group.indexOf(code);
 if(targetCode===code)return false;
 group.splice(old,1);
 if(targetCode)group.splice(group.indexOf(targetCode)+(after?1:0),0,code);
 else group.push(code);
 state.topicOrder=groups.flat();
 state.community=null;priorityDraft=null;write();render();
 notice('Updated the topic display order. Its Expected impact group and weight are unchanged.');
 return true;
}
function topicTile(t,group,index){
 const names=['high','moderate','lower'],moves=[0,1,2].filter(g=>g!==group);
 const pending=state.bottom.length<COUNTS[2];
 const weightText=group===0?'10.00% weight':group===2?'1.50% weight':pending?'3.08% if retained in moderate':'3.08% weight';
 const buttons=moves.map(g=>'<button type="button" class="pick" data-topic-move="'+g+'" data-code="'+esc(t.code)+'" '+(!canEdit()?'disabled':'')+'>'+
   'Move to '+names[g]+' priority</button>').join('');
 const search=[t.code,t.title,t.theme,t.summary,t.assesses].join(' ').toLowerCase();
 return '<article class="topic-tile priority-topic" draggable="'+canEdit()+'" data-topic-drag="'+esc(t.code)+'" data-topic-drop="'+esc(t.code)+'" data-topic-group="'+group+'" data-topic-search="'+esc(search)+'" aria-label="'+esc(t.title)+', '+names[group]+' priority. Drag to reorder or change groups.">'+
  '<div class="topic-title"><span class="drag-handle" aria-hidden="true">⋮⋮</span><span class="topic-id">'+esc(t.code)+'</span><span class="topic-subject">'+esc(t.theme)+'</span></div>'+
'<span class="topic-proposed">Order within an impact group does not change assessment weight</span>'+
  '<h3>'+esc(t.title)+'</h3><p>'+esc(t.summary||t.assesses)+'</p>'+
 '<div class="topic-actions">'+buttons+'</div></article>';
}
function selectionPage(){
 const groups=selectionGroups(),labels=['High expected impact','Moderate expected impact','Lower expected impact'];
 return '<section class="selection-intro"><h3>Place 20 topics into three Impact Groups</h3>'+
  '<p>Your rankings of the six Planning Areas and six Community Outcomes were used to suggest six topics that you may believe would have the greatest positive impact on community wellbeing. Review the 20 topics below and move them between the three Impact Groups based on the improvements you believe the Planning Framework could help achieve. Select <strong>six high-impact topics, twelve moderate-impact topics, and two lower-impact topics.</strong>. A lower-impact ranking does not mean a topic is unimportant or that the City can disregard its obligations.</p>'+
  '<p><strong>Drag cards</strong> to move them between groups, or drag within a group to arrange them in your preferred order. <strong>Order within a group does not affect points</strong>—only the group matters.</p>'+
  '<div class="selection-counter"><strong>'+groups[0].length+' / 6</strong> high impact · <strong>'+groups[2].length+' / 2</strong> lower impact selected</div>'+
 
(groups[2].length!==COUNTS[2]?'<p class="help">Choose '+(COUNTS[2]-groups[2].length)+' more lower-priority topic'+(COUNTS[2]-groups[2].length===1?'':'s')+' before continuing.</p>':'')+
'<p class="help">Each topic in the high expected impact group receives 10% of the evaluation weight, moderate-impact topics receive approximately 3.1%, and lower-impact topics receive 1.5%. These percentages determine how much each topic contributes to the comparison scores, not the magnitude of its actual impact on community wellbeing.</p>'+
  '</section>'+
   '<div class="topic-priority-board">'+groups.map((codes,i)=>
   '<section class="priority-lane priority-lane-'+i+'" data-topic-zone="'+i+'" aria-label="'+labels[i]+'">'+
    '<div class="priority-lane-header"><div><h3>'+labels[i]+' <span class="lane-count">'+codes.length+(i===1&&groups[2].length!==2?' shown':'')+'</span></h3>'+
'</div></div>'+
    '<div class="topic-grid">'+codes.map((code,j)=>topicTile(byCode[code],i,j)).join('')+
      (!codes.length?'<p class="drop-prompt">Drag a topic here or use a Move to Lower expected impact button.</p>':'')+
    '</div></section>').join('')+'</div>';
}
function relativeScore(v,places=2){
 const tiny=Math.pow(10,-places)/2;
 if(!Number.isFinite(v)||Math.abs(v)<tiny)return (0).toFixed(places);
 return (v>0?'+':'')+fmt(v,places);
}
function groupDifference(c,codes,planIdx,scope,outcomeId){
 if(planIdx===-1)return 0;
 // Outcome breakdowns must use criterion-specific ratings, not topic-average
 // ratings times fractions: one public topic can cover multiple outcomes.
 if(outcomeId)return sum(c.criteria.filter(t=>codes.includes(t.surveyTopicId)&&t.outcomeFlags[outcomeId]===1)
  .map(t=>t.weight*((scope==='full'?t.comparatorFull:t.comparatorVision)[planIdx]-t.score)));
 return sum(codes.map(code=>{
  const t=c.byCode[code],rating=(scope==='full'?t.comparatorFull:t.comparatorVision)[planIdx];
  return t.weight*(rating-t.score);
 }));
}
function resultFrameworks(c,scope){
 // Dates printed on the source documents (not subsequent Council adoption dates).
 const publicationDates=['June 2026','December 2021','November 2025','February 2026','May 2021','December 2019','September 2017'];
 return [{name:'Little Jamaica / Oakwood Vaughan (draft)',relative:0,local:true,idx:-1,url:FRAMEWORK_REPORTS.local,
  publication:'Development Review staff project report to be finalized Q1 2027',wardLabel:FRAMEWORK_WARDS.local,...FRAMEWORK_RESPONSIBILITIES.local}]
  .concat(c.comparators.map((p,i)=>({
   name:p.name,relative:p[scope]-c.baseline,local:false,idx:i,url:FRAMEWORK_REPORTS.comparators[i],
   publication:publicationDates[i],wardLabel:FRAMEWORK_WARDS.comparators[p.name],...FRAMEWORK_RESPONSIBILITIES.comparators[p.name]
  }))).sort((a,b)=>b.relative-a.relative||a.name.localeCompare(b.name));
}
function breakdownMatrix(c,scope,title,groups,ordered){
 const header=ordered.map(p=>'<th scope="col" title="'+esc(p.name)+'">'+
  reportLink(p.local?'Little Jamaica (0)':'Plan '+(p.idx+1),p.url)+'</th>').join('');
 const rows=groups.map(group=>{
  const share=(group.outcomeId?
   sum(c.criteria.filter(t=>t.outcomeFlags[group.outcomeId]===1).map(t=>t.weight)):
   sum(group.codes.map(code=>c.byCode[code].weight)))*100;
  const scores=ordered.map(p=>{
   const value=groupDifference(c,group.codes,p.idx,scope,group.outcomeId);
   return '<td class="matrix-delta '+(value<0?'delta-negative':value>0?'delta-positive':'')+' '+(p.local?'reference-cell':'')+'">'+relativeScore(value,3)+'</td>';
  }).join('');
  return '<tr><th scope="row">'+esc(group.name)+' <small>'+group.codes.length+' topics</small></th>'+
   '<td class="matrix-weight">'+fmt(share,1)+'%</td>'+scores+'</tr>';
 }).join('');
 return '<section class="breakdown-section"><h4>'+esc(title)+'</h4><p class="help">Scroll horizontally to compare each framework. The report titles above are links.</p>'+
  '<div class="table-scroll breakdown-scroll" role="region" tabindex="0" aria-label="Relative planning scores by '+esc(title)+'">'+
   '<table class="breakdown-table"><thead><tr><th scope="col">'+esc(title)+'</th><th scope="col">Your weight</th>'+header+
   '</tr></thead><tbody>'+rows+'</tbody></table></div></section>';
}
function resultsPage(){
 const c=calculate(),full=state.scope==='full',scope=full?'full':'vision';
 const ordered=resultFrameworks(c,scope);
 const maxDifference=Math.max(0.01,...ordered.map(p=>Math.abs(p.relative)));
 const scores=ordered.map((p,i)=>{
  const width=Math.min(49,Math.abs(p.relative)/maxDifference*49),left=p.relative<0?50-width:50;
  return '<div class="score-row relative-score-row '+(p.local?'home-score':'')+'"><span class="score-rank">'+(i+1)+'</span>'+
   '<span class="score-name">'+reportLink(p.local?p.name:'Plan '+(p.idx+1)+' · '+p.name,p.url)+
'<small>'+(p.local?'('+esc(p.publication)+')':'Published: '+esc(p.publication))+' · '+esc(p.wardLabel)+'</small>'+
'</span>'+
   '<strong class="'+(p.relative<0?'delta-negative':p.relative>0?'delta-positive':'')+'">'+relativeScore(p.relative)+'</strong>'+
   '<div class="relative-track" aria-hidden="true"><span class="zero-axis"></span>'+
   (p.local?'':'<i class="'+(p.relative<0?'negative-bar':'positive-bar')+'" style="left:'+left+'%;width:'+width+'%"></i>')+'</div>'+ 
   '<small class="score-lead">Lead division/team: '+esc(p.lead)+'</small>'+
   '<small class="score-support">Supporting divisions: '+esc(p.support)+'</small>'+
   (p.pending?'<small class="score-pending">Other attributions / roles to verify: '+esc(p.pending)+'</small>':'')+'</div>';
 }).join('');
 const subjectGroups=state.ranking.map(name=>({name,codes:c.topics.filter(t=>t.theme===name).map(t=>t.code)}));
 const outcomeGroups=state.outcomeRanking.map(id=>{
  const o=METHOD.outcomes.find(x=>x.id===id);
  return {name:o.title,codes:outcomeCodes[id],outcomeId:id};
 });
 const draft=ensurePriorityDraft(c);

const topics=PRIORITY_EDITOR_LABELS.map((label,group)=>{
  const rows=c.topics
    .filter(t=>draft.groups[t.code]===group)
    .sort((a,b)=>a.position-b.position)
    .map(t=>
      '<tr class="priority-draggable-row" draggable="'+canEdit()+'" data-priority-drag="'+esc(t.code)+'">'+
      '<td><span class="drag-handle" aria-hidden="true">⋮⋮</span> '+esc(t.code)+'</td>'+
      '<td>'+esc(t.title)+'</td>'+
      '<td>'+esc(t.theme)+'</td>'+
      '<td><select data-priority-code="'+esc(t.code)+'" aria-label="Choose Expected impact group for '+esc(t.title)+'" '+(!canEdit()?'disabled':'')+'>'+
      PRIORITY_EDITOR_LABELS.map((name,i)=>
        '<option value="'+i+'" '+(draft.groups[t.code]===i?'selected':'')+'>'+esc(name)+'</option>'
      ).join('')+
      '</select></td></tr>'
    ).join('');

  const count=priorityGroupCounts(draft.groups)[group];

return '<section class="priority-drop-zone" data-priority-zone="'+group+'" aria-label="'+esc(label)+' drop zone">'+    '<h4>'+esc(label)+' <small>'+count+' / '+COUNTS[group]+'</small></h4>'+
    '<div class="table-scroll"><table class="priority-table">'+
    '<thead><tr><th>Code</th><th>Topic</th><th>Planning Area</th><th>Expected impact group</th></tr></thead>'+
    '<tbody>'+rows+'</tbody></table></div>'+
    '</section>';
}).join('');
 return '<section class="results-intro"><h3>Planning Frameworks evaluated against your expected-impact rankings</h3>'+
  '<p>All scores are <strong>weighted differences from the draft Vision statement prepared by the City of Toronto Development Review, midtown section, team</strong>. A positive number means the plan scores higher when compared to the draft vision summary, while a negative score means the plan scores lower than the draft vision summary. They are not raw document rating. </p>  <p> As the City publishes/shares more of the draft framework, it will be added to the tool so the assessment is more comprehensive. Until the Citys full and proposed final Little Jamaica Planning Framework is shared, this is an early indicator of if materials being published by the City are meeting community expectations and/or are comparable to the level of service delivered to other neighbourhoods.</p>'+
  '<div class="scope" role="group" aria-label="Scope of the comparator evaluation"><button data-scope="vision" aria-pressed="'+(!full)+'">Vision statements</button><button data-scope="full" aria-pressed="'+full+'">Full planning documents</button></div>'+
  '<p class="help">Click any framework name to open its linked source document in a new tab. The Little Jamaica link opens the working draft Community Visioning Statement, not a finalized Planning Framework. The Port Lands Planning Framework is jointly published by the City and Waterfront Toronto.</p></section>'+
  '<div class="scores">'+scores+'</div>'+
  '<section class="breakdowns"><h3>Compare by Planning Area and community outcome</h3>'+
  '<p>The values below show each Planning Area or outcome’s contribution to the framework’s difference from Little Jamaica.</p>'+
  breakdownMatrix(c,scope,'Planning Areas',subjectGroups,ordered)+
  breakdownMatrix(c,scope,'Community outcome',outcomeGroups,ordered)+
   '<details class="full-breakdown priority-editor" id="priority-editor" '+(priorityEditorExpanded?'open':'')+'><summary>Review and adjust your Impact Groups</summary>'+
'<p class="help">Place six topics in the High Expected Impact group, twelve in Moderate Expected Impact, and two in Lower Expected Impact. The assessment weights are 10%, approximately 3.1%, and 1.5% per topic, respectively. All 33 detailed evaluation criteria remain included. Your comparison scores will update when you apply your selections.</p>'+   '<p id="priority-counts" class="priority-counts" role="status" aria-live="polite">'+esc(priorityCountLabel())+'</p>'+
  '<p class="help">Drag (or use the arrows to place) each topic into the group that reflects the impact you believe it could have on community wellbeing. Choose exactly 6 high, 12 moderate, and 2 low-priority topics before applying.</p>'+
'<div class="priority-drop-board">'+topics+'</div>'+
  '<p id="priority-guidance" class="help" aria-live="polite">'+(priorityDraftValid()?'Your Impact Groups are complete. Apply your selections to update the evaluation.':'Choose exactly 6 high, 12 moderate, and 2 low-priority topics before applying.')+'</p>'+
   '<button type="button" class="primary" id="apply-priority-ranking" '+(!canEdit()||!priorityDraftValid()?'disabled':'')+'>I prefer this ranking. Update the assessments based on this ranking</button></details></section>'+
  '<section class="subpanel" id="comment-box"><h3>Additional comments (optional)</h3><p>Is there anything suggestion consideration or feedback you have re: a community review of the Planning Framework currently being prepared by Development Review for the community of Little Jamaica?</p>'+
   '<label class="sr-only" for="comment">Comments</label><textarea id="comment" maxlength="1500" rows="4">'+esc(state.feedback)+'</textarea>'+
   '<button class="secondary" id="save-comment" type="button">Submit my comments</button>';
}
function communityPage(){
 const c=calculate(),d=state.community,ready=d&&d.available===true;
 const ownTopics=Object.fromEntries(c.topics.map(t=>[t.code,t.weight]));
 const ownSubjects=Object.fromEntries(WB.themes.map(t=>[t.name,sum(c.topics.filter(x=>x.theme===t.name).map(x=>x.weight))]));
 const ownOutcomes=Object.fromEntries(OUTCOMES.map(id=>[id,sum(outcomeCodes[id].map(code=>(ownTopics[code]||0)*(c.byCode[code].outcomeFlags[id]||0)))]));
 // Older browser drafts may use 'subjects' here; database/API values remain 'themes'.
  const view=state.communityView==='subjects'?'themes':state.communityView;
 let list=view==='topics'?c.topics.map(t=>({name:t.code+' · '+t.title,id:t.code,you:t.weight,mean:d?.topicWeights?.[t.code]})):
  view==='themes'?WB.themes.map(t=>({name:t.name,id:t.name,you:ownSubjects[t.name],mean:d?.themeWeights?.[t.name]})):
  METHOD.outcomes.map(o=>({name:o.title,id:o.id,you:ownOutcomes[o.id],mean:d?.outcomeWeights?.[o.id]}));
 list.sort((a,b)=>b.you-a.you||a.name.localeCompare(b.name));
 const rows=list.map(x=>'<div class="compare-item"><strong>'+esc(x.name)+'</strong><div class="compare-bars"><div>Your assessment weight <span>'+fmt(x.you*100,1)+'%</span><i style="width:'+Math.min(x.you*100*12,100)+'%"></i></div>'+
  '<div>Community average weight <span>'+(ready&&x.mean!=null?fmt(x.mean*100,1)+'%':'—')+'</span><i class="average" style="width:'+(ready&&x.mean!=null?Math.min(x.mean*100*12,100):0)+'%"></i></div></div></div>').join('');
 const n=d?.count||0;
 const info=state.loading?'Loading community comparisons...':
  state.communityError?state.communityError:
  !ready?'The community average will appear after the first completed response has been saved.':
  'Based on '+n+' completed response'+(n===1?'':'s')+'. '+(n===1?'The first average reflects one person’s choices.':n<5?'These early averages may change substantially as more people participate.':'Each response is counted once using its latest saved Impact Group selections.');
 return '<section class="results-intro"><h3>Your expected-impact rankings and the community</h3><p>Compare the evaluation weights generated by your expected-impact rankings with the averages across completed community responses. The first response makes an average available.</p>'+
 '<p class="community-status" role="status">'+esc(info)+'</p>'+
 '<div class="scope"><button data-community-view="topics" aria-pressed="'+(view==='topics')+'">20 survey topics</button><button data-community-view="themes" aria-pressed="'+(view==='themes')+'">6 planning areas</button><button data-community-view="outcomes" aria-pressed="'+(view==='outcomes')+'">6 outcomes</button></div>'+
 '<button class="secondary" id="refresh-averages" type="button">Refresh community averages</button></section>'+
 '<div class="compare-list">'+rows+'</div>'+
 '<p class="help">Each survey topic contains one or more detailed criteria, which may contribute to different outcomes. Topic, Planning Area and community outcome weights each total 100%. Human rights and Indigenous rights obligations apply regardless of how topics are ranked.</p>';
}
function render(){
 const step=Math.min(STEPS.length-1,Math.max(0,state.step));state.step=step;
 document.getElementById('steps').innerHTML=STEPS.map((title,i)=>
  '<button type="button" data-step="'+i+'" class="'+(i===step?'current':'')+'" '+(i>highUnlockedStep()?'disabled':'')+'>'+
   '<span>Step '+(i+1)+'</span>'+esc(title)+'</button>').join('');
 document.getElementById('step-label').textContent='Step '+(step+1)+' of '+STEPS.length;
 document.getElementById('step-title').textContent=STEPS[step];
 const stepDetail=document.getElementById('step-detail');
 stepDetail.textContent=step===3?'Compare how you and other respondents weighted topics based on their expected contribution to community wellbeing.':'';
 stepDetail.hidden=!stepDetail.textContent;
 const root=document.getElementById('stage');
 const planningRanking='<section class="subpanel">'+
   '<p class="help">The starting order is based on community responses in our <a href="https://communityinpublic.ca/ljcdap#9f47bb79-1716-4a7c-a255-79033acc62b3" target="_blank" rel="noopener noreferrer">2026 Little Jamaica ACTIONS & PROGRESS INDICATORS survey findings report</a>.</p>'+
   '<h3>1. Rank Planning Areas by expected impact</h3>'+
   '<p>Which Planning Areas, if effectively addressed by the City, do you believe would produce the greatest improvements in community wellbeing? Rank from greatest to least expected impact. Drag to reorder or use the arrow buttons.</p>'+
   optionRank(THEMES,'ranking')+'</section>';
 const outcomeRanking='<section class="subpanel"><h3>2. Rank community outcomes by expected impact</h3>'+
  '<p>Rank the improvements you believe would contribute most to overall community wellbeing.</p>'+
  '<p class="help">The starting order is based on community responses in our <a href="https://example.com">2026 Little Jamaica ACTIONS & PROGRESS INDICATORS survey findings report</a>.</p>'+
  optionRank(OUTCOMES,'outcomeRanking')+'</section>';
 root.innerHTML=step===0?connectionForm()+planningRanking+outcomeRanking:
  step===1?selectionPage():step===2?resultsPage():communityPage();
 const actions=document.getElementById('actions');
 const label=step===1?'See my impact-weighted comparison':step===2?'Compare with community':'Continue';
 actions.innerHTML=(step===0?'':'<button type="button" id="back" class="secondary">← Back</button>')+
  (step===3?'':'<button type="button" id="next" class="primary" '+(!canEdit()&&step<=1?'disabled':'')+'>'+label+' →</button>');
 document.getElementById('next')?.addEventListener('click',next);
 document.getElementById('back')?.addEventListener('click',()=>selectPage(step===3?2:step-1));
 document.querySelectorAll('[data-step]').forEach(el=>el.addEventListener('click',()=>selectPage(+el.dataset.step)));
 document.querySelectorAll('[data-rank]').forEach(el=>el.addEventListener('click',()=>{
  if(!canEdit())return;const list=state[el.dataset.rank],i=+el.dataset.index,j=i+(+el.dataset.dir);
  if(j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];syncTop();state.community=null;write();render();
 }));
 document.querySelectorAll('[data-connection]').forEach(el=>el.addEventListener('change',()=>{
  state.connections=el.checked?[...new Set([...state.connections,el.dataset.connection])]:state.connections.filter(x=>x!==el.dataset.connection);write();
 }));
 const email=document.getElementById('participant-email');if(email)email.addEventListener('input',()=>{
  state.email=email.value.trim();if(!state.email){state.newsletterOptIn=false;state.planningOptIn=false;}
  for(const id of ['newsletter','planning-updates']){const box=document.getElementById(id);if(box){box.disabled=!state.email;if(!state.email)box.checked=false;}}
  write();
 });
 for(const [id,key] of [['newsletter','newsletterOptIn'],['planning-updates','planningOptIn']]){
  const el=document.getElementById(id);if(el){el.disabled=!state.email;el.addEventListener('change',()=>{state[key]=el.checked;write();});}
 }
 let dragging=null;
 document.querySelectorAll('[data-drag-rank]').forEach(item=>{
  item.addEventListener('dragstart',e=>{
   if(!canEdit())return e.preventDefault();
   dragging={key:item.dataset.dragRank,index:+item.dataset.index};
   e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragging.key+':'+dragging.index);
   item.classList.add('is-dragging');
  });
  item.addEventListener('dragover',e=>{if(dragging&&dragging.key===item.dataset.dragRank){e.preventDefault();item.classList.add('drag-over');}});
  item.addEventListener('dragleave',()=>item.classList.remove('drag-over'));
  item.addEventListener('drop',e=>{
   e.preventDefault();item.classList.remove('drag-over');
   if(!canEdit()||!dragging||dragging.key!==item.dataset.dragRank)return;
   const list=state[dragging.key],to=+item.dataset.index;
   if(dragging.index!==to){
    const [moved]=list.splice(dragging.index,1);list.splice(to,0,moved);
    syncTop();state.community=null;write();render();
   }
   dragging=null;
  });
  item.addEventListener('dragend',()=>{dragging=null;item.classList.remove('is-dragging');document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));});
 });
 // Search filters rendered cards without changing priority selections.
 const search=document.getElementById('topic-search');
 function filterTopicCards(){
  const query=(state.topicSearch||'').trim().toLowerCase();
  document.querySelectorAll('[data-topic-drag]').forEach(card=>{
   card.hidden=!!query&&!String(card.dataset.topicSearch||'').includes(query);
  });
 }
 if(search){search.addEventListener('input',()=>{state.topicSearch=search.value;filterTopicCards();});filterTopicCards();}
 document.querySelectorAll('[data-topic-move]').forEach(button=>button.addEventListener('click',()=>{
  moveTopicGroup(button.dataset.code,Number(button.dataset.topicMove));
 }));
 document.querySelectorAll('[data-topic-order]').forEach(button=>button.addEventListener('click',()=>{
  if(!canEdit())return;
  const groups=selectionGroups(),code=button.dataset.code,group=groups.find(g=>g.includes(code));
  if(!group)return;
  const dir=Number(button.dataset.topicOrder),idx=group.indexOf(code),other=group[idx+dir];
  if(other)reorderTopic(code,other,dir>0);
 }));
 let draggingTopic=null;
 const clearTopicTargets=()=>document.querySelectorAll('.topic-drop-target').forEach(el=>el.classList.remove('topic-drop-target'));
 document.querySelectorAll('[data-topic-drag]').forEach(card=>{
  card.addEventListener('dragstart',event=>{
   if(!canEdit()){event.preventDefault();return;}
   draggingTopic=card.dataset.topicDrag;
   event.dataTransfer?.setData('text/plain',draggingTopic);
   if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
   card.classList.add('is-dragging');
  });
  card.addEventListener('dragend',()=>{draggingTopic=null;clearTopicTargets();});
  card.addEventListener('dragover',event=>{
   if(!canEdit()||!draggingTopic)return;
   event.preventDefault();event.stopPropagation();
   clearTopicTargets();card.classList.add('topic-drop-target');
  });
  card.addEventListener('dragleave',()=>card.classList.remove('topic-drop-target'));
  card.addEventListener('drop',event=>{
   event.preventDefault();event.stopPropagation();
   const code=draggingTopic,onto=card.dataset.topicDrop,destination=Number(card.dataset.topicGroup);
   draggingTopic=null;clearTopicTargets();
   if(!canEdit()||!byCode[code]||code===onto)return;
   const origin=selectionGroups().findIndex(g=>g.includes(code));
   if(origin===destination){
    const bounds=card.getBoundingClientRect?.();
    reorderTopic(code,onto,!!bounds&&event.clientY>bounds.top+bounds.height/2);
   }else moveTopicGroup(code,destination,onto);
  });
 });
 document.querySelectorAll('[data-topic-zone]').forEach(zone=>{
  zone.addEventListener('dragover',event=>{
   if(!canEdit()||!draggingTopic)return;
   event.preventDefault();zone.classList.add('topic-zone-target');
  });
  zone.addEventListener('dragleave',()=>zone.classList.remove('topic-zone-target'));
  zone.addEventListener('drop',event=>{
   event.preventDefault();
   zone.classList.remove('topic-zone-target');
   const code=draggingTopic,destination=Number(zone.dataset.topicZone);
   draggingTopic=null;clearTopicTargets();
   if(!canEdit()||!byCode[code])return;
   if(selectionGroups()[destination].includes(code))reorderTopic(code);
   else moveTopicGroup(code,destination);
  });
 });
 document.querySelectorAll('[data-scope]').forEach(el=>el.addEventListener('click',()=>{state.scope=el.dataset.scope;write();render();}));
 document.querySelectorAll('[data-community-view]').forEach(el=>el.addEventListener('click',()=>{state.communityView=el.dataset.communityView;render();}));
 
  // Page 3: drag topics between Expected impact groups.
  let draggingPriority=null;

  const clearPriorityTargets=()=>{
    document.querySelectorAll('[data-priority-zone]').forEach(zone=>{
      zone.classList.remove('is-drop-target');
    });
  };

  document.querySelectorAll('[data-priority-drag]').forEach(row=>{
    row.addEventListener('dragstart',event=>{
      if(!canEdit()||!priorityDraft){
        event.preventDefault();
        return;
      }

      draggingPriority=row.dataset.priorityDrag;

      if(event.dataTransfer){
        event.dataTransfer.effectAllowed='move';
        event.dataTransfer.setData('text/plain',draggingPriority);
      }

      row.classList.add('is-dragging');
    });

    row.addEventListener('dragend',()=>{
      draggingPriority=null;
      row.classList.remove('is-dragging');
      clearPriorityTargets();
    });
  });

  document.querySelectorAll('[data-priority-zone]').forEach(zone=>{
    zone.addEventListener('dragover',event=>{
      if(!canEdit()||!draggingPriority)return;

      event.preventDefault();
      clearPriorityTargets();
      zone.classList.add('is-drop-target');
    });

    zone.addEventListener('drop',event=>{
      event.preventDefault();
      event.stopPropagation();

      const code=draggingPriority;
      const group=Number(zone.dataset.priorityZone);

      draggingPriority=null;
      clearPriorityTargets();

      if(!canEdit()||!priorityDraft||!CODES.includes(code))return;
      if(!Number.isInteger(group)||group<0||group>=COUNTS.length)return;

      if(priorityDraft.groups[code]!==group){
        priorityDraft.groups[code]=group;
        priorityEditorExpanded=true;
        render();
      }
    });
  });

 // Reassigning a topic changes only the draft until Apply is pressed.
 const priorityDetails=document.getElementById('priority-editor');
 if(priorityDetails)priorityDetails.addEventListener('toggle',()=>{priorityEditorExpanded=priorityDetails.open;});

document.querySelectorAll('[data-priority-code]').forEach(el=>el.addEventListener('change',()=>{
  if(!canEdit()||!priorityDraft)return;

  const group=Number(el.value);
  const code=el.dataset.priorityCode;

  if(!CODES.includes(code)||!Number.isInteger(group)||group<0||group>=COUNTS.length)return;

  priorityDraft.groups[code]=group;
  priorityEditorExpanded=true;
  render();
}));

 document.getElementById('apply-priority-ranking')?.addEventListener('click',async()=>{
  if(!canEdit()||!priorityDraftValid()){
   notice('Choose exactly 6 high, 12 moderate, and 2 low-priority topics before applying.','warning');return;
  }
  applyPriorityDraft();
  priorityEditorExpanded=true;
  write();render();
  const saved=await save('revision');
  if(saved)notice('Your Impact Group selections have been applied and your comparison scores recalculated.');
  // If offline, flush() leaves the revision queued locally and shows the Retry save option.
 });
 document.getElementById('refresh-averages')?.addEventListener('click',()=>loadCommunity(true));
 const comment=document.getElementById('comment');if(comment)comment.addEventListener('input',()=>{state.feedback=comment.value;write();});
 document.getElementById('save-comment')?.addEventListener('click',async()=>{state.feedback=document.getElementById('comment').value;const ok=await save('comments_shared');if(ok)notice('Your comments and Impact Group selections were submitted.');});
 document.getElementById('private-link')?.addEventListener('click',copyLink);
 document.getElementById('download-my-response')?.addEventListener('click',downloadCsv);
 document.querySelectorAll('[data-rank],[data-topic-move],[data-topic-order],[data-connection],#participant-email,#newsletter,#planning-updates,#comment,#save-comment').forEach(el=>{if(!canEdit())el.disabled=true;});
 renderSaveBadge();
}
async function next(){
 if(navigating)return;
 navigating=true;
 try{
  // A previously completed participant can still view their community
  // comparison after collection closes.
  if(state.step===2&&highUnlockedStep()===3){selectPage(3);return;}
  if(!canEdit())return;
  if(state.step===0){
  const email=document.getElementById('participant-email')?.value.trim()||'';
state.email=email;  }
  if(state.step===1){
   if(syncTop().length!==COUNTS[0]){
    notice('Six topics must be assigned to the High Expected Impact group.','warning');return;
   }
   if(state.bottom.length!==COUNTS[2]){
    notice('Select exactly two Lower Expected Impact topics before continuing.','warning');return;
   }
  }
  if(state.step===2){
   if(highUnlockedStep()<2){notice('Complete your rankings and Impact Group selections first.','warning');return;}
   record.continuedPages=[...new Set([...record.continuedPages,3])];
   const ok=await save('results_viewed');
   if(ok||(record.outbox.length&&canEdit())){
    selectPage(3);
    if(!ok)notice('Your answers are saved on this device. Retry online saving when connected.','warning');
   }
   return;
  }
  if(state.step>=3)return;
  record.continuedPages=[...new Set([...record.continuedPages,state.step+1])];
  if(state.step===1)record.firstCompletedAt=record.firstCompletedAt||new Date().toISOString();
  const ok=await save(state.step===1?'complete':'continue');
  if(ok||(record.outbox.length&&canEdit())){
   state.complete=!!record.firstCompletedAt;
   selectPage(state.step+1);
   if(!ok)notice('Your answers are saved on this device. Retry online saving when connected.','warning');
  }
 }finally{navigating=false;}
}
async function loadCommunity(force=false){
 if(state.loading||!record.firstCompletedAt)return;
 if(!force&&state.community)return;state.loading=true;state.communityError='';render();
 try{
  if(record.outbox.length&&!(await flush()))throw Error('Save your response online before comparing.');
  const r=await fetch('/api/community',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+record.responseToken},
   body:JSON.stringify({responseId:record.responseId,sourceVersion:METHOD.id})});
  if(!r.ok)throw Error('Community averages are not available. Check that your response was saved.');
  const d=await r.json();if(typeof d.count!=='number'||typeof d.available!=='boolean')throw Error('Unexpected average format');
  state.community=d;
 }catch(e){state.communityError=e.message;}finally{state.loading=false;render();}
}
function downloadCsv(){
 const rows=[['Topic code','Topic title','Planning Area','Expected impact group','Position','Weight (%)','Little Jamaica draft score (1-5)']];
 for(const t of calculate().topics.slice().sort((a,b)=>a.position-b.position))rows.push([t.code,t.title,t.theme,t.group,t.position,fmt(t.weight*100,4),t.score]);
 const csv='\ufeff'+rows.map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='little-jamaica-my-20-priorities.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
window.addEventListener('online',()=>{status();flush();});
window.addEventListener('beforeunload',e=>{
 if(record?.outbox?.length){e.preventDefault();e.returnValue='';}
});
init();
const secret=location.hash.startsWith('#resume=')?decodeURIComponent(location.hash.substring(8)):null;
if(secret)history.replaceState(null,'',location.pathname+location.search);
render();status();
if(secret)restore(secret);
else if(record.outbox.length)flush();
