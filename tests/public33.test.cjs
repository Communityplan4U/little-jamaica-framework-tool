'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const S=require('../server/survey.cjs');
const C=S.WB.surveyTopics.map(t=>t.code),T=S.WB.themes.map(t=>t.name),O=S.M.outcomes.map(o=>o.id);
const id='bda6cc17-94ad-4a87-8cc6-374a09b9aa32',event='cda6cc17-94ad-4a87-8cc6-374a09b9aa32';
function snap(){
 const weights=C.map((code,i)=>({code,position:i+1,group:S.M.groupNames[i<6?0:i<18?1:2],weight:i<6?.10:i<18?.37/12:.015}));
 return {sourceVersion:S.M.id,responseId:id,themeRanking:T,outcomeRanking:O,
 topSelected:C.slice(0,6),bottomSelected:C.slice(18),topicWeights:weights,connections:[],
 email:'',notes:'',communications:{},inputEvidence:{continuedPages:[1,2,3,4]}};
}
test('The workbook supplies 20 survey topics across six Planning Areas',()=>{
 assert.equal(C.length,20);assert.equal(new Set(C).size,20);assert.equal(T.length,6);
 assert.equal(S.WB.topics.length,33);assert.equal(new Set(S.WB.topics.map(t=>t.code)).size,33);
 assert.equal(S.WB.comparators.length,7);assert.equal(O.length,6);
});
test('Group weights total 100% and use 6/12/2 and 60/37/3',()=>{
 assert.deepEqual(S.M.groupCounts,[6,12,2]);assert.deepEqual(S.M.groupShares,[60,37,3]);
 assert.equal(S.M.groupCounts.reduce((a,b)=>a+b),20);assert.equal(S.M.groupShares.reduce((a,b)=>a+b),100);
 assert.ok((60/6)>(37/12));assert.ok((37/12)>(3/2));
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
 assert.equal(x.coreCompleted,true);assert.equal(x.snapshot.topicWeights.length,20);
 assert.ok(Math.abs(x.snapshot.topicWeights.reduce((a,t)=>a+t.weight,0)-1)<1e-12);
 assert.equal(x.snapshot.topicWeights[0].weight,.10);
 assert.ok(Math.abs(x.snapshot.topicWeights[15].weight-37/1200)<1e-12);
 assert.equal(x.snapshot.topicWeights[19].weight,.015);
 assert.equal(x.contact.email,null);assert.equal(x.contact.newsletter,false);
});
test('Incomplete selections do not count as a completed response',()=>{
 const x=snap();x.topSelected=[];x.bottomSelected=[];assert.equal(S.canonicalSnapshot(x,id).coreCompleted,false);
});
test('Participant must explicitly choose the top ten and the bottom four',()=>{
 const x=snap();x.topSelected=C.slice(0,5);
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
 assert.equal(result.topicWeights[0].weight,.10);
});
test('New source version keeps old 39-topic responses separate',()=>{
 assert.ok(S.M.id.includes('20top6-bottom2'));
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
 assert.equal(weights.length,20);
 for(const [start,end,expected] of [[0,6,.60],[6,18,.37],[18,20,.03]]){
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
 const x=snap();const demoted=C[18];x.excludedTop=[demoted];
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
 x.promotedTop=[C[17]];
 assert.throws(()=>S.canonicalSnapshot(x,id),/must remain in the highest group/);
});

test('Browser model supports additional top-ten selections with fixed 6/12/2 groups',()=>{
 const vm=require('node:vm'),path=require('node:path');
 const load=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const ctx=vm.createContext({window:{LJOV_ASSESSMENT:S.WB,LJOV_METHODOLOGY:S.M,LJOV_CONFIG:{}}});
 const app=load('public/js/app.js').split("window.addEventListener('online'")[0];
 vm.runInContext(load('public/js/state.js')+'\n'+load('public/js/model.js')+'\n'+app,ctx);
 const x=vm.runInContext('({state,suggestions,syncTop,calculate,topicBrowser,resultsPage,FRAMEWORK_REPORTS,FRAMEWORK_RESPONSIBILITIES,FRAMEWORK_WARDS,groupDifference})',ctx);
 const initial=x.suggestions(),added=initial[12];
 x.state.promotedTop=[added];x.syncTop();
 assert.equal(x.state.top.length,6);
 assert.ok(x.state.top.includes(added));
 assert.equal(x.calculate().groups.map(g=>g.length).join(','),'6,12,2');
 assert.match(x.topicBrowser(),/id="topic-search"/);
 assert.match(x.topicBrowser(),/data-add-top=/);
 const output=x.resultsPage();
 assert.match(output,/class="breakdown-table"/);
  assert.match(output,/class="framework-link"/);
  assert.equal((output.match(/class="framework-link"/g)||[]).length,24);
 assert.equal(x.FRAMEWORK_REPORTS.comparators.length,7);
 assert.equal(Object.keys(x.FRAMEWORK_WARDS.comparators).length,7);
 assert.match(x.FRAMEWORK_WARDS.local,/Wards 5 .*8 .*9 .*12 /);
 assert.match(x.FRAMEWORK_WARDS.comparators['Port Lands Planning Framework'],/Ward 14 .*Ward 30/);
 assert.equal((output.match(/ · Wards? /g)||[]).length,8,'Step 5 shows the ward next to each publication date');
 assert.match(output,/Published: June 2026 · Wards 10/,'Chinatown displays both wards');
 assert.match(output,/Published: December 2021 · Ward 5/,'Picture Mount Dennis displays Ward 5');
 assert.match(output,/Published: February 2026 · Ward 12/,'St. Clair Bathurst displays Ward 12');
 assert.match(output,/Published: September 2017 · Ward 14/,'Port Lands displays the current ward');
 assert.match(output,/Ward 30 when adopted in 2017/,'Port Lands preserves the historical ward');
 assert.equal(x.FRAMEWORK_REPORTS.local,'https://drive.google.com/file/d/120GGehAkWSTByvfSLy4vcQEEqMcRE5XQ/view?usp=drive_link');
 assert.equal(output.split(x.FRAMEWORK_REPORTS.local).length-1,3,'Local document linked from score card and both comparison matrices');
 assert.ok(output.includes('Little Jamaica / Oakwood Vaughan (draft)'));
 assert.match(output,/Source: Draft Community Visioning Statement/);
 assert.match(output,/City Proposals Report/);
 assert.equal(Object.keys(x.FRAMEWORK_RESPONSIBILITIES.comparators).length,S.WB.comparators.length);
 assert.ok(x.FRAMEWORK_RESPONSIBILITIES.local.lead);
 assert.ok(x.FRAMEWORK_RESPONSIBILITIES.local.support);
 for(const name of S.WB.comparators){
  const credit=x.FRAMEWORK_RESPONSIBILITIES.comparators[name];
  assert.ok(credit?.lead && credit?.support,'Missing lead/support metadata for '+name);
 }
 assert.equal((output.match(/class="score-lead"/g)||[]).length,8);
 assert.equal((output.match(/class="score-support"/g)||[]).length,8);
 for(const scope of ['vision','full']){
  const calc=x.calculate();
  for(let j=0;j<S.WB.comparators.length;j++){
   const parts=S.WB.themes.map(t=>x.groupDifference(calc,calc.topics.filter(row=>row.theme===t.name).map(row=>row.code),j,scope));
   const expected=calc.comparators[j][scope]-calc.baseline;
   assert.ok(Math.abs(parts.reduce((sum,val)=>sum+val,0)-expected)<1e-10);
  }
 }
});

test('Step 3 shows all searchable other topics, permits promotion and saves selection; Step 2 does not',()=>{
 const vm=require('node:vm'),path=require('node:path');
 const get=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const elements=new Map(),storage=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{
   id,value:'',innerHTML:'',textContent:'',hidden:false,dataset:{},events:{},
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
 vm.runInContext("collection={checked:true,isOpen:true};record={responseId:'bda6cc17-94ad-4a87-8cc6-374a09b9aa32',outbox:[],confirmedRevision:0};state.step=0;render();",ctx);
 assert.equal((element('stage').innerHTML.match(/data-drag-rank="ranking"/g)||[]).length,6);
 vm.runInContext('state.step=1;render()',ctx);
 assert.equal((element('stage').innerHTML.match(/data-drag-rank="outcomeRanking"/g)||[]).length,6);
 assert.doesNotMatch(element('stage').innerHTML,/id="topic-search"/);
 vm.runInContext('state.step=2;render()',ctx);
 assert.match(element('stage').innerHTML,/data-demote="top"/);
 const state=vm.runInContext('state',ctx),before=state.top.slice();
 const toAdd=C.find(code=>!before.includes(code));
 assert.match(element('stage').innerHTML,/id="topic-search"/);
 assert.match(element('stage').innerHTML,/data-demote="top"/);
 element('topic-search').value=toAdd;
 element('topic-search').events.input();
 assert.match(element('topic-browser-results').innerHTML,new RegExp('data-add-top="'+toAdd+'"'));
 const handler=element('topic-browser-results').events.click;
 assert.equal(typeof handler,'function');
 handler({target:{closest:()=>({dataset:{addTop:toAdd}})}});
 assert.equal(state.top.length,6);
 assert.ok(state.top.includes(toAdd));
 assert.ok(state.promotedTop.includes(toAdd));
 assert.ok(storage.size>=1);
 vm.runInContext('state.step=2;render()',ctx);
 assert.match(element('stage').innerHTML,new RegExp('data-code="'+toAdd+'"'));
});

test('Thirty-three criteria cover six outcomes and all twenty survey choices',()=>{
 assert.deepEqual(O,['coord','wealth','remain','power','belong','wellbeing']);
 assert.ok(S.M.id.includes('20top6-bottom2'));
 assert.deepEqual(S.M.outcomeRankPoints,[6,5,4,3,2,1]);
 assert.deepEqual(S.M.suggestionBlend,{themes:0.6,outcomes:0.4});
 assert.deepEqual(S.M.groupCounts,[6,12,2]);
 assert.deepEqual(S.M.groupShares,[60,37,3]);
 assert.ok(S.M.humanRightsLens.includes('Indigenous rights'));
 const all=new Set();
 for(const o of S.M.outcomes){
  const underlying=S.WB.topics.filter(t=>t.outcomeFlags[o.id]===1);
  assert.ok(new Set(underlying.map(t=>t.planningArea)).size>=2,'Outcome is not cross-cutting: '+o.id);
  for(const t of underlying){assert.ok(!all.has(t.code));all.add(t.code);}
 }
 assert.equal(all.size,33);
 const assigned=S.WB.surveyTopics.flatMap(t=>t.criterionCodes);
 assert.equal(assigned.length,33);assert.equal(new Set(assigned).size,33);
 for(const t of S.WB.surveyTopics){
  assert.ok(t.criterionCodes.every(code=>all.has(code)));
  assert.ok(Math.abs(Object.values(t.outcomeFlags).reduce((a,n)=>a+n,0)-1)<1e-10);
 }
});
test('Outcome ranking changes proposed top-ten suggestions and validates all six ranks',()=>{
 const vm=require('node:vm'),path=require('node:path');
 const get=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const ctx=vm.createContext({window:{LJOV_ASSESSMENT:S.WB,LJOV_METHODOLOGY:S.M,LJOV_CONFIG:{}}});
 vm.runInContext(get('public/js/state.js')+'\n'+get('public/js/model.js'),ctx);
 const first=Array.from(vm.runInContext('suggestions()',ctx));
 vm.runInContext('state.outcomeRanking.reverse()',ctx);
 const second=Array.from(vm.runInContext('suggestions()',ctx));
 assert.notDeepEqual(first,second);
 assert.equal(first.length,20);
 assert.equal(new Set(first).size,20);
 const response=snap();
 assert.equal(S.canonicalSnapshot(response,id).coreCompleted,true);
 response.outcomeRanking=response.outcomeRanking.slice(1);
 assert.throws(()=>S.canonicalSnapshot(response,id),/Invalid outcomes/);
});

test('60/40 suggestions normalize six Planning Areas and outcome ranking',()=>{
 const vm=require('node:vm');
 const ctx=vm.createContext({window:{LJOV_ASSESSMENT:S.WB,LJOV_METHODOLOGY:S.M,LJOV_CONFIG:{}}});
 vm.runInContext(fs.readFileSync('public/js/state.js','utf8')+'\n'+fs.readFileSync('public/js/model.js','utf8'),ctx);
 const score=()=>vm.runInContext("suggestionScores().find(t=>t.code==='T19').score",ctx);
 vm.runInContext("state.ranking=[THEMES[5],...THEMES.slice(0,5)];state.outcomeRanking=OUTCOMES.slice()",ctx);
 assert.equal(score(),100);
 vm.runInContext("state.outcomeRanking=[...OUTCOMES.slice(1),OUTCOMES[0]]",ctx);
 assert.equal(score(),60);
 vm.runInContext("state.ranking=THEMES.slice();state.outcomeRanking=OUTCOMES.slice()",ctx);
 assert.equal(score(),40);
 vm.runInContext("state.outcomeRanking=[...OUTCOMES.slice(1),OUTCOMES[0]]",ctx);
 assert.equal(score(),0);
 const scores=Array.from(vm.runInContext('suggestionScores()',ctx),x=>x.score);
 assert.ok(scores.every(x=>x>=0&&x<=100));
});
test('New normalized additive methodology rejects previous multiplier snapshots',()=>{
 const previous=snap();previous.sourceVersion='ljov-20261109-33top10-bottom4-60-37-3-six-outcomes-v3';
 assert.throws(()=>S.canonicalSnapshot(previous,id),/version mismatch/i);
 const s=snap();assert.equal(S.canonicalSnapshot(s,id).coreCompleted,true);
 const ui=fs.readFileSync('public/js/app.js','utf8');
 assert.ok(ui.includes('six-areas.six-outcomes.v1.'));
});
test('Community comparison supports internal subject view keys and valid connection form',()=>{
 const vm=require('node:vm'),path=require('node:path');
 const get=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const context=vm.createContext({window:{LJOV_ASSESSMENT:S.WB,LJOV_METHODOLOGY:S.M,LJOV_CONFIG:{}}});
 const partialApp=get('public/js/app.js').split("window.addEventListener('online'")[0];
 vm.runInContext(get('public/js/state.js')+'\n'+get('public/js/model.js')+'\n'+partialApp,context);
 const obj=vm.runInContext('({state,communityPage,connectionForm})',context);
 obj.state.communityView='themes';
 assert.equal((obj.communityPage().match(/class="compare-item"/g)||[]).length,6);
 obj.state.communityView='subjects';
 assert.equal((obj.communityPage().match(/class="compare-item"/g)||[]).length,6);
 const form=obj.connectionForm();
 assert.ok(form.startsWith('<section')&&form.endsWith('</section>'));
 assert.equal((form.match(/data-connection=/g)||[]).length,7);
 assert.match(form,/id="newsletter"/);
 assert.match(form,/id="planning-updates"/);
});
test('New participant connection options validate server-side and retain older saved options',()=>{
 const x=snap();
 x.connections=['visit','representation','resident'];
 assert.deepEqual(S.canonicalSnapshot(x,id).snapshot.connections,x.connections);
 x.connections=['organization','culture','services'];
 assert.deepEqual(S.canonicalSnapshot(x,id).snapshot.connections,x.connections);
 x.connections=['bogus'];
 assert.throws(()=>S.canonicalSnapshot(x,id),/Invalid neighbourhood connection/);

});
test('Mobile layout retains viewport and scrollable containers',()=>{
 const css=fs.readFileSync('public/css/survey.css','utf8');
 const html=fs.readFileSync('public/index.html','utf8');
 assert.match(html,/name="viewport"/);
 assert.match(css,/@media\s*\(max-width:/);
 assert.match(css,/overflow-x\s*:\s*auto/);
});


test('Step 5 lets participants reassign all 33 topics in a valid 6/12/2 draft before updating assessments',()=>{
 const vm=require('node:vm'),path=require('node:path');
 const load=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const ctx=vm.createContext({window:{LJOV_ASSESSMENT:S.WB,LJOV_METHODOLOGY:S.M,LJOV_CONFIG:{}}});
 const src=load('public/js/app.js').split("window.addEventListener('online'")[0];
 vm.runInContext(load('public/js/state.js')+'\n'+load('public/js/model.js')+'\n'+src,ctx);
 const run=code=>vm.runInContext(code,ctx);
 run('state.bottom=orderedGroups()[2].slice();state.step=4;');
 const before=run('calculate()');
 const [wasHighest,wasMiddle]=[before.groups[0][0],before.groups[1][0]];
 const html=run('resultsPage()');
 const editor=html.split('<details class="full-breakdown')[1].split('</details>')[0];
 assert.match(editor,/See and adjust 20 survey topic prioritization/);
 assert.equal((editor.match(/data-priority-code=/g)||[]).length,20);
 assert.doesNotMatch(editor,/<th>Weight<\/th>/);
 assert.match(editor,/<th>Priority group<\/th>/);
 assert.match(editor,/I prefer this ranking\. Update the assessments based on this ranking/);
 assert.deepEqual(Array.from(run('priorityGroupCounts(priorityDraft.groups)')),[6,12,2]);
 run('priorityDraft.groups['+JSON.stringify(wasHighest)+']=1');
 assert.equal(run('priorityDraftValid()'),false);
 assert.equal(run('applyPriorityDraft()'),false);
 assert.ok(run('state.top.includes('+JSON.stringify(wasHighest)+')'));
 run('priorityDraft.groups['+JSON.stringify(wasMiddle)+']=0');
 assert.equal(run('priorityDraftValid()'),true);
 assert.equal(run('applyPriorityDraft()'),true);
 const after=run('calculate()');
 assert.deepEqual(Array.from(after.groups.map(g=>g.length)),[6,12,2]);
 assert.ok(after.groups[0].includes(wasMiddle));
 assert.ok(after.groups[1].includes(wasHighest));
 assert.ok(!after.groups[0].includes(wasHighest));
 assert.ok(after.groups[2].length===2);
 assert.ok(run('state.promotedTop.includes('+JSON.stringify(wasMiddle)+')'));
 assert.ok(Math.abs(after.topics.reduce((a,t)=>a+t.weight,0)-1)<1e-10);
 run('resultsPage()');
 assert.equal(run('priorityDraftValid()'),true);
});

test('Fresh Step 1 subjects and Step 2 outcomes start in the survey-informed order',()=>{
 const vm=require('node:vm'),path=require('node:path');
 const load=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const ctx=vm.createContext({window:{LJOV_ASSESSMENT:S.WB,LJOV_METHODOLOGY:S.M,LJOV_CONFIG:{}}});
 const app=load('public/js/app.js').split("window.addEventListener('online'")[0];
 vm.runInContext(load('public/js/state.js')+'\n'+load('public/js/model.js')+'\n'+app,ctx);
 const order=key=>Array.from(vm.runInContext('state.'+key,ctx));
 assert.deepEqual(order('ranking'),[
  'Housing','Rights and equity','Delivery','Economic opportunity',
  'Community and public spaces','Culture and identity','Acknowledgement'
 ]);
 assert.deepEqual(order('outcomeRanking'),['wellbeing','remain','power','coord','wealth','belong']);
 assert.deepEqual(Array.from(vm.runInContext('THEMES',ctx)),T,'Keep authoritative subject IDs unchanged');
 assert.deepEqual(Array.from(vm.runInContext('OUTCOMES',ctx)),O,'Keep authoritative outcome IDs unchanged');
 const subjects=vm.runInContext("optionRank(THEMES,'ranking')",ctx);
 const outcomes=vm.runInContext("optionRank(OUTCOMES,'outcomeRanking')",ctx);
 const labels=order('ranking');
 for(let i=1;i<labels.length;i++){
  assert.ok(subjects.indexOf(labels[i-1])<subjects.indexOf(labels[i]),'Rendered subject order '+i);
 }
 const outcomeTitles=order('outcomeRanking').map(id=>S.M.outcomes.find(o=>o.id===id).title);
 for(let i=1;i<outcomeTitles.length;i++){
  assert.ok(outcomes.indexOf(outcomeTitles[i-1])<outcomes.indexOf(outcomeTitles[i]),'Rendered outcome order '+i);
 }
 const saved=snap();
 saved.themeRanking=order('ranking');
 saved.outcomeRanking=order('outcomeRanking');
 assert.equal(S.canonicalSnapshot(saved,id).coreCompleted,true,'New defaults are server-compatible');
 assert.match(app,/The earlier survey asked about five action areas/);
 assert.match(app,/These six outcomes were not ranked directly/);
});

test('New defaults apply only to a fresh respondent; local saved rankings are preserved',()=>{
 const vm=require('node:vm'),path=require('node:path'),store=new Map();
 const load=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const app=load('public/js/app.js').split("window.addEventListener('online'")[0];
 const code=load('public/js/state.js')+'\n'+load('public/js/model.js')+'\n'+app;
 const makeCtx=()=>vm.createContext({
  window:{LJOV_ASSESSMENT:S.WB,LJOV_METHODOLOGY:S.M,LJOV_CONFIG:{}},
  crypto:{randomUUID:()=> 'bda6cc17-94ad-4a87-8cc6-374a09b9aa32'},
  localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)}
 });
 const first=makeCtx();
 vm.runInContext(code,first);
 vm.runInContext('init()',first);
 assert.equal(vm.runInContext('state.ranking[0]',first),'Housing and remaining rooted');
 assert.equal(vm.runInContext('state.outcomeRanking[0]',first),'wellbeing');
 vm.runInContext('state.ranking.reverse();state.outcomeRanking.reverse();write()',first);
 const prior={
  subjects:Array.from(vm.runInContext('state.ranking',first)),
  outcomes:Array.from(vm.runInContext('state.outcomeRanking',first))
 };
 const second=makeCtx();
 vm.runInContext(code,second);
 vm.runInContext('init()',second);
 assert.deepEqual(Array.from(vm.runInContext('state.ranking',second)),prior.subjects);
 assert.deepEqual(Array.from(vm.runInContext('state.outcomeRanking',second)),prior.outcomes);
 assert.equal(vm.runInContext('record.responseId',second),'bda6cc17-94ad-4a87-8cc6-374a09b9aa32');
});
