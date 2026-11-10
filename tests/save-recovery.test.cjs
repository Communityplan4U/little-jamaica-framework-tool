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
 assert.match(h.element('save-state').textContent,/Saved online/);
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
 assert.match(h.element('notice').textContent,/stored on this device/);
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
 assert.match(h.element('save-state').textContent,/Saved online/);
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
 assert.match(h.element('notice').textContent,/not been confirmed/);
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
 assert.match(h.element('collection-status').textContent,/temporarily unavailable/);
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
