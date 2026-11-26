import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function createBenchmarkData(fwRoot=defaultRoot){
const research=path.join(fwRoot,'data/benchmark');
const read=(p)=>fs.readFileSync(p,'utf8');
const fw=JSON.parse(read(`${fwRoot}/data/assessment.json`));
const fm=JSON.parse(read(`${fwRoot}/data/methodology.json`));
const context=vm.createContext({window:{LJOV_ASSESSMENT:fw,LJOV_METHODOLOGY:fm},console});
vm.runInContext(read(`${fwRoot}/public/js/state.js`),context);
vm.runInContext(read(`${fwRoot}/public/js/model.js`),context);
vm.runInContext(read(`${fwRoot}/public/js/app.js`).split('function reportLink')[0],context);
const computed=vm.runInContext('calculate()',context);
const meta=vm.runInContext('({reports:FRAMEWORK_REPORTS,wards:FRAMEWORK_WARDS,teams:FRAMEWORK_RESPONSIBILITIES,defaultAreas:DEFAULT_SUBJECT_ORDER,defaultOutcomes:DEFAULT_OUTCOME_ORDER})',context);
const fwIds=['ljovpf','chinatown','picture-mount-dennis','mount-dennis-community','st-clair-bathurst','bloor','yonge-st-clair','port-lands'];
const fwShort=['Little Jamaica','Chinatown Tomorrow','Picture Mount Dennis','Mount Dennis Community for All','St. Clair & Bathurst','Bloor Street','Yonge–St. Clair','Port Lands'];
const fwDates=['2026 working draft','June 2026','December 2021','November 2025','February 2026','May 2021','December 2019','September 2017'];
const fwYears=[2026,2026,2021,2025,2026,2021,2019,2017];
const fwWards=[[5,8,9,12],[10,11],[5],[5],[12],[9],[12],[14]];
const fwCriteria=computed.criteria.map(c=>({id:c.code,name:c.title,description:c.assesses,summary:c.summary,categoryId:c.code.split('-')[0],category:c.theme,topicId:c.surveyTopicId,defaultWeight:c.weight,localScore:c.score,comparatorVision:c.comparatorVision,comparatorFull:c.comparatorFull,sourceIndex:c.sourceIndex}));
const fwCategories=fw.planningAreas.map(c=>({id:c.prefix,name:c.name,criterionCount:c.criterionCount,topicCount:c.surveyTopicCount,defaultWeight:fwCriteria.filter(k=>k.categoryId===c.prefix).reduce((a,b)=>a+b.defaultWeight,0)}));
const frameworkStudies=fwIds.map((id,index)=>{
 const i=index-1,isReference=index===0,name=isReference?'Little Jamaica & Oakwood Vaughan':fw.comparators[i];
 const ratings=Object.fromEntries(fwCriteria.map(c=>[c.id,{vision:isReference?c.localScore:c.comparatorVision[i],full:isReference?c.localScore:c.comparatorFull[i]}]));
 const scoreVision=isReference?computed.baseline:computed.comparators[i].vision;
 const scoreFull=isReference?computed.baseline:computed.comparators[i].full;
 const categories=fwCategories.map(c=>{
  const items=fwCriteria.filter(k=>k.categoryId===c.id);let vision=0,full=0,baseline=0;
  for(const k of items){vision+=k.defaultWeight*ratings[k.id].vision;full+=k.defaultWeight*ratings[k.id].full;baseline+=k.defaultWeight*k.localScore;}
  return{id:c.id,weight:c.defaultWeight,visionMean:vision/c.defaultWeight,fullMean:full/c.defaultWeight,baselineMean:baseline/c.defaultWeight,visionRelativeMean:(vision-baseline)/c.defaultWeight,fullRelativeMean:(full-baseline)/c.defaultWeight,visionContribution:vision-baseline,fullContribution:full-baseline};
 });
 return {id,name,shortName:fwShort[index],isReference,index:i,documentDate:fwDates[index],documentYear:fwYears[index],documentStatus:isReference?'Working draft':'Comparator document',documentType:isReference?'Draft Community Visioning Statement':index===3?'Community development action plan':'Planning framework',sourceUrl:isReference?meta.reports.local:meta.reports.comparators[i],proposalsUrl:isReference?meta.reports.localProposals:null,wardNumbers:fwWards[index],wardLabel:isReference?meta.wards.local:meta.wards.comparators[name],...(isReference?meta.teams.local:meta.teams.comparators[name]),scores:{vision:{raw:scoreVision,relative:scoreVision-computed.baseline},full:{raw:scoreFull,relative:scoreFull-computed.baseline}},ratings,categories};
});
const td=JSON.parse(read(`${research}/tor-assessment.json`));
const stages=JSON.parse(read(`${research}/document-stages.json`));
for (const study of frameworkStudies) Object.assign(study, stages.studies[study.id] || {});
const tm=JSON.parse(read(`${research}/tor-methodology.json`));
const tc=td.components.map(c=>({...c,defaultWeight:td.areas.find(a=>a.id===c.area).weight/100/td.components.filter(k=>k.area===c.area).length}));
const torStudies=td.comparators.map(b=>{
 const reference=b.id===td.reference_id;
 const evidence=tc.map(c=>{const j=reference?td.judgments.comp1[c.id]:td.judgments[b.id][c.id];return {criterionId:c.id,rating:reference?0:j.rating,localSummary:j.ljovpf_excerpt,comparatorSummary:reference?null:j.comparator_excerpt,rationale:reference?null:j.rationale,sourceSection:reference?j.source_section.split('\nComparator:')[0]:j.source_section,approvalReference:reference?null:j.approval_reference,evidenceFormat:j.evidence_format};});
 const categories=td.areas.map(a=>{const criteria=tc.filter(c=>c.area===a.id);const net=reference?0:criteria.reduce((n,c)=>n+td.judgments[b.id][c.id].rating,0);return{id:a.id,weight:a.weight/100,rawNet:net,rawMax:criteria.length,meanNet:net/criteria.length,weightedNet:12*a.weight/100*net/criteria.length};});
 return{id:b.id,name:b.name,shortName:b.name.replace(' Planning Initiative','').replace(' Planning Study','').replace(' Apartment Neighbourhood Character Study','').replace(' Special Study Area (Midtown)','').replace(' Initiative','').replace(' Study',''),body:b.body,isReference:reference,sourceUrl:b.url,studyUrl:b.study_url||null,sourceState:b.source_state,documentDate:null,documentYear:null,documentStatus:'Assessed TOR',score:categories.reduce((n,c)=>n+c.weightedNet,0),categories,ratings:Object.fromEntries(evidence.map(e=>[e.criterionId,e.rating])),evidence};
});
const out={
 schemaVersion:1,generatedOn:'2026-11-26',
 framework:{title:'Planning frameworks',referenceId:'ljovpf',sourceSite:'https://little-jamaica-framework-tool.vercel.app/',sourceRepository:'https://github.com/Communityplan4U/little-jamaica-framework-tool',sourceFile:fw.filename,methodologyId:fm.id,scoringMode:'relative',rawScale:{min:1,max:5,labels:fw.assessmentScale},relativeScale:{min:-4,max:4},defaultScope:'vision',defaultWeightsLabel:'Original tool’s starting priorities',defaultOrder:meta.defaultAreas,defaultOutcomeOrder:meta.defaultOutcomes,weightingNote:'Starting priorities from the source tool, not survey response averages. Six high-priority topics receive 10% each; twelve middle topics receive 37/12% each; two lower topics receive 1.5% each. A topic’s weight is divided equally across its linked detailed criteria.',methodology:fm,baseline:computed.baseline,defaultGroups:computed.groups,categories:fwCategories,topics:computed.topics.map(t=>({id:t.code,name:t.title,categoryId:fwCategories.find(c=>c.name===t.theme).id,description:t.summary,criterionIds:t.criterionCodes,defaultWeight:t.weight,group:t.group,groupIndex:t.groupIndex})),criteria:fwCriteria,studies:frameworkStudies,evidenceNote:'Framework data includes criterion ratings, assessment definitions and linked source documents. Criterion-level page citations or evidence excerpts are not supplied in the published machine-readable data.',comparisonNote:'Little Jamaica is assessed from a preliminary working draft Community Visioning Statement. The full-document view compares that working draft with the full comparator documents. The reference zero is a comparison baseline, not a quality score of zero.'},
 tor:{title:'Advisory committee TOR',referenceId:td.reference_id,sourceRepository:'https://github.com/Communityplan4U/LJOVPF-SAC_TOR',sourceFile:td.assessment_source_workbook,methodologyId:td.assessment_revision,approvedOn:td.approved_on,scoringMode:'relative',relativeScale:{min:-12,max:12},defaultWeightsLabel:'Approved governance priorities',weightingNote:tm.method,methodology:tm,categories:td.areas.map(a=>({id:a.id,name:a.name,defaultWeight:a.weight/100,criterionCount:tc.filter(c=>c.area===a.id).length})),criteria:tc,studies:torStudies,evidenceNote:td.assessment_evidence_note,comparisonNote:'Net weighted comparison of written TOR provisions against Little Jamaica. Positive scores favour the comparator. Zero marks Little Jamaica as the reference; it is not a quality score. The data assesses written rules, not implementation, legal compliance, staff or councillor performance.'}
};
for(const group of [out.framework.studies,out.tor.studies])for(const s of group)s.defaultRank=1+group.filter(t=>(t.score??t.scores.vision.relative)>(s.score??s.scores.vision.relative)+1e-9).length;
return out;
}
