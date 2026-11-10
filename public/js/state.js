'use strict';
const WB=window.LJOV_ASSESSMENT,METHOD=window.LJOV_METHODOLOGY;
const THEMES=WB.themes.map(t=>t.name),OUTCOMES=METHOD.outcomes.map(t=>t.id),CODES=WB.surveyTopics.map(t=>t.code);
const byCode=Object.fromEntries(WB.surveyTopics.map(t=>[t.code,t]));
const PRIORITY_NAMES=METHOD.groupNames,COUNTS=METHOD.groupCounts,SHARES=METHOD.groupShares;
const weights=SHARES.map((share,i)=>share/100/COUNTS[i]);
const configs=window.LJOV_CONFIG||{};
// Initial Planning Area ordering is a qualitative interpretation of the October 2026
// five-action-area survey, not a directly measured ranking of these six areas.
// Distinct Indigenous rights and other human rights obligations are not optional.
const DEFAULT_SUBJECT_ORDER=[
 'Housing and remaining rooted',
 'Community power and implementation',
 'Local economy and community wealth',
 'Culture, history and belonging',
 'Everyday needs and environment',
 'Rights, recognition and reparative justice'
];
const DEFAULT_OUTCOME_ORDER=[
 'wellbeing', // Affordability and everyday living conditions
 'remain',    // Housing stability, protections and right of return
 'power',     // Community approval and resident decision-making
 'coord',     // Funded action, accountability and follow-through
 'wealth',    // Local jobs, commercial affordability and ownership
 'belong'     // Cultural continuity and participation
];
if(DEFAULT_SUBJECT_ORDER.length!==THEMES.length||
   new Set(DEFAULT_SUBJECT_ORDER).size!==THEMES.length||
   !DEFAULT_SUBJECT_ORDER.every(name=>THEMES.includes(name))||
   DEFAULT_OUTCOME_ORDER.length!==OUTCOMES.length||
   new Set(DEFAULT_OUTCOME_ORDER).size!==OUTCOMES.length||
   !DEFAULT_OUTCOME_ORDER.every(id=>OUTCOMES.includes(id)))
 throw Error('Survey findings defaults do not match the authoritative Planning Areas and outcomes');
const state={step:0,ranking:DEFAULT_SUBJECT_ORDER.slice(),outcomeRanking:DEFAULT_OUTCOME_ORDER.slice(),
  top:[],bottom:[],excludedTop:[],promotedTop:[],topicOrder:[],topicSearch:'',email:'',newsletterOptIn:false,planningOptIn:false,connections:[],
  feedback:'',scope:'vision',communityView:'topics',community:null,communityError:'',loading:false,complete:false,flash:''};
const fmt=(n,d=1)=>Number(n).toFixed(d);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const sum=a=>a.reduce((n,x)=>n+x,0);
