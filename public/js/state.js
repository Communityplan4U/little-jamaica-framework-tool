'use strict';
const WB=window.LJOV_ASSESSMENT,METHOD=window.LJOV_METHODOLOGY;
const THEMES=WB.themes.map(t=>t.name),OUTCOMES=METHOD.outcomes.map(t=>t.id),CODES=WB.topics.map(t=>t.code);
const byCode=Object.fromEntries(WB.topics.map(t=>[t.code,t]));
const PRIORITY_NAMES=METHOD.groupNames,COUNTS=METHOD.groupCounts,SHARES=METHOD.groupShares;
const weights=SHARES.map((share,i)=>share/100/COUNTS[i]);
const configs=window.LJOV_CONFIG||{};
// Initial ordering translated from the October 21, 2026 Little Jamaica Survey Findings.
// The source survey ranked five ACTION AREAS (Housing 25%, Governance 22%,
// Employment 19%, Culture 17%, Space 17% of top-four/ten selections);
// it did not ask people to rank these seven subjects or six outcomes.
// Housing and community control also led the single-first-choice findings.
// This crosswalk is a starting suggestion, NOT a direct measured ranking.
// Do not reorder THEMES/OUTCOMES: their canonical workbook/method IDs are stable.
// Saved and resumed respondents retain their own prior rankings.
const DEFAULT_SUBJECT_ORDER=[
 'Housing',
 'Rights and equity',
 'Delivery',
 'Economic opportunity',
 'Community and public spaces',
 'Culture and identity',
 'Acknowledgement'
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
 throw Error('Survey findings defaults do not match the authoritative subjects and outcomes');
const state={step:0,ranking:DEFAULT_SUBJECT_ORDER.slice(),outcomeRanking:DEFAULT_OUTCOME_ORDER.slice(),
  top:[],bottom:[],excludedTop:[],promotedTop:[],topicSearch:'',email:'',newsletterOptIn:false,planningOptIn:false,connections:[],
  feedback:'',scope:'vision',communityView:'topics',community:null,communityError:'',loading:false,complete:false,flash:''};
const fmt=(n,d=1)=>Number(n).toFixed(d);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const sum=a=>a.reduce((n,x)=>n+x,0);
