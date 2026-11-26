'use strict';
(()=>{
const D=window.BENCHMARK_DATA,C=window.BENCHMARK_COUNCILLORS,S=window.BenchmarkScoring,P=window.BenchmarkPortfolio,$=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=x=>(x>1e-9?'+':x< -1e-9?'−':'')+Math.abs(x).toFixed(2);
const pct=x=>(x*100).toFixed(2).replace(/\.?0+$/,'')+'%';
const safe=x=>{try{const u=new URL(x);return /^https?:$/.test(u.protocol)?u.href:'#'}catch{return '#'}};
const people=Object.fromEntries(C.people.map(p=>[p.id,p])),params=new URLSearchParams(location.search);
let view=params.get('view')==='tor'?'tor':'framework',scope=params.get('scope')==='vision'?'vision':'full',area=params.get('area')||'all',mode=['default','equal','custom'].includes(params.get('weights'))?params.get('weights'):'default',custom={},search=params.get('q')||'',all=[],visible=[],calc,opened=new Set(),timer;
if(mode==='custom'){try{custom=JSON.parse(params.get('custom')||'{}')}catch{mode='default'}}
const photo=(p)=>'<img class="portrait" src="./assets/portraits/'+esc(p.portrait)+'" alt="" style="object-position:'+esc(p.objectPosition||'50% 20%')+'" loading="lazy">';
const medal=r=>r===1?'🏆':r===2?'🥈':r===3?'🥉':'';
const color=r=>r.rank===1?'#b48b39':r.rank===2?'#8995a1':r.rank===3?'#a86d47':r.score===0?'#e76025':'#527b62';
const name=p=>p.study.shortName||p.study.name;
const date=p=>p.study.documentDate||p.mapping.historicalPeriod||'Study period';
const studyLink=id=>{const u=new URL('./studies.html',location.href);u.searchParams.set('view',view);u.searchParams.set('scope',scope);u.searchParams.set('area',area);u.searchParams.set('people','historical');u.searchParams.set('weights',mode);if(mode==='custom')u.searchParams.set('custom',JSON.stringify(custom));if(id)u.searchParams.set('study',id);return u.href};
function notify(msg){$('status').textContent=msg;clearTimeout(timer);timer=setTimeout(()=>$('status').textContent='',4500)}
function url(){const u=new URL(location.href);u.search='';u.hash='';for(const [k,v] of Object.entries({view,scope,area,weights:mode,q:search}))if(v)u.searchParams.set(k,v);if(mode==='custom')u.searchParams.set('custom',JSON.stringify(custom));return u.href}
function calculate(){
 if(!D[view].categories.some(a=>a.id===area))area='all';
 try{calc=S.calculate(D[view],{scope,category:area,weightMode:mode,customWeights:custom})}
 catch(e){area='all';mode='default';custom={};calc=S.calculate(D[view],{scope,category:area});notify('Invalid assessment weights; source defaults restored.')}
 all=P.rank(calc.studies,C,view);
}
function showControls(){
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));
 $('area').innerHTML='<option value="all">All assessment areas</option>'+D[view].categories.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('');
 $('area').value=area;$('scope').value=scope;$('scope-label').hidden=view==='tor';$('weights').value=mode;$('edit-weights').hidden=mode!=='custom';$('search').value=search;
 $('scope-note').textContent=D[view].comparisonNote+(view==='framework'&&scope==='vision'?' Active scope: vision statements.':'');
 $('weight-notice').hidden=area==='all'&&mode==='default';$('weight-notice').textContent=(mode==='default'?'Source defaults':mode==='equal'?'Equal assessment weights':'Custom assessment weights')+(area==='all'?'':' · Selected assessment area normalized to 100%.');
 $('study-nav').href=studyLink();$('method-study-link').href=studyLink();$('version').textContent='Assessment revision: '+D[view].methodologyId+' · Representation checked '+C.mapping.checkedOn+' · Portfolio method: recency / shared representation v1.';
}
function renderPodium(){
 const top=all.filter(r=>r.rank<=3);
 $('podium').innerHTML=top.map((r,i)=>{const pos=i===0?'first':i===1?'left':i===2?'right':'extra';return '<button type="button" class="podium-card '+pos+' '+(r.rank===3?'third':'')+'" data-person="'+esc(r.id)+'" style="border:0;background:transparent;padding:0"><span class="medal" aria-hidden="true">'+medal(r.rank)+'</span>'+photo(r.person)+'<h3>'+esc(r.person.name)+'</h3><span class="podium-studies">'+r.projects.map(p=>esc(name(p))).join('<br>')+'</span><span class="podium-score">'+signed(r.score)+'</span><span class="podium-block" style="background:'+color(r)+'"><strong>'+r.rank+'</strong>'+((top.filter(x=>x.rank===r.rank).length>1?'Joint ':'')+(r.rank===1?'first':r.rank===2?'second':'third'))+'</span></button>'}).join('');
 const studies=new Set(all.flatMap(r=>r.projects.map(p=>p.study.id)));
 $('stats').innerHTML='<div><strong>'+all.length+'</strong><small>Councillors</small></div><div><strong>'+studies.size+'</strong><small>Local studies</small></div><div><strong>66%</strong><small>Starting weight for latest study</small></div>';
}
function filter(){const q=search.trim().toLowerCase();visible=all.filter(r=>!q||[r.person.name,...r.projects.flatMap(p=>[p.study.name,...p.ids.map(id=>people[id].name)])].join(' ').toLowerCase().includes(q))}
function renderChart(){
 const limit=view==='tor'?12:4,min=Math.min(0,...all.map(r=>r.score)),max=Math.max(0,...all.map(r=>r.score)),lo=min<0?Math.max(-limit,min):0,hi=Math.max(max,limit*.15),top=92,bottom=300,y=x=>bottom-(x-lo)/(hi-lo)*(bottom-top),zero=y(0);
 $('chart').innerHTML=visible.map(r=>{const barY=Math.min(zero,y(r.score)),barH=Math.max(3,Math.abs(y(r.score)-zero));return '<button type="button" class="chart-col" data-person="'+esc(r.id)+'" aria-label="Rank '+r.rank+', '+esc(r.person.name)+', '+signed(r.score)+'; view portfolio"><span class="plot"><span class="zero-line" style="top:'+zero+'px"></span><span class="chart-bar" style="top:'+barY+'px;height:'+barH+'px;background:'+color(r)+'"></span><span class="chart-marker" style="top:'+barY+'px"><strong>'+signed(r.score)+'</strong>'+photo(r.person)+'</span></span><span class="chart-name">'+r.rank+'. '+esc(r.person.name)+'</span><span class="chart-projects">'+r.projects.map(p=>'<span>'+esc(name(p))+'</span>').join('')+'</span></button>'}).join('');
}
function project(p,r){
 const others=p.ids.filter(id=>id!==r.id);
 return '<div class="project"><div><div class="project-name">'+esc(p.study.name)+'</div><div class="project-meta">'+esc(date(p))+' · '+esc(p.study.documentStatus||p.study.body||'Assessed document')+(p.isLatest&&r.projects.length>1?' · Most recent':'')+'</div><div class="weightline">Starting '+pct(p.baseWeight)+' ÷ '+p.sharedCount+' → <b>final '+pct(p.weight)+'</b></div>'+(others.length?'<div class="co-label">Other study-period representatives</div><div class="co-people">'+others.map(id=>'<span class="co-person">'+photo(people[id])+esc(people[id].name)+'</span>').join('')+'</div>':'<div class="co-label">Single local representative in dataset</div>')+(p.mapping.note?'<p class="project-meta">'+esc(p.mapping.note)+'</p>':'')+(p.study.stageNote?'<p class="project-meta">'+esc(p.study.stageNote)+'</p>':'')+'<div class="project-links"><a href="'+esc(studyLink(p.study.id))+'">Assessment &amp; evidence</a> · <a href="'+esc(safe(p.study.sourceUrl))+'" target="_blank" rel="noopener">Source document</a></div></div><div class="project-score">'+signed(p.study.value)+'<div class="project-meta">Contribution '+signed(p.contribution)+'</div></div></div>';
}
function renderList(){
 $('ranking-list').innerHTML=visible.map(r=>'<article class="rank-row" id="councillor-'+esc(r.id)+'"><div class="rank-top"><span class="rank-no '+(r.rank===1?'first':'')+'">'+(medal(r.rank)||r.rank)+'</span>'+photo(r.person)+'<div><div class="rank-name">'+esc(r.person.name)+'</div><div class="study-labels">'+r.projects.map(p=>'<span>'+esc(name(p))+'</span>').join('')+'</div><div class="track"><div class="fill" style="width:'+Math.abs(r.score)/(view==='tor'?12:4)*100+'%;background:'+color(r)+'"></div></div></div><div class="rank-score">'+signed(r.score)+'<small>'+r.projects.length+' '+(r.projects.length===1?'study':'studies')+'</small></div></div><details class="details" data-detail="'+esc(r.id)+'" '+(opened.has(r.id)?'open':'')+'><summary>Projects, weighting &amp; fellow councillors</summary><div class="portfolio">'+r.projects.map(p=>project(p,r)).join('')+'<div class="weights-bar" aria-label="Final weights">'+r.projects.map(p=>'<span style="flex:'+p.weight+'" title="'+esc(name(p)+' '+pct(p.weight))+'"></span>').join('')+'</div><div class="portfolio-total"><span>Adjusted portfolio score</span><span>'+signed(r.score)+'</span></div><div class="project-meta">Before shared-representation adjustment: '+signed(r.unadjusted)+'</div></div></details></article>').join('');
 if(!visible.length)$('ranking-list').innerHTML='<p class="notice">No councillors match your search.</p>';
 $('count').textContent='Showing '+visible.length+' of '+all.length+' councillors. Rankings are unchanged by search.';
 $('ranking-list').querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)opened.add(d.dataset.detail);else opened.delete(d.dataset.detail)}));
}
function renderAwards(){
 const groups=D[view].categories.map(a=>{
  let result;try{result=S.calculate(D[view],{scope,category:a.id,weightMode:mode,customWeights:custom})}catch{return null}
  const ranks=P.rank(result.studies,C,view),winners=ranks.filter(r=>r.rank===1);
  if(!winners.length||winners[0].score<=1e-9||ranks.every(r=>Math.abs(r.score-winners[0].score)<1e-9))return null;
  return '<article class="award"><h3>🏅 '+esc(a.name)+'</h3><div class="muted fine">'+(winners.length>1?'Joint leaders':'Leading portfolio')+' · '+signed(winners[0].score)+'</div>'+winners.map(r=>'<div class="award-winner">'+photo(r.person)+'<div><strong>'+esc(r.person.name)+'</strong><small>'+r.projects.map(p=>esc(name(p))).join(' · ')+'</small></div></div>').join('')+'</article>';
 }).filter(Boolean);
 $('awards').innerHTML=groups.join('')||'<p class="muted">No distinct positive category leaders under these assessment weights.</p>';
}
function renderFiltered(){filter();renderChart();renderList();history.replaceState(null,'',url())}
function render(){calculate();showControls();renderPodium();renderFiltered();renderAwards()}
function customDialog(){
 const entries=view==='framework'?D[view].topics:D[view].categories;
 $('custom-fields').innerHTML=entries.map(e=>'<label>'+esc(e.name)+'<input type="number" min="0" step="any" name="'+esc(e.id)+'" value="'+esc(mode==='custom'?(custom[e.id]??0):mode==='equal'?100/entries.length:e.defaultWeight*100)+'" required></label>').join('');
 $('custom-error').textContent='';$('custom-dialog').showModal();
}
function share(){if(navigator.clipboard?.writeText)navigator.clipboard.writeText(url()).then(()=>notify('View link copied.')).catch(()=>prompt('Copy the view link',url()));else prompt('Copy the view link',url())}
function download(blob,filename){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function csv(){
 const rows=[['Assessment','Scope','Assessment area','Assessment weight mode','Rank','Councillor','Portfolio score','Unadjusted portfolio score','Assessed study','Study period','Project score','Associated councillor count','Starting weight','Divided starting weight','Final normalized weight','Contribution','Other study-period representatives','Source','Assessment revision','View URL']];
 visible.forEach(r=>r.projects.forEach(p=>rows.push([view,view==='tor'?'Written TOR':scope,area,mode,r.rank,r.person.name,r.score,r.unadjusted,p.study.name,date(p),p.study.value,p.sharedCount,p.baseWeight,p.adjustedWeight,p.weight,p.contribution,p.ids.filter(id=>id!==r.id).map(id=>people[id].name).join('; '),p.study.sourceUrl,D[view].methodologyId,url()])));
 const cell=v=>{let t=String(v??'');if(/^[=+@-]/.test(t)&&!/^[-+]?\d+(?:\.\d+)?$/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
 download(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'toronto-councillor-'+view+'-leaderboard.csv');notify('Portfolio CSV exported.');
}
async function png(){
 if(!visible.length){notify('No councillors to export.');return}
 const list=visible.slice(),viewName=D[view].title,viewUrl=url(),areaName=D[view].categories.find(a=>a.id===area)?.name||'All assessment areas',canvas=document.createElement('canvas'),w=1400,h=250+list.length*124;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.fillStyle='#e76025';ctx.font='bold 22px Arial';ctx.fillText('COMMUNITY IN PUBLIC',45,48);ctx.fillStyle='#20362d';ctx.font='bold 42px Arial';ctx.fillText('Toronto Councillor Leaderboard',45,103);ctx.font='20px Arial';ctx.fillText(viewName+' · '+areaName+' · Study-period councillors',45,141);ctx.fillText('66% latest starting weight; divided by associated councillor count, then normalized.',45,172);
 const imgs=await Promise.all(list.map(r=>new Promise(resolve=>{let im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src='./assets/portraits/'+r.person.portrait})));
 list.forEach((r,i)=>{let y=198+i*124;ctx.strokeStyle='#dee5de';ctx.beginPath();ctx.moveTo(45,y);ctx.lineTo(w-45,y);ctx.stroke();ctx.fillStyle=color(r);ctx.font='bold 30px Arial';ctx.fillText(String(r.rank),48,y+48);let im=imgs[i];ctx.save();ctx.beginPath();ctx.arc(127,y+58,37,0,Math.PI*2);ctx.clip();ctx.fillStyle='#e5eae3';ctx.fillRect(90,y+21,74,74);if(im){let crop=Math.min(im.width,im.height);ctx.drawImage(im,(im.width-crop)/2,(im.height-crop)*.2,crop,crop,90,y+21,74,74)}ctx.restore();ctx.fillStyle='#20362d';ctx.font='bold 26px Arial';ctx.fillText(r.person.name,185,y+39);ctx.font='17px Arial';let label=r.projects.map(p=>name(p)).join(' · ');let words=label.split(' '),line='',lines=[];for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>850&&line){lines.push(line);line=word}else line=next}if(line)lines.push(line);lines.slice(0,3).forEach((l,j)=>ctx.fillText(l,185,y+64+j*19));ctx.fillStyle=color(r);ctx.font='bold 31px Arial';ctx.textAlign='right';ctx.fillText(signed(r.score),w-48,y+48);ctx.font='17px Arial';ctx.fillText(r.projects.length+' studies',w-48,y+73);ctx.textAlign='left'});
 ctx.fillStyle='#5e7065';ctx.font='16px Arial';ctx.fillText('Scores compare written provisions, not personal performance. Zero is the Little Jamaica reference.',45,h-25);canvas.toBlob(blob=>{if(blob){download(blob,'toronto-councillor-leaderboard.png');notify('Leaderboard image exported.')}else notify('Image export unavailable; use CSV.')},'image/png');
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;area='all';mode='default';custom={};opened.clear();render()}));
$('scope').addEventListener('change',e=>{scope=e.target.value;render()});
$('area').addEventListener('change',e=>{area=e.target.value;render()});
$('weights').addEventListener('change',e=>{if(e.target.value==='custom'){e.target.value=mode;customDialog()}else{mode=e.target.value;render()}});
$('edit-weights').addEventListener('click',customDialog);$('cancel-custom').addEventListener('click',()=>$('custom-dialog').close());
$('custom-form').addEventListener('submit',e=>{e.preventDefault();const values=Object.fromEntries([...new FormData(e.target)].map(([id,v])=>[id,Number(v)]));if(Object.values(values).some(v=>!Number.isFinite(v)||v<0)||!Object.values(values).some(v=>v>0)){$('custom-error').textContent='Enter at least one positive weight.';return}custom=values;mode='custom';area='all';$('custom-dialog').close();render()});
$('search').addEventListener('input',e=>{search=e.target.value;renderFiltered()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-person]');if(!b)return;const id=b.dataset.person;if(!visible.some(r=>r.id===id)){search='';$('search').value='';renderFiltered()}const el=$('councillor-'+id);if(el){el.querySelector('details').open=true;el.scrollIntoView({block:'start',behavior:'smooth'});el.querySelector('summary').focus({preventScroll:true})}});
$('share').addEventListener('click',share);$('share-bottom').addEventListener('click',share);$('csv').addEventListener('click',csv);$('png').addEventListener('click',png);
$('credits').innerHTML='<ul>'+C.people.filter(p=>Object.values(C.mapping.framework).some(m=>m.historical.includes(p.id))||Object.values(C.mapping.tor).some(m=>m.historical.includes(p.id))).map(p=>'<li>'+esc(p.name)+' — '+esc(p.portraitCredit)+' · <a href="'+esc(safe(p.portraitSource))+'" target="_blank" rel="noopener">Source</a>'+(p.licenseUrl?' · <a href="'+esc(safe(p.licenseUrl))+'">Licence</a>':'')+'</li>').join('')+'</ul>';
render();
})();
