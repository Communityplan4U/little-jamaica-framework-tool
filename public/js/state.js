
'use strict';
const WB=window.LJOV_ASSESSMENT;
const METHOD=window.LJOV_METHODOLOGY;
const RANK_POINTS=METHOD.themeRankPoints;
const BAND_COUNTS=METHOD.groupCounts;
if(BAND_COUNTS.reduce((a,b)=>a+b,0)!==WB.topics.length)throw Error('Group sizes must cover every evaluation topic');
// Provisional TOTAL share allocated to each group, highest to lowest.
// Chosen so BOTH collective group shares and per-topic weights descend.
const BAND_FACTORS=METHOD.groupShares;
const BAND_NAMES=METHOD.groupNames;
const BAND_MATH_NAMES=METHOD.groupInternalLabels;
const BAND_RANGES=BAND_COUNTS.map((n,i)=>{const start=BAND_COUNTS.slice(0,i).reduce((a,v)=>a+v,0)+1;return `${start}-${start+n-1}`;});
const FACTOR_TOTAL=BAND_FACTORS.reduce((a,b)=>a+b,0);
const fmt=(n,p=1)=>Number(n).toFixed(p);
const sum=a=>a.reduce((n,x)=>n+x,0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byCode=Object.fromEntries(WB.topics.map((t,i)=>[t.code,{...t,sourceIndex:i}]));
// All five outcome memberships come directly from the user-authored Topics!G:K flags.
const OUTCOMES=METHOD.outcomes.map(o=>({...o,codes:WB.topics.filter(t=>t.outcomeFlags[o.id]===1).map(t=>t.code)}));
// Prototype rank conversion: five positions at evenly spaced multipliers. Review before public use.
const OUTCOME_RANK_FACTORS=METHOD.outcomeRankMultipliers;
const TOPIC_OUTCOMES=Object.fromEntries(WB.topics.map(t=>[t.code,OUTCOMES.filter(o=>t.outcomeFlags[o.id]===1).map(o=>o.id)]));
const TRACKING_CONFIG=window.LJOV_CONFIG||{}; // Empty by default: offline trial. Same-origin collection only.
const state={page:0,ranking:WB.themes.map(t=>t.name),outcomeRanking:OUTCOMES.map(o=>o.id),decisions:{},history:[],scope:'vision',movedTheme:false,movedOutcomes:false,picker:null,flash:'',refineBand:0,gapSelected:[],gapSearch:'',gapPage:0,gapPromotions:[],editorGroups:null,editorSignature:null,editorHistory:[],editorMoves:[],editorQuery:'',editorFilter:'all',editorPage:0,explainPlan:null,communityView:'topics',communityData:null,communityLoading:false,communityError:'',communityFetchedAt:0,moveDraft:null,feedback:'',connections:[],email:'',newsletterOptIn:false,planningOptIn:false,resultsMode:'gap',matrixWeighting:'weighted',completed:false,submissionReceipt:'',modalFocusReturn:null};
const outcomeFactors=(order=state.outcomeRanking)=>Object.fromEntries(order.map((id,i)=>[id,OUTCOME_RANK_FACTORS[i]]));
const bandWeight=b=>(BAND_FACTORS[b]/FACTOR_TOTAL)/BAND_COUNTS[b];
const groupWeight=b=>BAND_FACTORS[b]/FACTOR_TOTAL;
// Highest multiplier in full; second at 1/8; third at 1/16. No topic currently maps to >3.
// Null input intentionally removes all Page 2 outcome effects, for a true Page 1-only baseline.
