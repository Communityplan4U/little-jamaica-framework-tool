// Calculation layer extracted from the approved trial.
function startingCalc(boosts=outcomeFactors()){
 const rankScores=Object.fromEntries(state.ranking.map((name,i)=>[name,RANK_POINTS[i]]));
 const rows=WB.topics.map((t,i)=>{
  const matched=TOPIC_OUTCOMES[t.code];
  const values=boosts?matched.map(id=>({id,multiplier:boosts[id]??1})).sort((a,b)=>b.multiplier-a.multiplier||state.outcomeRanking.indexOf(a.id)-state.outcomeRanking.indexOf(b.id)):[];
  const used=values.slice(0,3).map((x,i)=>({...x,divisor:METHOD.overlapDivisors[i],contribution:x.multiplier/METHOD.overlapDivisors[i]}));
  const effectiveMultiplier=used.length?sum(used.map(x=>x.contribution)):1;
  return {...t,sourceIndex:i,rankPoints:rankScores[t.theme],effectiveMultiplier,appliedComponents:used,
   outcomeFactor:effectiveMultiplier,rawFactor:rankScores[t.theme]*effectiveMultiplier,baseWeight:0};
 });
 const denominator=sum(rows.map(t=>t.rawFactor));
 rows.forEach(t=>t.baseWeight=t.rawFactor/denominator);
 const shares=Object.fromEntries(WB.themes.map(th=>[th.name,sum(rows.filter(t=>t.theme===th.name).map(t=>t.baseWeight))]));
 const initialOrder=rows.slice().sort((a,b)=>(b.rawFactor-a.rawFactor)||(a.sourceIndex-b.sourceIndex)).map(t=>t.code);
 return {shares,rankScores,rows,initialOrder,byWeight:Object.fromEntries(rows.map(t=>[t.code,t.baseWeight])),boosts};
}
function assignBands(base,decisions=state.decisions){
 const groups=BAND_COUNTS.map(()=>[]);
 const assigned=new Set();
 const fixed=Object.entries(decisions).filter(([code,d])=>d.kind==='pin'&&byCode[code]);
 for(const [code,d] of fixed){
  if(d.band<0||d.band>2)throw Error('Unsupported pinned priority group');
  groups[d.band].push(code);assigned.add(code);
 }
 for(let b=0;b<BAND_COUNTS.length;b++){
  if(groups[b].length>BAND_COUNTS[b])throw Error('Too many confirmed items for '+BAND_NAMES[b]);
  for(const code of base.initialOrder){
   if(groups[b].length>=BAND_COUNTS[b])break;
   if(assigned.has(code))continue;
   const d=decisions[code];
   const minimum=d&&d.kind==='min'?d.band:0;
   if(minimum>b)continue;
   groups[b].push(code);assigned.add(code);
  }
  if(groups[b].length!==BAND_COUNTS[b])throw Error('Not enough eligible topics in '+BAND_NAMES[b]);
 }
 if(assigned.size!==WB.topics.length)throw Error('Some topics were not assigned to a group');
 return groups;
}
function preferenceSignature(){return JSON.stringify({theme:state.ranking,outcomes:state.outcomeRanking,choices:state.decisions});}
function syncEditorPreferences(){
 const sig=preferenceSignature();
 if(state.editorSignature!==sig){
  if(state.editorMoves.length)state.flash='The custom topic movements were reset because an earlier priority changed.';
  state.editorSignature=sig;state.editorGroups=null;state.editorHistory=[];state.editorMoves=[];state.moveDraft=null;
 }
}
function validateGroups(groups){
 if(!Array.isArray(groups)||groups.length!==6||groups.some((g,i)=>g.length!==BAND_COUNTS[i]))throw Error('Group sizes no longer match the six-band method');
 const all=groups.flat();if(all.length!==WB.topics.length||new Set(all).size!==all.length||all.some(code=>!byCode[code]))throw Error('Duplicate or missing topic in manual group assignments');
}
function calc(){
 const baseAt1=startingCalc(null);
 const base=startingCalc(outcomeFactors());
 const groupsAt1=assignBands(baseAt1,{});
 const groupsAt2=assignBands(base,{});
 syncEditorPreferences();
 const automaticGroups=assignBands(base,state.decisions);
 const groups=state.editorGroups?state.editorGroups.map(x=>x.slice()):automaticGroups;
 validateGroups(groups);
 const baselineWeightMap=groupMap(groupsAt1);
 const afterMultiplierWeightMap=groupMap(groupsAt2);
 const finalWeightMap=groupMap(groups);
 const rankOrder=groups.flat(),lookup={};
 groups.forEach((codes,b)=>codes.forEach((code,i)=>lookup[code]={band:b,rank:1+BAND_COUNTS.slice(0,b).reduce((sum,n)=>sum+n,0)+i,weight:bandWeight(b)}));
 const baseLookup=Object.fromEntries(base.rows.map(t=>[t.code,t]));
 const topics=WB.topics.map(t=>({...t,...lookup[t.code],baseWeight:base.byWeight[t.code],manual:state.decisions[t.code]||null,appliedBoost:baseLookup[t.code].effectiveMultiplier,appliedComponents:baseLookup[t.code].appliedComponents,outcomes:TOPIC_OUTCOMES[t.code]}));
 const equalTopic=sum(topics.map(t=>t.score))/topics.length;
 const equalTheme=sum(WB.themes.map(th=>sum(topics.filter(t=>t.theme===th.name).map(t=>t.score))/th.count))/WB.themes.length;
 const initialScore=sum(WB.topics.map(t=>baselineWeightMap[t.code]*t.score));
 const afterMultiplierScore=sum(WB.topics.map(t=>afterMultiplierWeightMap[t.code]*t.score));
 const current=sum(topics.map(t=>t.weight*t.score));
 const comparators=WB.comparators.map((name,i)=>({name,vision:sum(topics.map(t=>t.weight*t.comparatorVision[i])),full:sum(topics.map(t=>t.weight*t.comparatorFull[i]))}));
 const actualShares=Object.fromEntries(WB.themes.map(th=>[th.name,sum(topics.filter(t=>t.theme===th.name).map(t=>t.weight))]));
 const bandSummaries=groups.map((codes,b)=>({band:b,name:BAND_NAMES[b],range:BAND_RANGES[b],count:codes.length,weight:bandWeight(b),share:groupWeight(b),average:sum(codes.map(code=>byCode[code].score))/codes.length,contribution:sum(codes.map(code=>byCode[code].score*bandWeight(b)))}));
 const topicImpacts=topics.map(t=>({...t,equalContribution:(t.weight-1/WB.topics.length)*(t.score-equalTopic),multiplierContribution:(afterMultiplierWeightMap[t.code]-baselineWeightMap[t.code])*(t.score-initialScore),manualContribution:(t.weight-afterMultiplierWeightMap[t.code])*(t.score-afterMultiplierScore),initialWeight:baselineWeightMap[t.code],afterMultiplierWeight:afterMultiplierWeightMap[t.code]}));
 const at1=groupIndexMap(groupsAt1),at2=groupIndexMap(groupsAt2);
 const movesBetween=(a,b)=>WB.topics.map(t=>({code:t.code,title:t.title,theme:t.theme,from:a[t.code],to:b[t.code],linked:t.components.includes(2),outcomes:TOPIC_OUTCOMES[t.code]})).filter(t=>t.from!==t.to).sort((x,y)=>Math.abs(y.to-y.from)-Math.abs(x.to-x.from)||x.code.localeCompare(y.code));
 return {base,baseAt1,groups,groupsAt1,groupsAt2,rankOrder,topics,byCode:Object.fromEntries(topics.map(t=>[t.code,t])),current,comparators,baseline:afterMultiplierScore,initialScore,afterMultiplierScore,equalTopic,equalTheme,actualShares,bandSummaries,total:sum(topics.map(t=>t.weight)),baselineWeightMap,afterMultiplierWeightMap,finalWeightMap,topicImpacts,multiplierMoves:movesBetween(at1,at2)};
}
function groupMap(groups){
 const r={};groups.forEach((codes,b)=>codes.forEach(code=>{r[code]=bandWeight(b);}));return r;
}
function groupIndexMap(groups){
 const r={};groups.forEach((codes,b)=>codes.forEach(code=>{r[code]=b;}));return r;
}

function simulateInsertion(c,code,toRank){
 const order=c.groups.flat(),fromRank=order.indexOf(code)+1;
 if(!fromRank||toRank<1||toRank>order.length)throw Error('Invalid topic position');
 order.splice(fromRank-1,1);order.splice(toRank-1,0,code);
 const groups=[],changed=[];let k=0;
 BAND_COUNTS.forEach(n=>{groups.push(order.slice(k,k+n));k+=n;});
 validateGroups(groups);
 const oldIndex=groupIndexMap(c.groups),newIndex=groupIndexMap(groups);
 for(const t of WB.topics){if(oldIndex[t.code]!==newIndex[t.code])changed.push({code:t.code,oldBand:oldIndex[t.code],newBand:newIndex[t.code]});}
 const newWeights=groupMap(groups);
 const newScore=sum(WB.topics.map(t=>t.score*newWeights[t.code]));
 return {groups,changed,fromRank,toRank,shiftCount:Math.abs(toRank-fromRank),newScore};
}
