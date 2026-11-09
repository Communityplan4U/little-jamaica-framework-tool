'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const S=require('../server/survey.cjs');
const C=S.WB.topics.map(t=>t.code),T=S.WB.themes.map(t=>t.name),O=S.M.outcomes.map(o=>o.id);
const id='bda6cc17-94ad-4a87-8cc6-374a09b9aa32',event='cda6cc17-94ad-4a87-8cc6-374a09b9aa32';
function snap(){
 const weights=C.map((code,i)=>({code,position:i+1,group:S.M.groupNames[i<10?0:i<29?1:2],weight:i<10?.06:i<29?.37/19:.0075}));
 return {sourceVersion:S.M.id,responseId:id,themeRanking:T,outcomeRanking:O,
 topSelected:C.slice(0,10),bottomSelected:C.slice(29),topicWeights:weights,connections:[],
 email:'',notes:'',communications:{},inputEvidence:{continuedPages:[1,2,3,4]}};
}
test('The workbook supplies exactly 33 distinct topics across seven themes',()=>{
 assert.equal(C.length,33);assert.equal(new Set(C).size,33);assert.equal(T.length,7);
 assert.equal(S.WB.comparators.length,7);assert.equal(O.length,5);
});
test('Group weights total 100% and use 10/19/4 and 60/37/3',()=>{
 assert.deepEqual(S.M.groupCounts,[10,19,4]);assert.deepEqual(S.M.groupShares,[60,37,3]);
 assert.equal(S.M.groupCounts.reduce((a,b)=>a+b),33);assert.equal(S.M.groupShares.reduce((a,b)=>a+b),100);
 assert.ok((60/10)>(37/19));assert.ok((37/19)>(3/4));
});
test('All comparator and baseline ratings are within 1–5',()=>{
 for(const t of S.WB.topics){
  assert.ok(Number.isInteger(t.score)&&t.score>=1&&t.score<=5);
  assert.equal(t.comparatorVision.length,7);assert.equal(t.comparatorFull.length,7);
  for(const n of [...t.comparatorVision,...t.comparatorFull])assert.ok(Number.isInteger(n)&&n>=1&&n<=5);
 }
});
test('Server recomputes group weights, score and optional consent',()=>{
 const x=S.canonicalSnapshot(snap(),id);
 assert.equal(x.coreCompleted,true);assert.equal(x.snapshot.topicWeights.length,33);
 assert.ok(Math.abs(x.snapshot.topicWeights.reduce((a,t)=>a+t.weight,0)-1)<1e-12);
 assert.equal(x.snapshot.topicWeights[0].weight,.06);
 assert.ok(Math.abs(x.snapshot.topicWeights[15].weight-37/1900)<1e-12);
 assert.equal(x.snapshot.topicWeights[32].weight,.0075);
 assert.equal(x.contact.email,null);assert.equal(x.contact.newsletter,false);
});
test('Incomplete selections do not count as a completed response',()=>{
 const x=snap();x.topSelected=[];x.bottomSelected=[];assert.equal(S.canonicalSnapshot(x,id).coreCompleted,false);
});
test('Participant must explicitly choose the top ten and the bottom four',()=>{
 const x=snap();x.topSelected=C.slice(0,9);
 assert.equal(S.canonicalSnapshot(x,id).coreCompleted,false);
});
test('A topic cannot be both highest and lowest',()=>{
 const x=snap();x.bottomSelected[0]=x.topSelected[0];assert.throws(()=>S.canonicalSnapshot(x,id),/cannot be highest and lowest/);
});
test('Invalid positions or forged topic codes are rejected',()=>{
 const x=snap();x.topicWeights[0].code='FAKE';assert.throws(()=>S.canonicalSnapshot(x,id));
});
test('A server checkpoint requires explicit choices before completion',()=>{
 const x=snap();const obj={eventId:event,responseId:id,revision:1,answerRevision:1,eventType:'complete',page:4,snapshot:x};
 assert.equal(S.validateEvent(obj).coreCompleted,true);
 x.bottomSelected=[];assert.throws(()=>S.validateEvent(obj),/Complete/);
});
test('Survey scores are derived from user choices, not client-supplied weights',()=>{
 const x=snap();x.topicWeights.forEach(t=>t.weight=777);x.score=9000;
 const result=S.canonicalSnapshot(x,id).snapshot;
 assert.ok(result.score<=5&&result.score>=1);
 assert.equal(result.topicWeights[0].weight,.06);
});
test('New source version keeps old 39-topic responses separate',()=>{
 assert.ok(S.M.id.includes('33top10-bottom4'));
 const x=snap();x.sourceVersion='ljov-20261109-seven-comparators-40-35-v4';assert.throws(()=>S.canonicalSnapshot(x,id),/version/);
});
test('Production mode requires explicit production environment variables',()=>{
 const a=process.env.VERCEL_ENV,b=process.env.SURVEY_COLLECTION_MODE;
 try{
  process.env.VERCEL_ENV='production';process.env.SURVEY_COLLECTION_MODE='public';assert.equal(S.mode(),'public');
  process.env.VERCEL_ENV='preview';assert.equal(S.mode(),'test');
 }finally{if(a===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=a;
  if(b===undefined)delete process.env.SURVEY_COLLECTION_MODE;else process.env.SURVEY_COLLECTION_MODE=b;}
});
test('Public comparison endpoint requires a completed private link',()=>{
 const src=fs.readFileSync('api/community.js','utf8');
 assert.ok(src.includes('S.credentials(req)'));assert.ok(src.includes('firstCompletedAt'));
});
test('No emailing infrastructure is enabled',()=>{
 const ui=fs.readFileSync('public/js/app.js','utf8');
 assert.ok(!ui.includes('sendEmail('));assert.ok(!ui.includes('subscribeContact('));
});

test('The weighted shares are 60% highest, 37% middle and 3% lowest',()=>{
 const weights=S.canonicalSnapshot(snap(),id).snapshot.topicWeights;
 assert.equal(weights.length,33);
 for(const [start,end,expected] of [[0,10,.60],[10,29,.37],[29,33,.03]]){
  assert.ok(Math.abs(weights.slice(start,end).reduce((a,t)=>a+t.weight,0)-expected)<1e-10);
 }
 assert.ok(!S.M.id.includes('50-47'));
});

test('Server persists highest-to-middle demotions for private resume',()=>{
 const x=snap();
 x.excludedTop=[C[12]];
 const result=S.canonicalSnapshot(x,id);
 assert.deepEqual(result.snapshot.excludedTop,[C[12]]);
 const checkpoint=S.validateEvent({
  eventId:event,responseId:id,revision:1,answerRevision:1,eventType:'continue',page:3,
  snapshot:x,resumeState:{page:3}
 });
 assert.deepEqual(checkpoint.event.resumeState.excludedTop,[C[12]]);
});
test('Server disallows a demoted topic remaining in highest ten',()=>{
 const x=snap();x.excludedTop=[C[0]];
 assert.throws(()=>S.canonicalSnapshot(x,id),/moved to middle/);
});
test('Participant may move a demoted top suggestion from middle to lowest',()=>{
 const x=snap();const demoted=C[29];x.excludedTop=[demoted];
 const result=S.canonicalSnapshot(x,id);
 assert.equal(result.coreCompleted,true);
 assert.ok(result.snapshot.bottomSelected.includes(demoted));
});

test('Participant-selected top-ten topics are preserved and cannot be forged outside the highest group',()=>{
 const x=snap();x.promotedTop=[C[0],C[1]];
 assert.deepEqual(S.canonicalSnapshot(x,id).snapshot.promotedTop,[C[0],C[1]]);
 const checkpoint=S.validateEvent({
  eventId:event,responseId:id,revision:1,answerRevision:1,eventType:'continue',page:2,snapshot:x,resumeState:{page:2}
 });
 assert.deepEqual(checkpoint.event.resumeState.promotedTop,[C[0],C[1]]);
 x.promotedTop=[C[28]];
 assert.throws(()=>S.canonicalSnapshot(x,id),/must remain in the highest group/);
});

test('Browser model supports additional top-ten selections with fixed 10/19/4 groups',()=>{
 const vm=require('node:vm'),path=require('node:path');
 const load=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const ctx=vm.createContext({window:{LJOV_ASSESSMENT:S.WB,LJOV_METHODOLOGY:S.M,LJOV_CONFIG:{}}});
 const app=load('public/js/app.js').split("window.addEventListener('online'")[0];
 vm.runInContext(load('public/js/state.js')+'\n'+load('public/js/model.js')+'\n'+app,ctx);
 const x=vm.runInContext('({state,suggestions,syncTop,calculate,topicBrowser,resultsPage,FRAMEWORK_REPORTS,groupDifference})',ctx);
 const initial=x.suggestions(),added=initial[15];
 x.state.promotedTop=[added];x.syncTop();
 assert.equal(x.state.top.length,10);
 assert.ok(x.state.top.includes(added));
 assert.equal(x.calculate().groups.map(g=>g.length).join(','),'10,19,4');
 assert.match(x.topicBrowser(),/id="topic-search"/);
 assert.match(x.topicBrowser(),/Add to top 10/);
 const output=x.resultsPage();
 assert.match(output,/Compare by planning theme and community outcome/);
 assert.match(output,/Community outcome/);
 assert.match(output,/Little Jamaica \(0\)/);
 assert.doesNotMatch(output,/\/5/);
 assert.equal((output.match(/class="framework-link"/g)||[]).length,24);
 assert.equal(x.FRAMEWORK_REPORTS.comparators.length,7);
 for(const scope of ['vision','full']){
  const calc=x.calculate();
  for(let j=0;j<S.WB.comparators.length;j++){
   const parts=S.WB.themes.map(t=>x.groupDifference(calc,calc.topics.filter(row=>row.theme===t.name).map(row=>row.code),j,scope));
   const expected=calc.comparators[j][scope]-calc.baseline;
   assert.ok(Math.abs(parts.reduce((sum,val)=>sum+val,0)-expected)<1e-10);
  }
 }
});

test('Step 2 add-to-top click updates the saved selection and Step 3 shows it',()=>{
 const vm=require('node:vm'),path=require('node:path');
 const get=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const elements=new Map(),storage=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{
   id,value:'',innerHTML:'',textContent:'',hidden:false,events:{},
   addEventListener(type,handler){this.events[type]=handler;},
   setAttribute(){},getAttribute(){return null;}
  });
  return elements.get(id);
 };
 const ctx=vm.createContext({
  window:{LJOV_ASSESSMENT:S.WB,LJOV_METHODOLOGY:S.M,LJOV_CONFIG:{}},
  document:{getElementById:element,querySelectorAll:()=>[]},
  localStorage:{setItem:(key,value)=>storage.set(key,value),getItem:key=>storage.get(key)||null}
 });
 const app=get('public/js/app.js').split("window.addEventListener('online'")[0];
 vm.runInContext(get('public/js/state.js')+'\n'+get('public/js/model.js')+'\n'+app,ctx);
 vm.runInContext("collection={checked:true,isOpen:true};record={responseId:'bda6cc17-94ad-4a87-8cc6-374a09b9aa32',outbox:[],confirmedRevision:0};state.step=1;render();",ctx);
 const state=vm.runInContext('state',ctx),before=state.top.slice();
 const toAdd=C.find(code=>!before.includes(code));
 assert.match(element('stage').innerHTML,/id="topic-search"/);
 const handler=element('topic-browser-results').events.click;
 assert.equal(typeof handler,'function');
 handler({target:{closest:()=>({dataset:{addTop:toAdd}})}});
 assert.equal(state.top.length,10);
 assert.ok(state.top.includes(toAdd));
 assert.ok(state.promotedTop.includes(toAdd));
 assert.ok(storage.size>=1);
 vm.runInContext('state.step=2;render()',ctx);
 assert.match(element('stage').innerHTML,new RegExp('data-code="'+toAdd+'"'));
});
