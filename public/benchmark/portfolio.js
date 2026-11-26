(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BenchmarkPortfolio=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const RECENCY_SHARE=.66;
  // YYYYMM ordering keys, not claimed exact issue dates. Year-only records
  // use YYYY00. The 2026 Little Jamaica draft follows February 2026;
  // TOR order is provisional for Little Jamaica and Weston (see methodology).
  const order=Object.freeze({
    framework:Object.freeze({'ljovpf':202611,'chinatown':202606,'picture-mount-dennis':202112,'mount-dennis-community':202511,'st-clair-bathurst':202602,'bloor':202105,'yonge-st-clair':201912,'port-lands':201709}),
    tor:Object.freeze({'ljovpf':202600,'comp1':202500,'comp2':202510,'comp3':202300,'comp4':202000,'comp5':201712,'comp6':202100,'comp7':202105,'comp8':201408,'comp9':202100,'comp10':0})
  });
  const sum=xs=>xs.reduce((s,x)=>s+x,0);
  const compare=(a,b)=>b.score-a.score||a.person.name.localeCompare(b.person.name);
  function rank(studies,directory,view){
    if(!order[view]||!Array.isArray(studies)||!Array.isArray(directory?.people)||!directory.mapping?.[view])throw Error('Missing portfolio data.');
    const people=new Map(directory.people.map(p=>[p.id,p])),groups=new Map();
    const seen=new Set();
    for(const study of studies){
      if(seen.has(study.id))throw Error('Duplicate study: '+study.id);
      seen.add(study.id);
      if(!Number.isFinite(study.value))throw Error('Invalid study score: '+study.id);
      const mapping=directory.mapping[view][study.id];
      if(!mapping||!Array.isArray(mapping.historical))throw Error('Missing study-period representation: '+study.id);
      const ids=[...new Set(mapping.historical)];
      if(!ids.length)continue; // Citywide, not a local councillor portfolio.
      const date=order[view][study.id];
      if(!Number.isFinite(date)||date<=0)throw Error('Missing recency order: '+study.id);
      for(const id of ids){
        if(!people.has(id))throw Error('Unknown study-period councillor: '+id);
        if(!groups.has(id))groups.set(id,[]);
        groups.get(id).push({study,mapping,ids,date,sharedCount:ids.length});
      }
    }
    const rows=[];
    for(const [id,projects] of groups){
      projects.sort((a,b)=>b.date-a.date||a.study.name.localeCompare(b.study.name));
      const latest=projects.filter(p=>p.date===projects[0].date).length;
      const older=projects.length-latest;
      const raw=projects.map((p,i)=>{
        const baseWeight=older===0?1/projects.length:i<latest?RECENCY_SHARE/latest:(1-RECENCY_SHARE)/older;
        return {...p,baseWeight,adjustedWeight:baseWeight/p.sharedCount,isLatest:i<latest};
      });
      const total=sum(raw.map(p=>p.adjustedWeight));
      const weighted=raw.map(p=>({...p,weight:p.adjustedWeight/total,contribution:p.study.value*p.adjustedWeight/total}));
      const score=sum(weighted.map(p=>p.contribution));
      rows.push({id,person:people.get(id),projects:weighted,score:Math.abs(score)<1e-12?0:score,unadjusted:sum(weighted.map(p=>p.baseWeight*p.study.value))});
    }
    rows.sort(compare);
    return rows.map(r=>({...r,rank:rows.findIndex(x=>Math.abs(x.score-r.score)<1e-9)+1}));
  }
  return Object.freeze({rank,order,RECENCY_SHARE});
});
