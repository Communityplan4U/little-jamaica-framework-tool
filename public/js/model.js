'use strict';
// Themes and outcomes propose ten highest topics; participants can demote suggestions and select four lowest from the middle.
const outcomeCodes=Object.fromEntries(OUTCOMES.map(k=>[k,WB.topics.filter(t=>t.outcomeFlags[k]===1).map(t=>t.code)]));
function outcomeFactors(){return Object.fromEntries(state.outcomeRanking.map((id,i)=>[id,METHOD.outcomeRankMultipliers[i]]));}
function suggestions(){
 const th=Object.fromEntries(state.ranking.map((name,i)=>[name,METHOD.themeRankPoints[i]]));
 const out=outcomeFactors();
 const vals=WB.topics.map(t=>{
  const components=OUTCOMES.filter(id=>t.outcomeFlags[id]===1).map(id=>out[id]).sort((a,b)=>b-a).slice(0,3);
  let factor=components.length?components.reduce((total,x,i)=>total+x/METHOD.overlapDivisors[i],0):1;
  return {code:t.code,score:th[t.theme]*factor,title:t.title};
 });
 // The tie-break is alphabetical by topic code, never spreadsheet position.
 return vals.sort((a,b)=>b.score-a.score||a.code.localeCompare(b.code)).map(x=>x.code);
}
// The first ten eligible suggestions form the highest group. Demotions are never
// promoted again automatically; an eligible replacement takes the vacated place.
function suggestedTop(){
 const excluded=new Set([...(state.excludedTop||[]),...state.bottom]);
 return suggestions().filter(code=>!excluded.has(code)).slice(0,10);
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
 return {type:'Little Jamaica community weighting survey',version:'ljov-33-public-v2',sourceVersion:METHOD.id,
  responseId:record?.responseId,themeRanking:state.ranking.slice(),outcomeRanking:state.outcomeRanking.slice(),
  topSelected:state.top.slice(),bottomSelected:state.bottom.slice(),excludedTop:state.excludedTop.slice(),
   selectionMethod:'suggested-top10-middle-review',
  connections:state.connections.slice(),email:state.email.trim(),
  communications:{resultsUpdates:!!state.email.trim(),newsletter:state.newsletterOptIn,littleJamaicaUpdates:state.planningOptIn},
  topicWeights:c.topics.map(t=>({code:t.code,position:t.position,group:t.group,weight:t.weight})),
  comparisonScope:state.scope,notes:state.feedback,
  inputEvidence:{continuedPages:pages,coreStepsCompleted:state.top.length===10&&state.bottom.length===4&&[1,2,3,4].every(n=>pages.includes(n))}};
}
