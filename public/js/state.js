'use strict';
const WB=window.LJOV_ASSESSMENT,METHOD=window.LJOV_METHODOLOGY;
const THEMES=WB.themes.map(t=>t.name),OUTCOMES=METHOD.outcomes.map(t=>t.id),CODES=WB.topics.map(t=>t.code);
const byCode=Object.fromEntries(WB.topics.map(t=>[t.code,t]));
const PRIORITY_NAMES=METHOD.groupNames,COUNTS=METHOD.groupCounts,SHARES=METHOD.groupShares;
const weights=SHARES.map((share,i)=>share/100/COUNTS[i]);
const configs=window.LJOV_CONFIG||{};
const state={step:0,ranking:THEMES.slice(),outcomeRanking:OUTCOMES.slice(),
  top:[],bottom:[],excludedTop:[],email:'',newsletterOptIn:false,planningOptIn:false,connections:[],
  feedback:'',scope:'vision',communityView:'topics',community:null,communityError:'',loading:false,complete:false,flash:''};
const fmt=(n,d=1)=>Number(n).toFixed(d);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const sum=a=>a.reduce((n,x)=>n+x,0);
