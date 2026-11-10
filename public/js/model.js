'use strict';
// Twenty public survey topics group all 33 source criteria; none is discarded.
const criterionByCode=Object.fromEntries(WB.topics.map(t=>[t.code,t]));
const topicByCode=Object.fromEntries(WB.surveyTopics.map(t=>[t.code,t]));
const assessedSurveyTopics=WB.surveyTopics.map(t=>{
 const criteria=t.criterionCodes.map(code=>criterionByCode[code]);
 if(criteria.some(x=>!x))throw Error('Survey topic references a missing assessment criterion: '+t.code);
 const n=criteria.length;
 return {...t,score:sum(criteria.map(c=>c.score))/n,
  comparatorVision:WB.comparators.map((_,i)=>sum(criteria.map(c=>c.comparatorVision[i]))/n),
  comparatorFull:WB.comparators.map((_,i)=>sum(criteria.map(c=>c.comparatorFull[i]))/n)};
});
const outcomeCodes=Object.fromEntries(OUTCOMES.map(id=>[id,WB.surveyTopics.filter(t=>t.outcomeFlags[id]>0).map(t=>t.code)]));
// Planning Area and outcome ranks suggest six highest topics. An outcome can
// cover only some of a combined survey topic's underlying assessment criteria.
function suggestionScores(){
 const themePoints=METHOD.themeRankPoints,outcomePoints=METHOD.outcomeRankPoints;
 const tMin=Math.min(...themePoints),tSpan=Math.max(...themePoints)-tMin;
 const oMin=Math.min(...outcomePoints),oSpan=Math.max(...outcomePoints)-oMin;
 const mix=METHOD.suggestionBlend;
 if(tSpan<=0||oSpan<=0||Math.abs(mix.themes+mix.outcomes-1)>1e-12)
  throw Error('Invalid ranking normalization.');
 const th=Object.fromEntries(state.ranking.map((name,i)=>[name,(themePoints[i]-tMin)/tSpan]));
 const out=Object.fromEntries(state.outcomeRanking.map((id,i)=>[id,(outcomePoints[i]-oMin)/oSpan]));
 return WB.surveyTopics.map(t=>{
  const allocation=sum(OUTCOMES.map(id=>t.outcomeFlags[id]||0));
  if(Math.abs(allocation-1)>1e-10)throw Error('Invalid community outcome allocation: '+t.code);
  const outcomeScore=sum(OUTCOMES.map(id=>(t.outcomeFlags[id]||0)*out[id]));
  return {code:t.code,score:100*(mix.themes*th[t.theme]+mix.outcomes*outcomeScore),title:t.title};
 });
}
function suggestions(){
 return suggestionScores().sort((a,b)=>b.score-a.score||a.code.localeCompare(b.code)).map(x=>x.code);
}
function suggestedTop(){
 const excluded=new Set([...(state.excludedTop||[]),...state.bottom]);
 const promoted=[...new Set(state.promotedTop||[])].filter(code=>byCode[code]&&!excluded.has(code)).slice(0,COUNTS[0]);
 const next=suggestions().filter(code=>!excluded.has(code)&&!promoted.includes(code));
 return [...promoted,...next].slice(0,COUNTS[0]);
}
function syncTop(){state.top=suggestedTop();return state.top;}
function orderedGroups(){
 const proposed=suggestions(),top=syncTop().slice(),bottom=state.bottom.slice(),used=new Set([...top,...bottom]);
 // A provisional lowest group makes interim checkpoints computable.
 for(const code of proposed.slice().reverse()){
  if(bottom.length>=COUNTS[2])break;
  if(!used.has(code)){bottom.unshift(code);used.add(code);}
 }
 const middle=proposed.filter(code=>!used.has(code));
 return [top,middle,bottom];
}
function calculate(){
 const groups=orderedGroups();
 if(groups.some((g,i)=>g.length!==COUNTS[i]))throw Error('Incorrect survey topic priority group sizes.');
 const info={};let pos=0;
 groups.forEach((g,i)=>g.forEach(code=>{info[code]={position:++pos,group:PRIORITY_NAMES[i],groupIndex:i,weight:weights[i]};}));
 const topics=assessedSurveyTopics.map(t=>({...t,...info[t.code]}));
 const criteria=topics.flatMap(t=>t.criterionCodes.map(code=>({...criterionByCode[code],
  surveyTopicId:t.code,planningArea:t.theme,weight:t.weight/t.criterionCodes.length})));
 const baseline=sum(criteria.map(t=>t.weight*t.score));
 const comparators=WB.comparators.map((name,j)=>({
  name,vision:sum(criteria.map(t=>t.weight*t.comparatorVision[j])),
  full:sum(criteria.map(t=>t.weight*t.comparatorFull[j]))
 }));
 return {groups,topics,criteria,baseline,comparators,byCode:Object.fromEntries(topics.map(t=>[t.code,t]))};
}
function snapshot(){
 const c=calculate(),pages=record?.continuedPages||[];
 return {type:'Little Jamaica community weighting survey',version:'ljov-20-public-v1',sourceVersion:METHOD.id,
  responseId:record?.responseId,themeRanking:state.ranking.slice(),outcomeRanking:state.outcomeRanking.slice(),
  topSelected:state.top.slice(),bottomSelected:state.bottom.slice(),excludedTop:state.excludedTop.slice(),
  promotedTop:state.promotedTop.slice(),
  selectionMethod:'suggested-top6-middle-review',
  connections:state.connections.slice(),email:state.email.trim(),
  communications:{resultsUpdates:!!state.email.trim(),newsletter:state.newsletterOptIn,littleJamaicaUpdates:state.planningOptIn},
  topicWeights:c.topics.map(t=>({code:t.code,position:t.position,group:t.group,weight:t.weight})),
  comparisonScope:state.scope,notes:state.feedback,
  inputEvidence:{continuedPages:pages,coreStepsCompleted:state.top.length===COUNTS[0]&&state.bottom.length===COUNTS[2]&&[1,2,3,4].every(n=>pages.includes(n))}};
}
