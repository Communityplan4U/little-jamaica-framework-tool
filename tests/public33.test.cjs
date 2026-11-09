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
