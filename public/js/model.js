'use strict';
// Seven theme ranks and six mutually exclusive outcome ranks propose ten highest topics; participants may revise them.
const outcomeCodes=Object.fromEntries(OUTCOMES.map(k=>[k,WB.topics.filter(t=>t.outcomeFlags[k]===1).map(t=>t.code)]));
// Suggestion scores use separately normalized theme and outcome ranks.
// This affects provisional ordering only, never the 60/37/3 final group weights.
function suggestionScores(){
 const themePoints=METHOD.themeRankPoints,outcomePoints=METHOD.outcomeRankPoints;
 const tMin=Math.min(...themePoints),tSpan=Math.max(...themePoints)-tMin;
 const oMin=Math.min(...outcomePoints),oSpan=Math.max(...outcomePoints)-oMin;
 const mix=METHOD.suggestionBlend;
 if(tSpan<=0||oSpan<=0||Math.abs(mix.themes+mix.outcomes-1)>1e-12)throw Error('Invalid ranking normalization.');
 const th=Object.fromEntries(state.ranking.map((name,i)=>[name,(themePoints[i]-tMin)/tSpan]));
 const out=Object.fromEntries(state.outcomeRanking.map((id,i)=>[id,(outcomePoints[i]-oMin)/oSpan]));
 return WB.topics.map(t=>{
  const assigned=OUTCOMES.filter(id=>t.outcomeFlags[id]===1);
  if(assigned.length!==1)throw Error('Each assessment topic must have exactly one outcome.');
  return {code:t.code,score:100*(mix.themes*th[t.theme]+mix.outcomes*out[assigned[0]]),title:t.title};
 });
}
function suggestions(){
 // Ties resolve alphabetically by code, not workbook row position.
 return suggestionScores().sort((a,b)=>b.score-a.score||a.code.localeCompare(b.code)).map(x=>x.code);
}
// The first ten eligible suggestions form the highest group. Demotions are never
// promoted again automatically; an eligible replacement takes the vacated place.
function suggestedTop(){
 const excluded=new Set([...(state.excludedTop||[]),...state.bottom]);
 const promoted=[...new Set(state.promotedTop||[])].filter(code=>byCode[code]&&!excluded.has(code)).slice(0,10);
 const next=suggestions().filter(code=>!excluded.has(code)&&!promoted.includes(code));
 return [...promoted,...next].slice(0,10);
}
function syncTop(){state.top=suggestedTop();return state.top;}
function orderedGroups(){
 const proposed=suggestions(),top=syncTop().slice(),bottom=state.bottom.slice(),used=new Set([...top,...bottom]);
 // Before Step 4 is finished, provide a provisional lowest-four for partial saves.
 for(const code of proposed.slice().reverse()){
  if(bottom.length>=4)break;
  if(!used.has(code)){bottom.unshift(code);used.add(code);}
 }
 const middle=proposed.filter(code=>!used.has(code));
 return [top,middle,bottom];
}
function calculate(){
 const groups=orderedGroups();
 if(groups.map(g=>g.length).join(',')!=='10,19,4')throw Error('Priority groups must contain ten, nineteen and four topics.');
 const info={};let pos=0;
 groups.forEach((g,i)=>g.forEach(code=>{info[code]={position:++pos,group:PRIORITY_NAMES[i],groupIndex:i,weight:weights[i]};}));
 const topics=WB.topics.map(t=>({...t,...info[t.code]}));
 const baseline=sum(topics.map(t=>t.weight*t.score));
 const comparators=WB.comparators.map((name,j)=>({
  name,vision:sum(topics.map(t=>t.weight*t.comparatorVision[j])),
  full:sum(topics.map(t=>t.weight*t.comparatorFull[j]))
 }));
 return {groups,topics,baseline,comparators,byCode:Object.fromEntries(topics.map(t=>[t.code,t]))};
}
function snapshot(){
 const c=calculate(),pages=record?.continuedPages||[];
 return {type:'Little Jamaica community weighting survey',version:'ljov-33-public-v4',sourceVersion:METHOD.id,
  responseId:record?.responseId,themeRanking:state.ranking.slice(),outcomeRanking:state.outcomeRanking.slice(),
  topSelected:state.top.slice(),bottomSelected:state.bottom.slice(),excludedTop:state.excludedTop.slice(),
  promotedTop:state.promotedTop.slice(),
   selectionMethod:'suggested-top10-middle-review',
  connections:state.connections.slice(),email:state.email.trim(),
  communications:{resultsUpdates:!!state.email.trim(),newsletter:state.newsletterOptIn,littleJamaicaUpdates:state.planningOptIn},
  topicWeights:c.topics.map(t=>({code:t.code,position:t.position,group:t.group,weight:t.weight})),
  comparisonScope:state.scope,notes:state.feedback,
  inputEvidence:{continuedPages:pages,coreStepsCompleted:state.top.length===10&&state.bottom.length===4&&[1,2,3,4].every(n=>pages.includes(n))}};
}
