'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const S=require('../server/survey.cjs');

const responseId='bda6cc17-94ad-4a87-8cc6-374a09b9aa32';
const token='a'.repeat(64);
const ok=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>data});
const receipt=e=>ok(200,{eventId:e.eventId,receivedAt:'2026-11-10T01:00:00Z',revision:e.revision});
const serverState=(revision,answerRevision=revision)=>({
 sourceVersion:S.M.id,revision,answerRevision,firstCompletedAt:null,continuedPages:[1],visitedPages:[1],
 resumeState:{ranking:S.WB.themes.map(t=>t.name),outcomeRanking:S.M.outcomes.map(o=>o.id)}
});

function harness(fetchHandler){
 const elements=new Map(),store=new Map();
 function element(id){
  if(!elements.has(id))elements.set(id,{
   id,value:'',innerHTML:'',textContent:'',hidden:false,children:[],dataset:{},listeners:{},
   addEventListener(name,fn){this.listeners[name]=fn;},
   appendChild(child){this.children.push(child);},setAttribute(){},getAttribute(){return null;}
  });
  return elements.get(id);
 }
 const document={getElementById:element,querySelectorAll:()=>[],
  createElement:tag=>({tag,textContent:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}})};
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 let handler=fetchHandler;
 const context=vm.createContext({
  window:{LJOV_ASSESSMENT:S.WB,LJOV_METHODOLOGY:S.M,LJOV_CONFIG:{},scrollTo(){}},
  document,localStorage,crypto,fetch:(...args)=>handler(...args)
 });
 const get=file=>fs.readFileSync(file,'utf8');
 const partial=get('public/js/app.js').split("window.addEventListener('online'")[0];
 vm.runInContext(get('public/js/state.js')+'\n'+get('public/js/model.js')+'\n'+partial,context);
 vm.runInContext("record={responseId:'"+responseId+"',responseToken:'"+token+"',sourceVersion:METHOD.id,revision:0,answerRevision:0,confirmedRevision:0,continuedPages:[],visitedPages:[1],firstCompletedAt:null,outbox:[],createdAt:new Date().toISOString()};collection={isOpen:true,checked:true,offlineDraft:false};",context);
 const run=src=>vm.runInContext(src,context);
 return {run,element,store,setHandler:fn=>handler=fn};
}

test('A stale revision automatically authenticates, rebases and saves latest choices',async()=>{
 const calls=[],revision=2;
 const h=harness(async(url,opts)=>{
  if(url==='/api/resume'){calls.push('resume');return ok(200,serverState(revision));}
  const e=JSON.parse(opts.body);calls.push('save:'+e.revision);
  return e.revision===revision+1?receipt(e):ok(409,{error:'A newer response is saved.'});
 });
 h.run('state.ranking.reverse();checkpoint("continue")');
 const original=Array.from(h.run('state.ranking'));
 assert.equal(await h.run('flush()'),true);
 assert.deepEqual(calls,['save:1','resume','save:3']);
 assert.equal(h.run('record.confirmedRevision'),3);
 assert.equal(h.run('record.outbox.length'),0);
 assert.deepEqual(Array.from(h.run('state.ranking')),original);
});

test('Multiple queued checkpoints collapse to the current draft without losing visited steps',async()=>{
 const submitted=[];
 const h=harness(async(url,opts)=>{
  if(url==='/api/resume')return ok(200,serverState(5,5));
  const e=JSON.parse(opts.body);submitted.push(e);
  return e.revision===6?receipt(e):ok(409,{error:'stale'});
 });
 h.run("record.continuedPages=[1];checkpoint('continue')");
 h.run("state.step=1;record.visitedPages=[1,2];record.continuedPages=[1,2];state.outcomeRanking.reverse();checkpoint('continue')");
 assert.equal(h.run('record.outbox.length'),2);
 assert.equal(await h.run('flush()'),true);
 assert.deepEqual(submitted.map(e=>e.revision),[1,6]);
 assert.deepEqual(submitted[1].continuedPages,[1,2]);
 assert.deepEqual(submitted[1].visitedPages,[1,2]);
 assert.deepEqual(submitted[1].snapshot.outcomeRanking,Array.from(h.run('state.outcomeRanking')));
 assert.equal(h.run('record.outbox.length'),0);
});

test('Missing first checkpoint recovers from a new initial revision',async()=>{
 const saved=[];
 const h=harness(async(url,opts)=>{
  if(url==='/api/resume')return ok(403,{error:'Unknown response'});
  const e=JSON.parse(opts.body);saved.push(e.revision);
  return e.revision===1?receipt(e):ok(409,{error:'Missing initial checkpoint'});
 });
 h.run("record.revision=1;record.answerRevision=1;checkpoint('continue')");
 assert.equal(await h.run('flush()'),true);
 assert.deepEqual(saved,[2,1]);
 assert.equal(h.run('record.confirmedRevision'),1);
});

test('A network interruption does not prevent progression to the next survey step',async()=>{
 const h=harness(async()=>{throw Error('Network offline');});
 await h.run('next()');
 assert.equal(h.run('state.step'),1);
 assert.equal(h.run('record.outbox.length'),1);
 assert.ok(h.store.size>0);
 assert.equal(h.element('save-state').children.at(-1).textContent,'Retry save');
});

test('A manual retry button actually submits queued answers',async()=>{
 const h=harness(async(url,opts)=>receipt(JSON.parse(opts.body)));
 h.run("checkpoint('continue');renderSaveBadge()");
 const btn=h.element('save-state').children.at(-1);
 assert.equal(btn.textContent,'Retry save');
 await btn.listeners.click();
 assert.equal(h.run('record.outbox.length'),0);
});

test('A real survey closure cannot be bypassed and never deletes the local draft',async()=>{
 const h=harness(async()=>ok(423,{error:'Closed'}));
 await h.run('next()');
 assert.equal(h.run('state.step'),0);
 assert.equal(h.run('collection.isOpen'),false);
 assert.equal(h.run('collection.offlineDraft'),false);
 assert.equal(h.run('record.outbox.length'),1);
});

test('Unauthorized conflict recovery preserves drafts rather than overwriting responses',async()=>{
 const h=harness(async(url)=>{
  return url==='/api/resume'?ok(403,{error:'Not authorized'}):ok(409,{error:'stale'});
 });
 h.run("record.revision=1;record.confirmedRevision=1;record.answerRevision=1;checkpoint('continue')");
 assert.equal(await h.run('flush()'),false);
 assert.equal(h.run('record.outbox.length'),1);
 assert.equal(h.run('record.responseId'),responseId);
});

test('Reopening the same private return link preserves and saves unsent local answers',async()=>{
 const h=harness(async(url,opts)=>{
  if(url==='/api/resume')return ok(200,serverState(2,2));
  const e=JSON.parse(opts.body);
  return e.revision===3?receipt(e):ok(409,{error:'stale'});
 });
 h.run("state.ranking.reverse();checkpoint('continue')");
 const localOrder=Array.from(h.run('state.ranking'));
 await h.run("restore('"+responseId+"."+token+"')");
 assert.deepEqual(Array.from(h.run('state.ranking')),localOrder);
 assert.equal(h.run('record.confirmedRevision'),3);
 assert.equal(h.run('record.outbox.length'),0);
});

test('A temporary status outage allows a clearly marked local draft',async()=>{
 const h=harness(async()=>{throw Error('Offline');});
 await h.run('status()');
 assert.equal(h.run('collection.offlineDraft'),true);
 assert.equal(h.run('canEdit()'),true);
});

test('Rapid double-clicking Continue creates only one checkpoint and one step transition',async()=>{
 let finish;
 const h=harness(async(url,opts)=>new Promise(resolve=>{
  const e=JSON.parse(opts.body);
  finish=()=>resolve(receipt(e));
 }));
 const first=h.run('next()');
 const second=h.run('next()');
 assert.equal(h.run('record.outbox.length'),1);
 assert.equal(h.run('record.revision'),1);
 finish();
 await Promise.all([first,second]);
 assert.equal(h.run('state.step'),1);
 assert.equal(h.run('record.confirmedRevision'),1);
 assert.equal(h.run('record.outbox.length'),0);
});

test('Conflict recovery preserves an unsent completion when later edits were queued',async()=>{
 const accepted=[];
 const h=harness(async(url,opts)=>{
  if(url==='/api/resume')return ok(200,serverState(2,2));
  const e=JSON.parse(opts.body);accepted.push(e);
  return e.revision===3?receipt(e):ok(409,{error:'stale'});
 });
 h.run("state.bottom=suggestions().slice(-2);record.continuedPages=[1,2];record.firstCompletedAt=new Date().toISOString();state.step=1;checkpoint('complete')");
 h.run("state.step=2;state.feedback='These are my current priorities';checkpoint('comments_shared')");
 assert.equal(await h.run('flush()'),true);
 assert.equal(accepted.at(-1).eventType,'complete');
 assert.equal(accepted.at(-1).snapshot.inputEvidence.coreStepsCompleted,true);
 assert.equal(accepted.at(-1).snapshot.notes,'These are my current priorities');
 assert.equal(h.run('record.outbox.length'),0);
});


test('Applying Step 5 topic groups recalculates and saves a server-valid revision',async()=>{
 const accepted=[];
 const h=harness(async(url,opts)=>{
  const e=JSON.parse(opts.body);accepted.push(e);return receipt(e);
 });
 h.run("record.continuedPages=[1,2];record.firstCompletedAt='2026-11-10T01:00:00Z';state.bottom=orderedGroups()[2].slice();state.step=2;render()");
 const [highest,middle]=Array.from(h.run('calculate().groups')).slice(0,2).map(group=>group[0]);
 h.run('priorityDraft.groups['+JSON.stringify(highest)+']=1');
 h.run('updatePriorityDraftControls()');
 assert.equal(h.element('apply-priority-ranking').disabled,true);
 assert.equal(accepted.length,0,'Draft changes must not autosave before Apply');
 h.run('priorityDraft.groups['+JSON.stringify(middle)+']=0');
 h.run('updatePriorityDraftControls()');
 assert.equal(h.element('apply-priority-ranking').disabled,false);
 await h.element('apply-priority-ranking').listeners.click();
 assert.equal(accepted.length,1);
 assert.equal(accepted[0].eventType,'revision');
 assert.equal(S.validateEvent(accepted[0]).coreCompleted,true);
 assert.ok(accepted[0].snapshot.topSelected.includes(middle));
 assert.ok(!accepted[0].snapshot.topSelected.includes(highest));
 assert.ok(accepted[0].snapshot.topicWeights.find(x=>x.code===middle).group==='Highest priority');
 assert.ok(accepted[0].snapshot.topicWeights.find(x=>x.code===highest).group==='Middle priority');
 assert.equal(h.run('record.outbox.length'),0);
});

test('Applying groups while offline retains the revised ranking and retryable save',async()=>{
 const h=harness(async()=>{throw Error('Offline');});
 h.run("record.continuedPages=[1,2];record.firstCompletedAt='2026-11-10T01:00:00Z';state.bottom=orderedGroups()[2].slice();state.step=2;render()");
 const [highest,middle]=Array.from(h.run('calculate().groups')).slice(0,2).map(group=>group[0]);
 h.run('priorityDraft.groups['+JSON.stringify(highest)+']=1;priorityDraft.groups['+JSON.stringify(middle)+']=0;updatePriorityDraftControls()');
 await h.element('apply-priority-ranking').listeners.click();
 assert.ok(h.run('state.top.includes('+JSON.stringify(middle)+')'));
 assert.equal(h.run('record.outbox.length'),1);
 assert.equal(h.element('save-state').children.at(-1).textContent,'Retry save');
});


test('Four-step journey requires completed topic priorities before results and community access',async()=>{
 const saved=[];
 const h=harness(async(url,opts)=>{
  if(url==='/api/community')return ok(200,{available:false,count:0});
  const event=JSON.parse(opts.body);saved.push(event);return receipt(event);
 });
 h.run('render()');
 const sidebar=()=>h.element('steps').innerHTML;
 const locked=n=>new RegExp('data-step="'+(n-1)+'"[^>]*disabled').test(sidebar());
 assert.equal(h.run('highestUnlockedStep()'),0);
 assert.equal(locked(1),false);
 for(let n=2;n<=4;n++)assert.equal(locked(n),true,'Step '+n+' starts locked');
 for(let n=1;n<=3;n++)h.run('selectPage('+n+')');
 assert.equal(h.run('state.step'),0);
 await h.run('next()');
 assert.equal(h.run('state.step'),1);
 assert.equal(h.run('highestUnlockedStep()'),1);
 assert.equal(locked(2),false);assert.equal(locked(3),true);
 assert.equal(saved.length,1);
 await h.run('next()');
 assert.equal(h.run('state.step'),1,'Step 2 needs two explicit lowest priorities');
 assert.equal(saved.length,1);
 h.run('state.bottom=orderedGroups()[2].slice()');
 await h.run('next()');
 assert.equal(h.run('state.step'),2);
 assert.equal(h.run('highestUnlockedStep()'),2);
 assert.equal(locked(3),false);assert.equal(locked(4),true);
 h.run('selectPage(3)');
 assert.equal(h.run('state.step'),2,'Step 4 is locked until comparison results reviewed');
 await h.run('next()');
 assert.equal(h.run('state.step'),3);
 assert.equal(h.run('highestUnlockedStep()'),3);
 assert.equal(locked(4),false);
 assert.equal(saved.length,3);
 assert.deepEqual(saved.map(e=>e.eventType),['continue','complete','results_viewed']);
 assert.equal(S.validateEvent(saved.at(-1)).coreCompleted,true);
 assert.ok(saved.at(-1).continuedPages.includes(3));
 h.run('selectPage(0)');h.run('selectPage(3)');
 assert.equal(h.run('state.step'),3,'Completed pages can be revisited');
});
test('Restoring a partially completed response never unlocks uncompleted pages',async()=>{
 const d={sourceVersion:S.M.id,revision:2,answerRevision:2,firstCompletedAt:null,
  continuedPages:[1],visitedPages:[1,2,3,4],
  resumeState:{
   page:3,ranking:S.WB.themes.map(t=>t.name),outcomeRanking:S.M.outcomes.map(t=>t.id),
   top:[],bottom:[],excludedTop:[],promotedTop:[],topicOrder:[],connections:[],feedback:'',scope:'vision'
  }};
 const h=harness(async(url,opts)=>url==='/api/resume'?ok(200,d):receipt(JSON.parse(opts.body)));
 await h.run("restore('"+responseId+"."+token+"')");
 assert.equal(h.run('state.step'),1,'Restored page clamps to completed Steps');
 assert.equal(h.run('highestUnlockedStep()'),1);
 h.run('selectPage(2)');h.run('selectPage(3)');
 assert.equal(h.run('state.step'),1,'Visited page metadata must not unlock the next step');
 assert.match(h.element('steps').innerHTML,/data-step="3"[^>]*disabled/);
});
test('Previously completed responses can reach Step 4 community comparison',()=>{
 const h=harness(async()=>{throw Error('No network required');});
 h.run("record.continuedPages=[1,2,3];state.bottom=orderedGroups()[2].slice();record.firstCompletedAt='2026-11-10T01:00:00Z';record.visitedPages=[1,2,3,4];state.step=2;render()");
 assert.equal(h.run('highestUnlockedStep()'),3);
 h.run('selectPage(3)');
 assert.equal(h.run('state.step'),3);
});
test('Step 3 comparison Continue queues a retryable checkpoint offline',async()=>{
 const h=harness(async()=>{throw Error('Network offline');});
 h.run("record.continuedPages=[1,2];state.bottom=orderedGroups()[2].slice();record.firstCompletedAt='2026-11-10T01:00:00Z';state.step=2;render()");
 assert.equal(h.run('highestUnlockedStep()'),2);
 await h.run('next()');
 assert.equal(h.run('state.step'),3);
 assert.ok(h.run('record.continuedPages.includes(3)'));
 assert.equal(h.run('record.outbox.length'),1);
 assert.equal(h.run('record.outbox[0].eventType'),'results_viewed');
 assert.equal(h.element('save-state').children.at(-1).textContent,'Retry save');
});
test('Server protects saved custom topic ordering and preserves scores',()=>{
 const snap=()=>S.WB.surveyTopics.map(t=>t.code);
 const base=S.canonicalSnapshot({
  sourceVersion:S.M.id,responseId:responseId,
  themeRanking:S.WB.themes.map(t=>t.name),outcomeRanking:S.M.outcomes.map(t=>t.id),
  topSelected:snap().slice(0,6),bottomSelected:snap().slice(-2),
  topicWeights:snap().map((code,i)=>({code,position:i+1,group:S.M.groupNames[i<6?0:i<18?1:2],weight:99})),
  inputEvidence:{continuedPages:[1,2]},connections:[],email:'',notes:'',communications:{}
 },responseId).snapshot;
 const input={...base,topicWeights:base.topicWeights.map(x=>({...x}))};
 [input.topicWeights[0],input.topicWeights[1]]=[input.topicWeights[1],input.topicWeights[0]];
 input.topicWeights.forEach((row,i)=>{row.position=i+1;row.weight=999;});
 const edited=S.canonicalSnapshot(input,responseId).snapshot;
 assert.equal(base.score,edited.score);
 assert.deepEqual(edited.topicOrder.slice(0,2),[base.topicOrder[1],base.topicOrder[0]]);
 assert.equal(edited.topicWeights[0].weight,base.topicWeights[0].weight);
});
