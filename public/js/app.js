'use strict';
// Read-only state is server-authored. The database remains the final authority.
let collectionState={checked:false,isOpen:location.protocol==='file:',closesAt:null,mode:'test'};
function stages(){return ['Rank planning themes','Rank community outcomes','Review highest priorities','Compare planning documents','Adjust individual topics','Compare with community'];}
function nav(){
 const short=['Planning themes','Community outcomes','Highest priorities','Results','Adjust individual topics','Community comparison'];
 const unlocked=!!record?.firstCompletedAt;
 document.getElementById('nav').innerHTML=stages().map((name,i)=>{
  if(i>=4&&!unlocked)return '';
  const extra=i===4?'optional-step':i===5?'community-step':'',done=(record?.continuedPages||[]).includes(i+1);
  const stepLabel=`Step ${i+1}${i===4?' · Optional':''}`;
  return `<button type="button" data-page="${i}" ${i>=3&&!unlocked?'disabled aria-disabled="true"':''} aria-current="${state.page===i?'step':'false'}" aria-label="${stepLabel}: ${name}" class="stepitem ${extra} ${state.page===i?'active':''} ${done?'done':''}"><span class="steptxt"><span class="stepsub">${stepLabel}</span><span class="stepname">${esc(short[i])}</span></span></button>`;
 }).join('');
 document.querySelectorAll('#nav [data-page]').forEach(el=>el.onclick=()=>navigate(+el.dataset.page,'navigation'));
}
function hdr(){
 const heads=[
  ['Rank the seven planning themes','Put the planning subjects in order, starting with what matters most to you. Move items using the arrows or by dragging.'],
  ['Rank five community outcomes','Put the outcomes in order, starting with the one that matters most. Some topics contribute to more than one outcome.'],
  ['Review your highest priorities','Review the highest and second-highest groups, with seven topics in each. Make changes only where the proposed order does not reflect your priorities.'],
  ['How the planning documents compare','See how each comparator differs from Little Jamaica, based on your selected priorities. Compare vision statements or full planning documents.'],
  ['Adjust individual topics','Optional: review all 39 topics and move any topic to another priority group or position. Other topics shift to accommodate your choice.'],
  ['Your priorities and the community','Compare the priorities you selected with the average priorities of other completed survey responses, by topic, theme and outcome.']
 ];
 document.getElementById('panehead').innerHTML=`<div class="stepoverline">Step ${state.page+1}${state.page===4?' · Optional':state.page===3?' · Results':state.page===5?' · Community comparison':''}</div><h2 tabindex="-1" id="page-heading">${heads[state.page][0]}</h2><p>${heads[state.page][1]}</p>`;
}
function rankingPage(c){
 const connections=[
  ['resident','I live here'],['former','I used to live here'],['business','I own or operate a local business'],
  ['worker','I work here'],['organization','I participate in a local community organization'],
  ['culture','I visit for cultural, religious or community activities'],['services','I use local services or facilities'],['other','Another connection']
 ];
 const identity=`<section class="connection-panel" aria-labelledby="connection-title"><h3 id="connection-title">What connects you to Little Jamaica / Oakwood Vaughan?</h3><p>Select any that apply. You may leave this section blank.</p><div class="connection-options">${connections.map(([id,label])=>`<label class="connection-choice"><input type="checkbox" data-connection="${id}" ${state.connections.includes(id)?'checked':''}><span>${label}</span></label>`).join('')}</div><label class="email-label" for="participant-email">Email address <span>(optional)</span></label><input id="participant-email" class="email-field" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="you@example.com" aria-describedby="email-help" value="${esc(state.email)}"><p id="email-help" class="privacy-help">Add your email so Community in Public can send you your results and keep you updated on the final results of everyone's voting. You can complete the survey without an email address.</p><fieldset class="email-opt-ins"><legend>Other updates you would like (optional)</legend><label class="connection-choice"><input type="checkbox" id="newsletter-opt-in" ${state.newsletterOptIn?'checked':''}><span>Send me the Community in Public newsletter.</span></label><label class="connection-choice"><input type="checkbox" id="planning-opt-in" ${state.planningOptIn?'checked':''}><span>Send me other updates on the Little Jamaica planning process.</span></label><p class="privacy-help" id="opt-in-help">Add an email above to enable these choices. Neither subscription is required to participate.</p></fieldset><details class="privacy-details"><summary>How your information is used</summary><p>Community in Public uses your rankings and comments to understand community priorities. Each time you continue, your answers and any revisions are saved. Your email is optional, stored separately from your survey answers, and never shown in community comparisons. Adding it requests survey-result updates; the two checkboxes are separate permissions for other messages. Return to this page to change your preferences, or contact Community in Public to request removal of your contact details.</p></details></section>`;
 const list=state.ranking.map((name,i)=>{
  const th=WB.themes.find(t=>t.name===name);
  return `<div class="rankitem" draggable="true" data-rank="${i}"><div class="draggrip" aria-hidden="true">⋮⋮</div><div class="ranknum">${i+1}</div><div class="rankbody"><strong>${esc(name)}</strong><small>${esc(th?.description||'')}</small></div><div class="rankswap"><button type="button" data-shift="-1" data-index="${i}" aria-label="Move ${esc(name)} up" ${i===0?'disabled':''}>↑</button><button type="button" data-shift="1" data-index="${i}" aria-label="Move ${esc(name)} down" ${i===6?'disabled':''}>↓</button></div></div>`;
 }).join('');
 return `${identity}<div class="rule-callout"><strong>Your planning priorities</strong><span>The themes are listed in alphabetical order. Order them based on what is most to least important to you, starting with most important at the top</span></div><div class="ranklist" id="ranklist">${list}</div>`;
}
function multiplierPage(c){
 const movement=c.multiplierMoves;
 const mults=outcomeFactors();
 const rows=state.outcomeRanking.map((id,i)=>{
  const o=OUTCOMES.find(x=>x.id===id);
  return `<article class="rankitem outcome-rank-item" draggable="true" data-outcome-rank="${i}"><div class="draggrip" aria-hidden="true">&#8942;&#8942;</div><div class="ranknum">${i+1}</div><div class="rankbody"><strong>${esc(o.title)}</strong><small>${esc(o.desc)}</small><details class="outcome-details"><summary>See which ${o.codes.length} topics are covered</summary><div class="outcome-chips">${o.codes.map(code=>`<span class="code">${esc(code)} — ${esc(byCode[code].title)}</span>`).join('')}</div></details></div><div class="rankswap"><button type="button" data-shift-outcome="-1" data-index="${i}" aria-label="Move ${esc(o.title)} up" ${i===0?'disabled':''}>&uarr;</button><button type="button" data-shift-outcome="1" data-index="${i}" aria-label="Move ${esc(o.title)} down" ${i===OUTCOMES.length-1?'disabled':''}>&darr;</button></div></article>`;
 }).join('');
 return `<div class="rule-callout"><strong>Set your outcome order</strong><span>Place the outcome that matters most to you first. You can return and adjust your answers.</span></div><div class="ranklist" id="outcome-ranklist">${rows}</div>`;
}
function moveOutcome(index,dir){
 const j=index+dir;if(j<0||j>=OUTCOMES.length)return;
 const [x]=state.outcomeRanking.splice(index,1);state.outcomeRanking.splice(j,0,x);
 state.movedOutcomes=true;state.completed=false;
 if(Object.keys(state.decisions).length)invalidatePreferences();
 render();
}
function wireOutcomeRank(){
 document.querySelectorAll('[data-shift-outcome]').forEach(b=>b.addEventListener('click',()=>moveOutcome(+b.dataset.index,+b.dataset.shiftOutcome)));
 let from=null;
 document.querySelectorAll('[data-outcome-rank]').forEach(el=>{
  el.addEventListener('dragstart',e=>{from=+el.dataset.outcomeRank;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(from));});
  el.addEventListener('dragover',e=>e.preventDefault());
  el.addEventListener('drop',e=>{e.preventDefault();const to=+el.dataset.outcomeRank;if(from===null||to===from)return;const [x]=state.outcomeRanking.splice(from,1);state.outcomeRanking.splice(to,0,x);state.movedOutcomes=true;state.completed=false;if(Object.keys(state.decisions).length)invalidatePreferences();render();});
 });
}
function choiceSummary(code,decision,band){
 if(!decision)return 'Proposed from your ranking';
 if(decision.kind==='pin')return decision.band===band?'Confirmed in this group':'Confirmed in '+BAND_NAMES[decision.band];
 if(decision.band===3)return 'Moved to the lower-priority half';
 return 'Set below group '+decision.band;
}
function priorityPage(c,band,offset=0,shown=5){
 const codes=c.groups[band].slice(offset,offset+shown);
 const count=Object.keys(state.decisions).length;
 const startRank=BAND_COUNTS.slice(0,band).reduce((n,k)=>n+k,0);
 const rows=codes.map((code,i)=>{
  const t=c.byCode[code],d=state.decisions[code],confirmed=d&&d.kind==='pin'&&d.band===band;
  const downButton=band===2?'':`<button type="button" data-topic-action="down" data-priority-band="${band}" data-code="${esc(code)}" class="mini-btn">Move lower</button>`;
  return `<article class="priority-item" data-code="${esc(code)}"><div class="priority-order"><span>${startRank+offset+i+1}</span></div><div class="priority-main"><div class="topic-eyebrow"><span class="code">${esc(t.code)}</span><span>${esc(t.theme)}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.summary||'')}</p><div class="priority-actions"><button type="button" data-topic-action="keep" data-priority-band="${band}" data-code="${esc(code)}" class="mini-btn ${confirmed?'is-on':''}">${confirmed?'Undo confirmation':'&#10003; Keep here'}</button>${downButton}<button type="button" data-topic-action="half" data-priority-band="${band}" data-code="${esc(code)}" class="mini-btn warn">Move to lower-priority groups</button><button type="button" data-topic-action="replace" data-priority-band="${band}" data-code="${esc(code)}" class="mini-btn primary-mini">Replace topic</button></div></div></article>`;
 }).join('');
 const adjustments=Object.entries(state.decisions).map(([code,d])=>`<div class="change-line"><span class="code">${esc(code)}</span><span>${esc(d.kind==='pin'?'Confirmed in '+BAND_NAMES[d.band]:d.band===3?'Moved to a lower-priority group':'Moved below '+BAND_NAMES[d.band-1])}</span><button type="button" data-restore="${esc(code)}">Restore automatic</button></div>`).join('');
 const absoluteFrom=startRank+offset+1,absoluteTo=startRank+offset+codes.length;
 return `<div class="rule-callout"><strong>${esc(BAND_NAMES[band])} · ${BAND_COUNTS[band]} topics</strong><span>All topics in this group receive the same final importance. Keep, move, or replace any suggestion.</span></div><div class="group-toolbar"><span>Showing positions ${absoluteFrom}–${absoluteTo} of 39</span><span>${count} manual adjustment${count===1?'':'s'}</span></div><div class="priority-list">${rows}</div><div class="methodbox"><strong>Your choices:</strong> <b>Keep here</b> confirms a topic in this group; ${band===2?'':'<b>Move lower</b> excludes it from this group; '}<b>Move to lower-priority groups</b> assigns it to positions ${rankBounds(3).start}–39; <b>Replace topic</b> lets you promote another topic into the group. The tool automatically fills empty slots. Every topic stays in the evaluation.</div><div class="group-footer-controls"><button type="button" id="undo" class="btn secondary" ${state.history.length?'':'disabled'}>Undo last change</button><button type="button" id="clear" class="btn secondary" ${count?'':'disabled'}>Reset topic adjustments</button></div>${count?`<details class="changes"><summary>View or reverse your ${count} topic adjustment${count===1?'':'s'}</summary><div class="change-list">${adjustments}</div></details>`:''}`;
}
function refinementPage(c){
 const band=state.refineBand===1?1:0;
 return `<div class="refine-intro"><strong>Fourteen topics carry the highest weights</strong><span>Review each group and continue when you agree. Changes are optional.</span></div><div class="refine-tabs" role="group" aria-label="Choose top priority group"><button type="button" data-view-band="0" class="refine-tab ${band===0?'selected':''}" aria-pressed="${band===0}"><span>Highest priority</span><small>Seven proposed topics</small></button><button type="button" data-view-band="1" class="refine-tab ${band===1?'selected':''}" aria-pressed="${band===1}"><span>Second-highest priority</span><small>Seven proposed topics</small></button></div>${priorityPage(c,band,0,BAND_COUNTS[band])}`;
}
function wireRefinement(){
 document.querySelectorAll('[data-view-band]').forEach(b=>b.addEventListener('click',()=>{state.refineBand=+b.dataset.viewBand;render();}));
 wirePriority();
}
function gapEligible(c){return c.groups.slice(3).flat();}
function gapSuggestions(c){
 const eligible=gapEligible(c).sort((a,b)=>c.base.byWeight[b]-c.base.byWeight[a]||byCode[a].sourceIndex-byCode[b].sourceIndex);
 const count={},chosen=[];
 for(const code of eligible){const theme=byCode[code].theme;if((count[theme]||0)>=2)continue;chosen.push(code);count[theme]=(count[theme]||0)+1;if(chosen.length===5)break;}
 for(const code of eligible){if(chosen.length===5)break;if(!chosen.includes(code))chosen.push(code);}
 return chosen;
}
function gapProposal(selected=state.gapSelected){
 const work=JSON.parse(JSON.stringify(state.decisions)), swaps=[];
 const base=startingCalc(outcomeFactors());
 for(const promote of selected){
  const now=assignBands(base,work),currentBand=now.findIndex(group=>group.includes(promote));
  if(currentBand<3)continue;
  const replaceable=now[2].filter(code=>!(work[code]&&work[code].kind==='pin')).sort((a,b)=>base.byWeight[a]-base.byWeight[b]||byCode[b].sourceIndex-byCode[a].sourceIndex);
  if(!replaceable.length)throw Error('No open slots remain in the second-to-top quarter.');
  const displaced=replaceable[0];
  work[displaced]={kind:'min',band:3};work[promote]={kind:'pin',band:2};
  assignBands(base,work);
  swaps.push({promoted:promote,displaced});
 }
 return {work,swaps};
}
function gapPage(c){
 const selectedCount=state.gapSelected.length,completed=state.gapPromotions.length;
 const previous=state.gapPromotions.map(x=>`<div class="gap-confirmed"><span class="code">${esc(x.promoted)}</span><span><strong>${esc(byCode[x.promoted].title)}</strong><small>Now in second-to-top quarter, replacing ${x.displaced}</small></span></div>`).join('');
 return `<div class="refine-intro"><strong>Optional final check · up to two corrections</strong><span>The six-group model has already assigned the next ${BAND_COUNTS[2]} topics to positions ${rankBounds(2).start}–${rankBounds(2).end}. If something important has been overlooked, promote it to that group instead of reviewing all ${BAND_COUNTS[2]}.</span></div>${completed?`<div class="methodbox"><strong>Your confirmed additions to the upper quarter</strong><div class="gap-confirmed-list">${previous}</div><button type="button" id="clear-gap" class="btn secondary">Undo Page 4 additions</button></div>`:''}<div class="selection-summary"><div><span class="count-large">${completed+selectedCount}<span> / 2</span></span><span class="count-label">selected or added</span></div><div class="selection-summary-note">Suggestions come from topics currently outside the top ${rankBounds(2).end}, with no more than two from the same theme. Search for a different topic if these don't reflect your priorities.</div></div><label class="picker-label" for="gap-query">Search topics outside the top ${rankBounds(2).end} (optional)</label><input type="search" id="gap-query" class="gap-search" value="${esc(state.gapSearch)}" placeholder="Search by topic, theme, or code"><div class="sortnote" id="gap-count"></div><div id="gap-results" class="gap-results"></div><div class="picker-pager"><button type="button" class="btn secondary" id="gap-prev">Previous five</button><span id="gap-page" class="smallmuted"></span><button type="button" class="btn secondary" id="gap-next">Next five</button></div><div id="gap-preview"></div><div class="methodbox"><strong>What happens when you promote a topic?</strong> It moves to the second-to-top quarter (which carries ${fmt(groupWeight(2)*100,2)}% across ${BAND_COUNTS[2]} topics), and the lowest-ranked available topic in that quarter moves down. You can preview the exact swap before confirming. The top two eighths stay unchanged.</div>`;
}
function renderGapList(){
 const c=calc();
 const eligible=gapEligible(c);
 let codes;
 if(state.gapSearch.trim()){
  const q=state.gapSearch.trim().toLowerCase();
  codes=eligible.filter(code=>{const t=byCode[code];return (t.title+' '+t.code+' '+t.summary+' '+t.theme).toLowerCase().includes(q);}).sort((a,b)=>c.base.byWeight[b]-c.base.byWeight[a]||byCode[a].sourceIndex-byCode[b].sourceIndex);
 } else codes=gapSuggestions(c);
 const pages=Math.max(1,Math.ceil(codes.length/5));state.gapPage=Math.min(state.gapPage,pages-1);
 const slice=codes.slice(state.gapPage*5,state.gapPage*5+5);
 document.getElementById('gap-count').textContent=state.gapSearch.trim()?`${codes.length} matching topics (5 per view)`:'Five suggested topics based on your earlier choices';
 document.getElementById('gap-results').innerHTML=slice.length?slice.map(code=>{
  const t=byCode[code],checked=state.gapSelected.includes(code);
  const disabled=!checked&&(state.gapSelected.length+state.gapPromotions.length>=2);
  return `<button type="button" data-gap-select="${code}" class="gap-choice ${checked?'selected':''}" ${disabled?'disabled':''} aria-pressed="${checked}"><span class="gap-check">${checked?'✓':'+'}</span><span><strong><span class="code">${code}</span> ${esc(t.title)}</strong><small>${esc(t.theme)} · Currently ${esc(BAND_NAMES[c.byCode[code].band])}</small></span><span class="gap-plus">${checked?'Selected':'Elevate'}</span></button>`;
 }).join(''):'<div class="empty-match">No eligible topics match. Try another search.</div>';
 document.getElementById('gap-page').textContent=`${state.gapPage+1} / ${pages}`;
 document.getElementById('gap-prev').disabled=state.gapPage===0;
 document.getElementById('gap-next').disabled=state.gapPage>=pages-1;
 document.querySelectorAll('[data-gap-select]').forEach(btn=>btn.onclick=()=>{
  const code=btn.dataset.gapSelect;
  if(state.gapSelected.includes(code))state.gapSelected=state.gapSelected.filter(x=>x!==code);
  else if(state.gapSelected.length+state.gapPromotions.length<2)state.gapSelected.push(code);
  render();
 });
 const el=document.getElementById('gap-preview');
 if(!state.gapSelected.length){el.innerHTML='<p class="smallmuted gap-noselection">No additional topic selected. You can continue to the results without making a change.</p>';return;}
 try{
  const p=gapProposal();
  el.innerHTML=`<div class="gap-preview"><h3>Preview the proposed changes</h3>${p.swaps.map(x=>`<div class="gap-swap"><div><span class="smallmuted">Bring into positions ${rankBounds(2).start}–${rankBounds(2).end}</span><strong>${x.promoted} — ${esc(byCode[x.promoted].title)}</strong></div><span aria-hidden="true">⇄</span><div><span class="smallmuted">Move to a lower group</span><strong>${x.displaced} — ${esc(byCode[x.displaced].title)}</strong></div></div>`).join('')}<button type="button" id="gap-apply" class="btn primary">Confirm ${p.swaps.length} topic promotion${p.swaps.length===1?'':'s'}</button><button type="button" id="gap-cancel" class="btn secondary">Clear selection</button></div>`;
  document.getElementById('gap-apply').onclick=applyGaps;
  document.getElementById('gap-cancel').onclick=()=>{state.gapSelected=[];render();};
 }catch(e){el.innerHTML=`<div class="methodbox">${esc(e.message)}</div>`;}
}
function applyGaps(){
 try{
  const p=gapProposal();if(!p.swaps.length)return;
  const prior=JSON.stringify(state.decisions);state.history.push(prior);
  state.decisions=p.work;state.gapPromotions.push(...p.swaps);state.gapSelected=[];state.gapSearch='';state.gapPage=0;
  state.flash=`${p.swaps.length} topic${p.swaps.length===1?'':'s'} promoted into the second-to-top quarter.`;
 }catch(e){state.flash=e.message;}
 render();
}
function clearGaps(){
 if(!state.gapPromotions.length)return;
 state.history.push(JSON.stringify(state.decisions));
 for(const swap of state.gapPromotions){if(state.decisions[swap.promoted]?.band===2)delete state.decisions[swap.promoted];if(state.decisions[swap.displaced]?.kind==='min'&&state.decisions[swap.displaced].band===3)delete state.decisions[swap.displaced];}
 state.gapPromotions=[];state.gapSelected=[];render();
}
function wireGap(){
 const input=document.getElementById('gap-query');
 input.addEventListener('input',()=>{state.gapSearch=input.value;state.gapPage=0;renderGapList();});
 document.getElementById('gap-prev').onclick=()=>{state.gapPage=Math.max(0,state.gapPage-1);renderGapList();};
 document.getElementById('gap-next').onclick=()=>{state.gapPage++;renderGapList();};
 const clear=document.getElementById('clear-gap');if(clear)clear.onclick=clearGaps;
 renderGapList();
}

function editorSection(c){
 const count=state.editorMoves.length;
 const logs=state.editorMoves.slice().reverse().slice(0,5).map(m=>`<div class="editor-swaplog"><strong>${esc(m.moved)} moved from position ${m.fromRank} to ${m.toRank}</strong><small>${m.shiftCount} other topic${m.shiftCount===1?'':'s'} shifted by one place in the ranking.</small></div>`).join('');
 return `<section class="editor-shell" id="topic-editor"><div class="editor-head"><div><h3>Review or adjust all 39 topics</h3><p>Optional: the two highest-priority groups each contain seven topics. Every topic is shown below in its current priority group. To change a topic's importance, select <b>Move</b> and choose a new group or position. The intervening topics shift automatically; nothing is removed or exchanged.</p></div><span class="editor-change-count">${count} move${count===1?'':'s'}</span></div><div class="editor-targets" aria-label="Six destinations for dragging a topic">${BAND_NAMES.map((name,b)=>`<div class="editor-target" data-editor-drop="${b}" title="Drop a topic here to move it into this group"><strong>${esc(name)}</strong><small>${BAND_COUNTS[b]} topics · ${fmt(groupWeight(b)*100,0)}% collectively</small></div>`).join('')}</div><p class="sortnote">Drag onto a group above on desktop, or select Move next to any topic. The button also works with keyboard and touch.</p><div class="editor-controls"><div class="editor-control"><label for="editor-search">Find a topic</label><input type="search" id="editor-search" placeholder="Search title, code, or theme" value="${esc(state.editorQuery)}"></div><div class="editor-control"><label for="editor-filter">Filter by priority group</label><select id="editor-filter"><option value="all" ${state.editorFilter==='all'?'selected':''}>All six groups</option>${BAND_NAMES.map((n,i)=>`<option value="${i}" ${state.editorFilter===String(i)?'selected':''}>${esc(n)}</option>`).join('')}</select></div></div><div id="editor-items"></div><div class="editor-footer"><span id="editor-status" class="smallmuted" aria-live="polite"></span></div><div class="group-footer-controls"><button type="button" id="editor-undo" class="btn secondary" ${state.editorHistory.length?'':'disabled'}>Undo last move</button><button type="button" id="editor-reset" class="btn secondary" ${state.editorMoves.length?'':'disabled'}>Reset Page 5 changes</button></div>${count?`<details class="changes"><summary>See your recent topic moves</summary>${logs}</details>`:''}</section>`;
}
function filteredEditorTopics(c){
 const q=state.editorQuery.toLowerCase().trim();
 return c.topics.slice().sort((a,b)=>a.rank-b.rank).filter(t=> (state.editorFilter==='all'||String(t.band)===state.editorFilter) && (!q||(t.title+' '+t.code+' '+t.theme+' '+t.summary).toLowerCase().includes(q)));
}
function renderEditorItems(){
 if(state.page!==4||!document.getElementById('editor-items'))return;
 const c=calc(), filtered=filteredEditorTopics(c),root=document.getElementById('editor-items');
 root.innerHTML=filtered.length?`<div class="editor-group-list">${BAND_NAMES.map((name,i)=>{
  const members=filtered.filter(t=>t.band===i);if(!members.length)return '';
  return `<section class="editor-group" aria-label="${esc(name)}"><div class="editor-group-head"><h4>${esc(name)} <small>(${members.length} shown)</small></h4><small>${fmt(groupWeight(i)*100,0)}% collectively · ${fmt(bandWeight(i)*100,2)}% per topic</small></div>${members.map(t=>`<article class="editor-row" draggable="true" data-editor-topic="${esc(t.code)}"><div class="code">${esc(t.code)}</div><div class="editor-row-info"><strong>${esc(t.title)}</strong><small>Position ${t.rank} of 39 · ${esc(t.theme)}</small><details class="topic-explain"><summary>What does this topic cover?</summary><p>${esc(t.assesses||t.summary||'')}</p></details></div><div class="editor-row-weight" title="Share of the overall evaluation">${fmt(100*t.weight,2)}%</div><button type="button" class="btn secondary" data-open-move="${esc(t.code)}" aria-label="Move ${esc(t.title)} to a different priority group or position">Move</button></article>`).join('')}</section>`;
 }).join('')}</div>`:'<div class="empty-editor">No matching topics. Clear your search or choose another priority group.</div>';
 document.getElementById('editor-status').textContent=state.editorQuery||state.editorFilter!=='all'?`${filtered.length} of ${WB.topics.length} topics shown; clear search and filter to see all`:`All ${filtered.length} topics are visible across six groups`;
 root.querySelectorAll('[data-editor-topic]').forEach(el=>el.addEventListener('dragstart',evt=>{evt.dataTransfer.setData('text/plain',el.dataset.editorTopic);evt.dataTransfer.effectAllowed='move';}));
 wireMoveButtons(root);
}
function wireMoveButtons(root){root.querySelectorAll('[data-open-move]').forEach(b=>b.onclick=()=>openMove(b.dataset.openMove));}
function wireEditor(){
 const search=document.getElementById('editor-search'),select=document.getElementById('editor-filter');
 search.oninput=()=>{state.editorQuery=search.value;renderEditorItems();};
 select.onchange=()=>{state.editorFilter=select.value;renderEditorItems();};
 document.getElementById('editor-undo').onclick=()=>{const last=state.editorHistory.pop();if(!last)return;state.editorGroups=last.groups;state.editorMoves=last.moves;state.flash='Last topic move undone.';state.completed=false;checkpoint('topic_move_undone');render();};
 document.getElementById('editor-reset').onclick=()=>{state.editorGroups=null;state.editorHistory=[];state.editorMoves=[];state.flash='Page 5 changes reset. Your earlier choices remain.';state.completed=false;checkpoint('topic_moves_reset');render();};
 document.querySelectorAll('[data-editor-drop]').forEach(el=>{
  el.ondragover=evt=>{evt.preventDefault();el.classList.add('dragover');};
  el.ondragleave=()=>el.classList.remove('dragover');
  el.ondrop=evt=>{evt.preventDefault();el.classList.remove('dragover');const code=evt.dataTransfer.getData('text/plain');if(byCode[code])openMove(code,+el.dataset.editorDrop);};
 });
 wireMoveButtons(document.getElementById('stage'));
 renderEditorItems();
}
function rankBounds(b){const start=1+BAND_COUNTS.slice(0,b).reduce((a,n)=>a+n,0);return {start,end:start+BAND_COUNTS[b]-1};}
function defaultMoveRank(c,code,band){
 const from=c.byCode[code].rank,b=rankBounds(band);
 return band<c.byCode[code].band?b.start:band>c.byCode[code].band?b.end:from;
}

function openMove(code,target=null){
 const c=calc(),t=c.byCode[code];if(!t)return;
 const to=target===null?t.band:Number(target);
 state.modalFocusReturn=document.activeElement?.getAttribute?.('data-open-move')?code:null;
 state.moveDraft={code,from:t.band,target:to,targetRank:defaultMoveRank(c,code,to)};
 render();
 const select=document.getElementById('move-target');if(select)select.focus();
}
function moveModalHtml(c){
 const m=state.moveDraft;if(!m)return '';
 const t=c.byCode[m.code],band=Number(m.target),bounds=rankBounds(band);
 if(m.targetRank<bounds.start||m.targetRank>bounds.end)m.targetRank=defaultMoveRank(c,m.code,band);
 const sim=simulateInsertion(c,m.code,Number(m.targetRank));
 const groupChanges=sim.changed.filter(d=>d.code!==m.code);
 const samples=groupChanges.slice(0,5).map(d=>`<li>${esc(d.code)}: ${esc(BAND_NAMES[d.oldBand])} → ${esc(BAND_NAMES[d.newBand])}</li>`).join('');
 return `<div class="move-overlay" id="move-overlay" role="presentation"><div class="move-dialog" role="dialog" aria-modal="true" aria-labelledby="move-title" aria-describedby="move-help"><div class="picker-top"><div><div class="eyebrow">Optional change to your results</div><h3 id="move-title">Move ${esc(t.code)} to another position</h3></div><button class="picker-close" id="move-close" type="button" aria-label="Close move dialog">×</button></div><p><strong>${esc(t.title)}</strong><br>Currently position <b>${t.rank} of 39</b>, in ${esc(BAND_NAMES[t.band])} (${fmt(100*bandWeight(t.band),2)}% of the evaluation).</p><p id="move-help" class="sortnote">Choose a destination group, then the position within it. Other topics shift one place up or down to make room.</p><div class="move-fields"><div><label for="move-target">Destination group</label><select id="move-target" class="move-select">${BAND_NAMES.map((name,i)=>`<option value="${i}" ${i===band?'selected':''}>${esc(name)} · ${fmt(100*bandWeight(i),2)}% each</option>`).join('')}</select></div><div><label for="move-position">Place topic at</label><select id="move-position" class="move-select">${Array.from({length:bounds.end-bounds.start+1},(_,j)=>bounds.start+j).map(rank=>`<option value="${rank}" ${Number(m.targetRank)===rank?'selected':''}>Position ${rank} of 39${rank===bounds.start?' — start of group':rank===bounds.end?' — end of group':''}</option>`).join('')}</select></div></div><div class="move-preview"><strong>What will happen?</strong><p>${sim.shiftCount===0?'The topic is already at this position.':`${esc(t.code)} moves from position ${sim.fromRank} to ${sim.toRank}. ${sim.shiftCount} topic${sim.shiftCount===1?'':'s'} between those positions shift ${sim.toRank<sim.fromRank?'down':'up'} by one place.`}</p><p>${groupChanges.length} other topic${groupChanges.length===1?'':'s'} cross a group boundary. All group sizes stay fixed.</p>${samples?`<details><summary>See affected groups</summary><ul>${samples}${groupChanges.length>5?`<li>And ${groupChanges.length-5} more</li>`:''}</ul></details>`:''}</div><div class="move-score">Confirming this move will update the weighted differences between Little Jamaica and all comparator plans.</div><div class="move-dialog-actions"><button type="button" id="move-cancel" class="btn secondary">Cancel</button><button type="button" id="move-confirm" class="btn primary" ${sim.shiftCount===0?'disabled':''}>Confirm move</button></div></div></div>`;
}
function refreshMoveDialog(focusId='move-position'){
 const old=document.getElementById('move-overlay');if(old)old.remove();
 document.body.insertAdjacentHTML('beforeend',moveModalHtml(calc()));wireMoveModal();
 const element=document.getElementById(focusId);if(element)element.focus();
}
function wireMoveModal(){
 const overlay=document.getElementById('move-overlay');if(!overlay)return;
 const close=()=>{state.moveDraft=null;render();restoreModalFocus();};
 document.getElementById('move-close').onclick=close;
 document.getElementById('move-cancel').onclick=close;
 overlay.onclick=e=>{if(e.target===overlay)close();};
 document.getElementById('move-target').onchange=e=>{
  state.moveDraft.target=Number(e.target.value);
  state.moveDraft.targetRank=defaultMoveRank(calc(),state.moveDraft.code,state.moveDraft.target);
  refreshMoveDialog('move-position');
 };
 document.getElementById('move-position').onchange=e=>{state.moveDraft.targetRank=Number(e.target.value);refreshMoveDialog('move-position');};
 document.getElementById('move-confirm').onclick=commitMove;
}
function commitMove(){
 const m=state.moveDraft;if(!m)return;
 const c=calc(),sim=simulateInsertion(c,m.code,Number(m.targetRank));if(!sim.shiftCount)return;
 state.editorHistory.push({groups:state.editorGroups?state.editorGroups.map(g=>g.slice()):null,moves:state.editorMoves.slice()});
 state.editorGroups=sim.groups;state.editorSignature=preferenceSignature();
 state.editorMoves.push({moved:m.code,from:c.byCode[m.code].band,to:groupIndexMap(sim.groups)[m.code],fromRank:sim.fromRank,toRank:sim.toRank,shiftCount:sim.shiftCount});
 state.moveDraft=null;state.completed=false;
 state.flash=`${m.code} moved to position ${sim.toRank}. The intervening topics shifted ${sim.toRank<sim.fromRank?'down':'up'}.`;
 checkpoint('topic_moved',{topic:m.code,fromPosition:sim.fromRank,toPosition:sim.toRank});render();restoreModalFocus(m.code);
}
function planScore(c,i,scope,weighted,codes=null){
 const included=c.topics.filter(t=>!codes||codes.has(t.code));
 if(!included.length)return null;
 let numerator=0,denom=0;
 for(const t of included){
  const value=i===-1?t.score:(scope==='full'?t.comparatorFull[i]:t.comparatorVision[i]);
  if(typeof value!=='number'||!Number.isFinite(value))continue;
  const w=weighted?t.weight:1;numerator+=w*value;denom+=w;
 }
 return denom?numerator/denom:null;
}
function displayScore(value,isDelta){
 if(value===null||!Number.isFinite(value))return '—';
 return (isDelta&&value>0.0005?'+':'')+fmt(value,2);
}
function getPlanRows(c,scope,isDelta,codes=null){
 const localWeighted=planScore(c,-1,scope,true,codes),localEqual=planScore(c,-1,scope,false,codes);
 const rows=[{name:'Little Jamaica / Oakwood Vaughan — draft vision',short:'LJOVPF',local:true,weighted:localWeighted,equal:localEqual}];
 WB.comparators.forEach((name,i)=>rows.push({name:'Plan '+(i+1)+' · '+name,short:'Plan '+(i+1),local:false,weighted:planScore(c,i,scope,true,codes),equal:planScore(c,i,scope,false,codes)}));
 return rows.map(r=>({...r,weighted:isDelta?r.weighted-localWeighted:r.weighted,equal:isDelta?r.equal-localEqual:r.equal}));
}

// Topic-by-topic explanations always use the *same participant weights* and scope
// as the public comparison. They never expose the underlying 1-5 input ratings.
function topicDocumentRating(t,planIndex,scope){
 return planIndex===-1?t.score:(scope==='full'?t.comparatorFull[planIndex]:t.comparatorVision[planIndex]);
}
function topicDifferenceDrivers(c,scope,planIndex,referenceIndex){
 return c.topics.map(t=>({
  code:t.code,title:t.title,theme:t.theme,
  value:t.weight*(topicDocumentRating(t,planIndex,scope)-topicDocumentRating(t,referenceIndex,scope))
 })).filter(d=>Number.isFinite(d.value));
}
function whyContributionText(v){return (v>0?'+':'')+fmt(v,Math.abs(v)<0.01?3:2);}
function whyDriverList(drivers,positive,maxCount=4){
 const significant=drivers.filter(d=>positive?d.value>0.000001:d.value< -0.000001)
  .sort((a,b)=>positive?b.value-a.value:a.value-b.value).slice(0,maxCount);
 if(!significant.length)return '<p class="why-none">None of the 39 topics contributes in this direction.</p>';
 return `<ol class="why-driver-list">${significant.map(d=>`<li class="why-driver"><div class="why-driver-copy"><span class="code">${esc(d.code)}</span><span class="why-driver-title">${esc(d.title)}</span><span class="why-driver-theme">${esc(d.theme)}</span></div><strong class="why-driver-value ${d.value<0?'negative':'positive'}">${whyContributionText(d.value)}</strong></li>`).join('')}</ol>`;
}
function whyReasonForPlan(c,scope,planIndex){
 const rows=getPlanRows(c,scope,true).map((p,i)=>({...p,idx:i-1})).sort((a,b)=>b.weighted-a.weighted||a.name.localeCompare(b.name));
 const current=rows.find(p=>p.idx===planIndex);
 if(!current||planIndex===-1)return '<p class="why-none">Little Jamaica is the zero reference point. Choose a comparator to see which topics account for its position.</p>';
 const rank=rows.indexOf(current)+1;
 const drivers=topicDifferenceDrivers(c,scope,planIndex,-1);
 const higher=rank>1?rows[rank-2]:null;
 const lower=rank<rows.length?rows[rank]:null;
 const summary=`<div class="why-summary"><div class="why-rank-mark"><span>Position</span><b>${rank}<small> / ${rows.length}</small></b></div><div class="why-selected"><h4>${esc(WB.comparators[planIndex])}</h4><p><strong>${displayScore(current.weighted,true)}</strong> compared with Little Jamaica (0), using your selected topic weights.</p></div></div>`;
 const againstBaseline=`<div class="why-columns"><div class="why-direction why-up"><h5><span class="why-dot" aria-hidden="true"></span>Topics lifting its result</h5><p>Strongest positive contributions relative to Little Jamaica</p>${whyDriverList(drivers,true,4)}</div><div class="why-direction why-down"><h5><span class="why-dot" aria-hidden="true"></span>Topics lowering its result</h5><p>Strongest negative contributions relative to Little Jamaica</p>${whyDriverList(drivers,false,4)}</div></div>`;
 let neighbor='';
 if(higher){
  const gap=higher.weighted-current.weighted;
  const between=topicDifferenceDrivers(c,scope,higher.idx,planIndex);
  const leading=between.filter(d=>d.value>0.000001).sort((a,b)=>b.value-a.value).slice(0,3);
  const offsetting=between.filter(d=>d.value< -0.000001).sort((a,b)=>a.value-b.value).slice(0,2);
  const leadPhrase=higher.idx===-1?'Little Jamaica (the zero baseline)':WB.comparators[higher.idx];
  neighbor=`<div class="why-neighbor"><div class="why-neighbor-intro"><span class="why-eyebrow">Compared with the document directly above</span><h5>Why ${esc(leadPhrase)} ranks higher</h5><p>It is ahead by <strong>${fmt(gap,2)}</strong> weighted points. These topic differences explain the gap:</p></div><div class="why-neighbor-grid"><div><strong>Where the higher-ranked document gains ground</strong>${whyDriverList(leading,true,3)}</div><div><strong>Where ${esc(WB.comparators[planIndex])} gains ground</strong>${whyDriverList(offsetting.map(d=>({...d,value:-d.value})),true,2)}</div></div></div>`;
 }else if(lower){
  const gap=current.weighted-lower.weighted;
  neighbor=`<div class="why-neighbor why-leading"><span class="why-eyebrow">Highest in this comparison</span><p>This document leads the next-ranked document, ${esc(lower.idx===-1?'Little Jamaica':WB.comparators[lower.idx])}, by <strong>${fmt(gap,2)}</strong> weighted points.</p></div>`;
 }
 return `${summary}${againstBaseline}${neighbor}<p class="why-footnote">Contributions are calculated as your topic weight multiplied by the difference in the topic's assessment. The displayed contributions are the strongest drivers, not a complete list of all 39 topics.</p>`;
}
function whyPanel(c,scope,ordered){
 const opts=ordered.filter(p=>!p.local).map(p=>`<option value="${p.idx}" ${p.idx===state.explainPlan?'selected':''}>${esc(WB.comparators[p.idx])}</option>`).join('');
 return `<section class="why-panel" id="why-panel" aria-labelledby="why-panel-title"><div class="why-panel-heading"><div><span class="why-eyebrow">Understand the results</span><h3 id="why-panel-title">Why does this plan rank here?</h3><p>Explore which topics influence a plan's place in the comparison, based on your own priorities.</p></div><label class="why-selector">Choose a plan<select id="why-plan-select" aria-label="Choose a plan to explain">${opts}</select></label></div><div class="why-panel-body" id="why-panel-body" aria-live="polite">${whyReasonForPlan(c,scope,state.explainPlan)}</div></section>`;
}
function wireWhyPanel(){
 const box=document.getElementById('why-panel');if(!box)return;
 const select=document.getElementById('why-plan-select');
 const update=id=>{
  state.explainPlan=Number(id);
  select.value=String(state.explainPlan);
  document.getElementById('why-panel-body').innerHTML=whyReasonForPlan(calc(),state.scope,state.explainPlan);
  document.querySelectorAll('[data-explain-plan]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.explainPlan)===state.explainPlan)));
 };
 select.addEventListener('change',e=>update(e.target.value));
 document.querySelectorAll('[data-explain-plan]').forEach(b=>b.addEventListener('click',()=>{
  update(b.dataset.explainPlan);
  box.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  select.focus({preventScroll:true});
 }));
}

function matrixTable(c,groups,type,isDelta,scope,weighted){
 // Comparator columns use the same high-to-low order as the main result table.
 const ordered=getPlanRows(c,scope,true).slice().sort((a,b)=>b.weighted-a.weighted||a.name.localeCompare(b.name));
 const planHeads=ordered.map(p=>p.short);
 const headers=planHeads.map((h,i)=>`<th scope="col" title="${esc(ordered[i].name)}">${esc(h)}</th>`).join('');
 const prepared=groups.map(g=>{
  const byName=Object.fromEntries(getPlanRows(c,scope,isDelta,new Set(g.codes)).map(p=>[p.short,p]));
  const vals=ordered.filter(p=>!p.local).map(p=>byName[p.short]?.weighted).filter(Number.isFinite);
  const mean=vals.length?sum(vals)/vals.length:-Infinity;
  return {g,byName,mean};
 }).sort((a,b)=>b.mean-a.mean||a.g.name.localeCompare(b.g.name));
 const body=prepared.map(({g,byName,mean})=>{
  const planValues=planHeads.map((name,i)=>{
   const v=byName[name]?.weighted;
   return `<td class="${ordered[i].local?'local-cell':''} ${v<0?'below':''}">${displayScore(v,true)}</td>`;
  }).join('');
  return `<tr><th scope="row">${esc(g.name)}<small>${g.codes.length} topics</small></th><td class="group-mean ${mean<0?'below':''}">${displayScore(mean,true)}</td>${planValues}</tr>`;
 }).join('');
 return `<p class="key-text">Ordered from the highest to lowest <strong>average difference across comparator plans</strong>. Plan columns are also ordered from highest to lowest overall difference, with Little Jamaica at zero.</p><p class="swipe-hint">Swipe sideways to compare all plans &#8594;</p><div class="matrix-overflow" role="region" aria-label="Weighted differences from Little Jamaica by ${type} for eight comparator plans, sorted descending" tabindex="0"><table class="matrix-table"><thead><tr><th scope="col">${esc(type)}</th><th scope="col" title="Average difference across eight comparator plans">Average difference</th>${headers}</tr></thead><tbody>${body}</tbody></table></div><p class="key-text">LJOVPF = Little Jamaica's draft vision. Plan 1–8 are identified in the comparison table above. ${type==='Outcome'?'Topics may appear in more than one outcome.':''}</p>`;
}
function resultsPage(c){
 const scope=state.scope;
 // All public comparisons use the participant's six-band topic weights.
 // Little Jamaica is always the zero baseline in every view and category.
 const rows=getPlanRows(c,scope,true);
 const ordered=rows.map((p,i)=>({...p,idx:i-1})).sort((a,b)=>b.weighted-a.weighted||a.name.localeCompare(b.name));
 if(!Number.isInteger(state.explainPlan)||state.explainPlan<0||state.explainPlan>=WB.comparators.length)state.explainPlan=ordered.find(p=>!p.local).idx;
 const planRows=ordered.map(p=>`<tr class="${p.local?'highlight-plan':''}"><th scope="row">${esc(p.name)}</th><td class="${p.weighted<0?'below':''}">${displayScore(p.weighted,true)}</td><td class="why-action-cell">${p.local?'<span class="why-baseline-text">Reference</span>':`<button type="button" class="why-action" data-explain-plan="${p.idx}" aria-pressed="${p.idx===state.explainPlan}" aria-label="Explain ranking for ${esc(p.name)}">Why? <span aria-hidden="true">↗</span></button>`}</td></tr>`).join('');
 const themeRows=state.ranking.map(name=>{
  const before=c.baseAt1.shares[name]*100,after=c.base.shares[name]*100,final=c.actualShares[name]*100;
  return `<div class="theme-shares-row"><div><strong>${esc(name)}</strong><small>Theme rank ${state.ranking.indexOf(name)+1}</small></div><div class="theme-triple"><div style="width:${Math.min(100,before*3)}%"></div><div style="width:${Math.min(100,after*3)}%"></div><div style="width:${Math.min(100,final*3)}%"></div></div><div class="theme-values">${fmt(before,1)}% / ${fmt(after,1)}% / <b>${fmt(final,1)}%</b></div><div class="theme-diff">${final-before>=0?'+':''}${fmt(final-before,1)}%</div></div>`;
 }).join('');
 const themeGroups=WB.themes.map(t=>({name:t.name,codes:WB.topics.filter(x=>x.theme===t.name).map(x=>x.code)}));
 const outcomeGroups=OUTCOMES.map(o=>({name:o.title,codes:o.codes}));
 const summary=`<div class="result-top comparison-summary"><div class="resultstat baseline-stat"><div class="lab">Little Jamaica baseline</div><div class="num">0.00</div><div class="smallmuted">The reference for every comparison</div></div><div class="resultstat"><div class="lab">Comparator documents</div><div class="num">${WB.comparators.length}</div><div class="smallmuted">Compared with Little Jamaica</div></div><div class="resultstat"><div class="lab">Evaluation topics</div><div class="num">${WB.topics.length}</div><div class="smallmuted">Weighted using your choices</div></div></div>`;
 const controls=`<div class="comparison-controls"><fieldset><legend>Compare document coverage</legend><div class="toggle" role="group" aria-label="Compare document coverage"><button type="button" data-scope="vision" aria-pressed="${scope==='vision'}" class="${scope==='vision'?'selected':''}">Vision statements</button><button type="button" data-scope="full" aria-pressed="${scope==='full'}" class="${scope==='full'?'selected':''}">Full comparator documents</button></div></fieldset></div><p class="key-text">All results show the <strong>weighted difference from Little Jamaica (0)</strong>. Positive values mean the comparator addresses the topics more comprehensively; negative values mean less comprehensively.${scope==='full'?' Full comparator documents are measured against the available Little Jamaica draft vision.':''}</p>`;
 const plans=`<section class="comparison-section"><h3 class="sectiontitle">Planning Framework comparison</h3>${controls}<p class="key-text comparator-scope-note">North York at the Centre has been excluded because it is an ongoing Secondary Plan study, rather than a directly comparable framework document.</p><div class="plan-table-wrap"><table class="plan-table"><thead><tr><th scope="col">Planning document</th><th scope="col">Difference from Little Jamaica (0)</th><th scope="col" class="why-action-cell">Why?</th></tr></thead><tbody>${planRows}</tbody></table></div>${whyPanel(c,scope,ordered)}</section>`;
 const breakout=`<section class="comparison-section"><div class="breakdown-head"><div><h3 class="sectiontitle">Compare by planning theme and community outcome</h3><p class="key-text">Each value is the <strong>weighted difference</strong> from Little Jamaica for that theme or outcome. The Little Jamaica baseline is zero in every row.</p></div></div><h4 class="breakdown-title">By planning theme</h4>${matrixTable(c,themeGroups,'Theme',true,scope,true)}<h4 class="breakdown-title">By community outcome</h4>${matrixTable(c,outcomeGroups,'Outcome',true,scope,true)}</section>`;
 const methodology=`<details class="advanced-results"><summary>Explore the calculation and methodology</summary><div class="advanced-body"><h3>How theme priorities translate into weight</h3><div class="theme-key"><span><i class="key-before"></i>Theme ranking only</span><span><i class="key-after"></i>After outcome ranking</span><span><i class="key-final"></i>Final groups</span></div><div class="theme-shares">${themeRows}</div><p class="sortnote">Every topic in a theme inherits the same starting rank points. Outcome rankings then affect the provisional ordering; the six fixed group shares determine final topic weights.</p></div></details>`;
 return `${summary}${plans}${breakout}${methodology}${commentSection()}`;
}

// Community-wide comparisons are fetched from the same-origin collector.
// The standalone file shows individual results without fabricating peer averages.
function communityAverageEndpoint(){
 const endpoint=String(TRACKING_CONFIG.communityAverageEndpoint||'');
 if(!endpoint||!/^https?:$/.test(location.protocol))return '';
 try{const u=new URL(endpoint,location.href);return u.origin===location.origin?u.href:'';}catch(e){return '';}
}
async function loadCommunityAverage(force=false){
 if(state.communityLoading)return;
 const endpoint=communityAverageEndpoint();
 if(!endpoint){state.communityError='Community averages are not connected in this Round 1 preview. Your own priorities are shown; no sample responses are presented as community data.';state.communityData=null;render();return;}
 if(!force&&state.communityData&&Date.now()-state.communityFetchedAt<30000)return;
 state.communityLoading=true;state.communityError='';render();
 try{
  await flushCheckpoints();
  const reply=await fetch(endpoint,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json'}});
  if(!reply.ok)throw Error('Community comparison service not available');
  const data=await reply.json();
  if(!data||typeof data.count!=='number'||typeof data.available!=='boolean')throw Error('Invalid community summary');
  state.communityData=data;state.communityFetchedAt=Date.now();
 }catch(e){state.communityError='Community averages could not be loaded right now. Your own priorities are still displayed.';state.communityData=null;}
 finally{state.communityLoading=false;render();}
}
function communityPage(c){
 const data=state.communityData;
 const ready=!!data?.available;
 const tWeights=Object.fromEntries(c.topics.map(t=>[t.code,t.weight]));
 const ownThemes=Object.fromEntries(WB.themes.map(t=>[t.name,sum(c.topics.filter(x=>x.theme===t.name).map(x=>x.weight))]));
 const ownOutcomes=Object.fromEntries(OUTCOMES.map(o=>[o.id,sum(o.codes.map(code=>tWeights[code]||0))]));
 const view=state.communityView;
 let rows=[];
 if(view==='topics')rows=c.topics.map(t=>({key:t.code,name:t.code+' - '+t.title,detail:t.theme,you:t.weight,mean:data?.topicWeights?.[t.code]??null}));
 else if(view==='themes')rows=WB.themes.map(t=>({key:t.name,name:t.name,detail:`Your rank ${state.ranking.indexOf(t.name)+1}${ready?' | Community average rank '+fmt(data.themeRanks?.[t.name],1):''}`,you:ownThemes[t.name],mean:data?.themeWeights?.[t.name]??null}));
 else rows=OUTCOMES.map(o=>({key:o.id,name:o.title,detail:`Your rank ${state.outcomeRanking.indexOf(o.id)+1}${ready?' | Community average rank '+fmt(data.outcomeRanks?.[o.id],1):''}`,you:ownOutcomes[o.id],mean:data?.outcomeWeights?.[o.id]??null}));
 rows.sort((a,b)=>b.you-a.you||a.name.localeCompare(b.name));
 const top=Math.max(0.01,...rows.map(r=>Math.max(r.you,r.mean||0)));
 const rowHtml=rows.map(r=>{
  const youpct=100*r.you,meanpct=r.mean==null?null:100*r.mean;
  const diff=meanpct===null?null:youpct-meanpct;
  const entry=(name,val,average)=>`<div class="community-measure ${average?'average':''}"><span>${name}</span><div class="community-track"><span style="width:${Math.max(0,Math.min(100,(val/top)*100))}%"></span></div><b>${fmt(100*val,1)}%</b></div>`;
  return `<div class="community-row"><div class="community-label"><strong>${esc(r.name)}</strong><small>${esc(r.detail)}</small></div><div class="community-bars">${entry('You',r.you,false)}${ready&&r.mean!=null?entry('Average',r.mean,true):'<div class="community-measure average"><span>Average</span><div class="community-track"></div><b>-</b></div>'}</div><div class="community-gap ${diff!==null&&diff<0?'negative':''}">${diff===null?'—':(diff>0?'+':'')+fmt(diff,1)+' pp'}</div></div>`;
 }).join('');
 let status='';
 if(state.communityLoading)status='<div class="community-state" role="status">Loading completed community responses...</div>';
 else if(state.communityError)status=`<div class="community-state" role="status">${esc(state.communityError)}<div><button type="button" id="community-refresh" class="btn secondary">Try again</button></div></div>`;
 else if(data&&!data.available)status=`<div class="community-state" role="status"><strong>Community comparison not available yet.</strong> ${data.count} completed response${data.count===1?'':'s'} collected. The average will appear once at least ${data.minimum} completed responses are available.<div><button type="button" id="community-refresh" class="btn secondary">Check for new responses</button></div></div>`;
 else if(ready)status=`<div class="community-state"><strong>Based on ${data.count} distinct completed survey responses.</strong> Each response is counted once, using its latest saved topic placements. Your own completed response is included when it has reached the collection service. <button type="button" id="community-refresh" class="btn secondary">Refresh community average</button></div>`;
 const tabs=[['topics','39 topics'],['themes','7 planning themes'],['outcomes','5 community outcomes']].map(([id,label])=>`<button type="button" data-community-view="${id}" aria-pressed="${view===id}">${label}</button>`).join('');
 return `<section class="community-intro"><h3>See where your priorities align with the community</h3><p>Compare the share of evaluation weight you assigned with the average share from completed survey responses. The difference column is measured in percentage points.</p></section>${status}<div class="community-tabs" role="group" aria-label="Community comparison level">${tabs}</div><div class="community-legend"><span>Your priorities</span><span class="average">Community average</span></div><p class="community-average-note">Sorted by your highest to lowest weight. ${view==='outcomes'?'Because topics can belong to several outcomes, outcome percentages overlap and do not add to 100%.':view==='themes'?'Theme percentages add to 100%.':'All 39 topic weights add to 100%.'}</p><div class="community-rows">${rowHtml}</div><p class="community-average-note">Differences here describe <strong>importance weights</strong>, not the City's document scores. No email addresses or other participants' individual answers are shown.</p>`;
}
function wireCommunityPage(){
 document.querySelectorAll('[data-community-view]').forEach(btn=>btn.onclick=()=>{state.communityView=btn.dataset.communityView;render();});
 const refresh=document.getElementById('community-refresh');if(refresh)refresh.onclick=()=>{state.communityError='';state.communityData=null;loadCommunityAverage(true);};
}

function insight(){document.getElementById('insight')?.remove();}

function invalidatePreferences(){state.decisions={};state.history=[];state.completed=false;state.gapPromotions=[];state.gapSelected=[];state.flash='Topic choices were reset because the initial priority ordering changed.';}
function validEmail(value){return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
function syncEmailInput(){const field=document.getElementById('participant-email');if(field){state.email=field.value.trim();field.required=false;field.setCustomValidity('');}return state.email.trim();}
function syncOptIns(){
 const available=!!state.email.trim()&&validEmail(state.email.trim());
 for(const [id,key] of [['newsletter-opt-in','newsletterOptIn'],['planning-opt-in','planningOptIn']]){const input=document.getElementById(id);if(!input)continue;input.disabled=!available;if(!state.email.trim()){state[key]=false;input.checked=false;}}
 const help=document.getElementById('opt-in-help');if(help)help.textContent=available?'These are separate choices. Neither subscription is required to participate.':'Add an email above to enable these choices. Neither subscription is required to participate.';
}
function wireParticipantDetails(){
 document.querySelectorAll('[data-connection]').forEach(box=>box.onchange=()=>{const id=box.dataset.connection;state.connections=box.checked?[...new Set([...state.connections,id])]:state.connections.filter(x=>x!==id);scheduleDraft();});
 const field=document.getElementById('participant-email');if(field){field.required=false;field.oninput=()=>{syncEmailInput();syncOptIns();scheduleDraft();};field.onchange=field.oninput;}
 for(const [id,key] of [['newsletter-opt-in','newsletterOptIn'],['planning-opt-in','planningOptIn']]){const box=document.getElementById(id);if(box)box.onchange=()=>{state[key]=box.checked;scheduleDraft();};}
 syncOptIns();
}

function moveTheme(index,dir){const j=index+dir;if(j<0||j>=7)return;const [x]=state.ranking.splice(index,1);state.ranking.splice(j,0,x);state.movedTheme=true;state.completed=false;if(Object.keys(state.decisions).length)invalidatePreferences();render();}
function wireRank(){
 document.querySelectorAll('[data-shift]').forEach(b=>b.addEventListener('click',()=>moveTheme(+b.dataset.index,+b.dataset.shift)));
 let from=null;
 document.querySelectorAll('.rankitem').forEach(el=>{
  el.addEventListener('dragstart',e=>{from=+el.dataset.rank;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(from));});
  el.addEventListener('dragover',e=>e.preventDefault());
  el.addEventListener('drop',e=>{e.preventDefault();const to=+el.dataset.rank;if(from===null||to===from)return;const [x]=state.ranking.splice(from,1);state.ranking.splice(to,0,x);state.movedTheme=true;state.completed=false;if(Object.keys(state.decisions).length)invalidatePreferences();render();});
 });
}
function setDecision(code,d){
 if(!byCode[code])return;state.completed=false;
 const previous=JSON.stringify(state.decisions);
 const current=state.decisions[code];
 if(d&&d.kind==='pin'&&current&&current.kind==='pin'&&current.band===d.band){delete state.decisions[code];}
 else if(d)state.decisions[code]=d;
 else delete state.decisions[code];
 if(JSON.stringify(state.decisions)!==previous){state.history.push(previous);try{calc();}catch(e){state.decisions=JSON.parse(previous);state.history.pop();state.flash=e.message;}}
 render();
}
function minBandCount(decisions){return Object.values(decisions).filter(d=>d.kind==='min'&&d.band>=3).length;}
function takeAction(action,code,band){
 if(action==='replace'){openPicker(band,code);return;}
 if(action==='keep'){setDecision(code,{kind:'pin',band});return;}
 const minimum=action==='half'?3:band+1;
 if(action==='half'&&minBandCount(state.decisions)>=BAND_COUNTS.slice(3).reduce((a,b)=>a+b,0)&&!(state.decisions[code]&&state.decisions[code].kind==='min'&&state.decisions[code].band===3)){
  state.flash='The lower-priority groups are full. Restore another topic first.';render();return;
 }
 setDecision(code,{kind:'min',band:minimum});
}
function replaceTopic(band,displaced,promoted){
 const c=calc();
 if(!byCode[promoted]||!c.groups[band].includes(displaced)||c.groups[band].includes(promoted))return;
 if(band>0&&c.groups.slice(0,band).some(g=>g.includes(promoted)))return;
 const previous=JSON.stringify(state.decisions);
 state.decisions[displaced]={kind:'min',band:band+1};
 state.decisions[promoted]={kind:'pin',band};
 state.history.push(previous);state.completed=false;
 try{calc();state.picker=null;state.flash=`${promoted} now belongs to ${BAND_NAMES[band]}. ${displaced} moved lower.`;}
 catch(e){state.decisions=JSON.parse(previous);state.history.pop();state.flash=e.message;}
 render();
}
function restoreAll(){if(!Object.keys(state.decisions).length)return;state.history.push(JSON.stringify(state.decisions));state.decisions={};render();}
function wirePriority(){
 document.querySelectorAll('[data-topic-action]').forEach(b=>b.addEventListener('click',()=>takeAction(b.dataset.topicAction,b.dataset.code,+b.dataset.priorityBand)));
 document.querySelectorAll('[data-restore]').forEach(b=>b.addEventListener('click',()=>setDecision(b.dataset.restore,null)));
 const undo=document.getElementById('undo');if(undo)undo.onclick=()=>{if(!state.history.length)return;state.decisions=JSON.parse(state.history.pop());render();};
 const clear=document.getElementById('clear');if(clear)clear.onclick=restoreAll;
}
function pickerHtml(){
 if(!state.picker)return '';
 const band=state.picker.band,drop=byCode[state.picker.displaced];
 return `<div class="picker-overlay" id="picker-overlay"><div role="dialog" aria-modal="true" aria-labelledby="picker-title" class="picker-dialog"><div class="picker-top"><div><div class="eyebrow">Choose a replacement</div><h3 id="picker-title">Replace ${esc(drop.code)} in ${BAND_NAMES[band]}</h3></div><button id="picker-close" class="picker-close" aria-label="Close picker" type="button">&times;</button></div><p class="smallmuted">Select another evaluation topic to promote into this group. ${esc(drop.code)} will move below this group. Search results display five topics at a time.</p><label class="picker-label" for="picker-query">Search by topic, theme, or code</label><input type="search" id="picker-query" autocomplete="off" placeholder="Try tenant, implementation, cultural space..."><div id="picker-count" class="sortnote"></div><div id="picker-results" class="picker-results"></div><div class="picker-pager"><button id="picker-prev" class="btn secondary" type="button">Previous</button><span id="picker-page" class="smallmuted"></span><button id="picker-next" class="btn secondary" type="button">Next</button></div></div></div>`;
}
function openPicker(band,displaced){state.picker={band,displaced,query:'',page:0};render();const input=document.getElementById('picker-query');if(input)input.focus();}
function wirePicker(){
 if(!state.picker)return;
 const overlay=document.getElementById('picker-overlay'),input=document.getElementById('picker-query');
 document.getElementById('picker-close').onclick=closePicker;
 overlay.addEventListener('click',e=>{if(e.target===overlay)closePicker();});
 input.addEventListener('input',()=>{state.picker.query=input.value;state.picker.page=0;renderPickerResults();});
 document.getElementById('picker-prev').onclick=()=>{state.picker.page=Math.max(0,state.picker.page-1);renderPickerResults();};
 document.getElementById('picker-next').onclick=()=>{state.picker.page+=1;renderPickerResults();};
 renderPickerResults();
}
function closePicker(){state.picker=null;render();}
function renderPickerResults(){
 const p=state.picker;if(!p)return;
 const c=calc();
 const disallowed=new Set(c.groups[p.band]);
 if(p.band>0)c.groups.slice(0,p.band).forEach(group=>group.forEach(code=>disallowed.add(code)));
 const q=p.query.toLowerCase().trim();
 const candidates=c.base.initialOrder.filter(code=>!disallowed.has(code)).map(code=>byCode[code]).filter(t=>(t.code+' '+t.title+' '+t.summary+' '+t.theme).toLowerCase().includes(q));
 const pages=Math.max(1,Math.ceil(candidates.length/5));p.page=Math.min(p.page,pages-1);
 const visible=candidates.slice(p.page*5,p.page*5+5);
 document.getElementById('picker-count').textContent=`${candidates.length} eligible topics`;document.getElementById('picker-results').innerHTML=visible.length?visible.map(t=>`<button type="button" class="picker-result" data-promote="${esc(t.code)}"><span class="code">${esc(t.code)}</span><span><strong>${esc(t.title)}</strong><small>${esc(t.theme)} &middot; Currently ${BAND_NAMES[c.byCode[t.code].band]}</small></span><span class="pickplus">Promote &rarr;</span></button>`).join(''):'<div class="picker-empty">No matching topics. Try a broader term.</div>';
 document.getElementById('picker-page').textContent=`Page ${p.page+1} of ${pages}`;
 document.getElementById('picker-prev').disabled=p.page===0;document.getElementById('picker-next').disabled=p.page>=pages-1;
 document.querySelectorAll('[data-promote]').forEach(b=>b.addEventListener('click',()=>replaceTopic(p.band,p.displaced,b.dataset.promote)));
}
function csvText(c){
 const ids=['coord','remain','wealth','power','systemic'];
 const header=['response_id','checkpoint_revision','answer_revision','survey_version','source_version','position','code','theme','topic',...ids.map(id=>'membership_'+id),...ids.map(id=>'rank_'+id),
  'outcome_memberships','outcome_multiplier_highest','outcome_multiplier_second','outcome_multiplier_third',
  'highest_contribution','second_contribution_one_eighth','third_contribution_one_sixteenth','combined_outcome_multiplier',
  'theme_rank','theme_points_per_topic','provisional_score','page1_theme_share_pct','page2_theme_share_pct',
  'final_theme_share_pct','priority_group','group_share_pct','per_topic_weight_pct','manual_decision','LJOVPF_rating_1_to_5',
  ...WB.comparators.flatMap((name,i)=>['comparator_'+(i+1)+'_vision_rating','comparator_'+(i+1)+'_full_document_rating'])];
 const q=x=>'"'+String(x??'').replaceAll('"','""')+'"';
 const rows=c.topics.slice().sort((a,b)=>a.rank-b.rank).map(t=>{
  const parts=t.appliedComponents;
  return [record.responseId,record.revision,record.answerRevision,SURVEY_VERSION,SOURCE_VERSION,t.rank,t.code,t.theme,t.title,...ids.map(id=>t.outcomeFlags[id]),
   ...ids.map(id=>t.outcomes.includes(id)?state.outcomeRanking.indexOf(id)+1:''),
   t.outcomes.map(id=>OUTCOMES.find(o=>o.id===id).title).join('; '),
   ...[0,1,2].map(i=>parts[i]?.multiplier??''),
   ...[0,1,2].map(i=>parts[i]?.contribution??''),
   t.appliedBoost,state.ranking.indexOf(t.theme)+1,c.base.rankScores[t.theme],c.base.byWeight[t.code],
   c.baseAt1.shares[t.theme]*100,c.base.shares[t.theme]*100,c.actualShares[t.theme]*100,
   BAND_NAMES[t.band],groupWeight(t.band)*100,t.weight*100,
   t.manual?`${t.manual.kind}:${t.manual.band}`:'automatic',t.score,
   ...WB.comparators.flatMap((name,i)=>[t.comparatorVision[i],t.comparatorFull[i]])];
 });
 return '\ufeff'+header.map(q).join(',')+'\r\n'+rows.map(row=>row.map(q).join(',')).join('\r\n');
}
function download(name,mime,content){const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}

function restoreModalFocus(code=null){
 const target=code||state.modalFocusReturn;
 if(target){const btn=Array.from(document.querySelectorAll('[data-open-move]')).find(el=>el.dataset.openMove===target);if(btn){btn.focus({preventScroll:true});return;}}
 document.getElementById('editor-search')?.focus({preventScroll:true});
}
function surveyPayload(){
 const c=calc();
 return {type:'Little Jamaica community weighting survey trial',version:SURVEY_VERSION,sourceVersion:SOURCE_VERSION,responseId:record?.responseId||null,checkpointRevision:record?.revision||0,answerRevision:record?.answerRevision||0,recordedAt:new Date().toISOString(),completedAt:record?.lastCompletedAt||null,inputEvidence:{themeOrderChanged:state.movedTheme,outcomeOrderChanged:state.movedOutcomes,continuedPages:record?.continuedPages||[],page3GroupsReviewed:record?.reviewedPage3Groups||[],coreStepsCompleted:[1,2,3].every(p=>(record?.continuedPages||[]).includes(p))&&(record?.reviewedPage3Groups||[]).length===2},status:record?.status||'in_progress',sourceWorkbook:WB.filename,topicCount:WB.topics.length,themeRanking:state.ranking.slice(),outcomeRanking:state.outcomeRanking.slice(),connections:state.connections.slice(),email:state.email.trim(),communications:{resultsUpdates:!!state.email.trim(),newsletter:!!state.email.trim()&&state.newsletterOptIn,littleJamaicaUpdates:!!state.email.trim()&&state.planningOptIn,noticeVersion:'ljov-consent-v1'},outcomeMultipliers:outcomeFactors(),priorityGroups:c.groups.map((codes,i)=>({group:BAND_NAMES[i],totalShare:groupWeight(i),topics:codes.slice()})),topicWeights:c.topics.map(t=>({code:t.code,position:t.rank,group:BAND_NAMES[t.band],weight:t.weight})),score:c.current,comparisonScope:state.scope,notes:state.feedback.trim(),manualPage3Changes:copy(state.decisions),manualPage5Moves:copy(state.editorMoves)};
}
async function finishSurvey(){
 checkpoint('complete',{completionPage:state.page+1});
 render();
 document.getElementById('finish-status')?.scrollIntoView({block:'center',behavior:'smooth'});
 await flushCheckpoints();
 updateCompletionMessage();
}
document.addEventListener('keydown',event=>{
 const overlay=document.querySelector('#move-overlay, #picker-overlay');
 if(!overlay)return;
 if(event.key==='Escape'){
  event.preventDefault();
  if(state.moveDraft){state.moveDraft=null;render();restoreModalFocus();}
  else if(state.picker){state.picker=null;render();}
  return;
 }
 if(event.key==='Tab'){
  const active=Array.from(overlay.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),[href]')).filter(el=>el.getClientRects().length);
  if(!active.length)return;
  const first=active[0],last=active[active.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
});


function commentSection(){
 return `<section class="comment-section" id="comments"><h3>Share your comments (optional)</h3><p>Is there anything else we should know about how the Planning Framework should be evaluated?</p><label class="sr-only" for="survey-feedback">Your comments</label><textarea id="survey-feedback" rows="3" maxlength="1500" placeholder="Your comments (optional)">${esc(state.feedback)}</textarea><div class="comment-actions"><button id="share-comments" type="button" class="btn primary">Share my comments</button><span id="comment-status" class="smallmuted" role="status" aria-live="polite"></span></div><details class="participant-download"><summary>Save a copy or return later</summary><div class="save-actions"><button type="button" class="btn secondary" id="copy-return-link">Copy private return link</button><button type="button" class="btn secondary" id="exportcsv">Download topic weights (CSV)</button><button type="button" class="btn secondary" id="exportjson">Download full response (JSON)</button></div></details></section>`;
}
function editorPage(c){return `<div class="editor-mini-summary"><span>Optional: move a topic into any priority group. Other topics shift to make room.</span><button type="button" class="btn secondary" id="return-results">Return to results</button></div>${editorSection(c)}`;}
function wireCompletion(){
 const input=document.getElementById('survey-feedback');if(!input)return;
 input.oninput=e=>{state.feedback=e.target.value;scheduleDraft();};
 const share=document.getElementById('share-comments');
 share.onclick=async()=>{
  const status=document.getElementById('comment-status');
  if(!state.feedback.trim()){status.textContent='Add a comment above, or skip this optional section.';input.focus();return;}
  checkpoint('comments_shared',{hasComments:true});await flushCheckpoints();
  status.textContent=checkpointEndpoint()?(record.confirmedRevision===record.revision?'Your comment was received.':'Your comment is saved here; online receipt is pending.'):'Your comment is saved in this trial. It has not been sent online.';
 };
 document.getElementById('exportcsv').onclick=()=>download('LJ-'+record.responseId+'-39-topic-weights.csv','text/csv;charset=utf-8',csvText(calc()));
 document.getElementById('exportjson').onclick=downloadRecord;const resumeBtn=document.getElementById('copy-return-link');if(resumeBtn)resumeBtn.onclick=copyPrivateReturnLink;
}
function applyReadonly(){
 const closed=location.protocol!=='file:' && (!collectionState.checked||!collectionState.isOpen);
 document.body.classList.toggle('survey-readonly',closed);
 if(!closed)return;
 const controls=['#stage input','#stage textarea','#stage select',
  '[data-shift]','[data-shift-outcome]','[data-topic-action]','[data-restore]',
  '[data-open-move]','#move-confirm','#undo','#clear','#share-comments',
  '#clear-gap','#editor-reset'];
 for(const el of document.querySelectorAll(controls.join(',')))el.disabled=true;
 for(const el of document.querySelectorAll('#stage [draggable="true"]'))el.draggable=false;
 if(state.page<=2){const next=document.getElementById('next');if(next)next.disabled=true;}
}
function render(){
 state.resultsMode='gap';state.matrixWeighting='weighted';const c=calc();document.body.dataset.page=String(state.page+1);nav();hdr();insight(c);const stage=document.getElementById('stage');
 if(state.page===0){stage.innerHTML=rankingPage(c);wireRank();wireParticipantDetails();}
 else if(state.page===1){stage.innerHTML=multiplierPage(c);wireOutcomeRank();}
 else if(state.page===2){stage.innerHTML=refinementPage(c);wireRefinement();}
 else if(state.page===3){
  stage.innerHTML=resultsPage(c);
  document.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{state.scope=b.dataset.scope;render();});
  wireWhyPanel();
  wireCompletion();
 }else if(state.page===4){stage.innerHTML=editorPage(c);wireEditor();document.getElementById('return-results').onclick=()=>navigate(3,'back');}
 else {stage.innerHTML=communityPage(c);wireCommunityPage();if(!state.communityData&&!state.communityLoading&&!state.communityError)loadCommunityAverage();}
 const footer=document.getElementById('footerbar');
 if(state.page===3){
  footer.innerHTML='<div class="after-results-actions"><button type="button" id="next" class="btn primary">Adjust individual topics (optional) &rarr;</button><button type="button" id="to-community" class="btn community-button">Compare my priorities with the community &rarr;</button></div>';
  document.getElementById('next').onclick=()=>navigate(4,'continue');
  document.getElementById('to-community').onclick=()=>navigate(5,'community_viewed');
 }else if(state.page===4){
  footer.innerHTML='<div class="after-results-actions"><button type="button" id="back" class="btn secondary">&larr; Return to results</button><button type="button" id="to-community" class="btn community-button">Compare my priorities with the community &rarr;</button></div>';
  document.getElementById('back').onclick=()=>navigate(3,'back');
  document.getElementById('to-community').onclick=()=>navigate(5,'community_viewed');
 }else if(state.page===5){
  footer.innerHTML='<button type="button" id="back" class="btn secondary">&larr; Back to my results</button>';
  document.getElementById('back').onclick=()=>navigate(3,'back');
 }else{
  const nextLabel=state.page===0?'This is how I would prioritize themes':state.page===1?'This is how I would prioritize outcomes':state.refineBand===0?'Review the next seven topics':'This is what I would prioritize highest';
  const backLabel=state.page===2&&state.refineBand===1?'&larr; Previous seven topics':'&larr; Back';
  footer.innerHTML=`${state.page===0?'':`<button type="button" id="back" class="btn secondary">${backLabel}</button>`}<button type="button" id="next" class="btn primary">${nextLabel} &rarr;</button>`;
  if(state.page>0)document.getElementById('back').onclick=()=>{if(state.page===2&&state.refineBand===1){checkpoint('back',{destinationPage:3,destinationSubstep:1});state.refineBand=0;render();scrollPage();}else navigate(state.page-1,'back');};
  document.getElementById('next').onclick=()=>{
   if(state.page===0){const email=syncEmailInput();syncOptIns();if(email&&!validEmail(email)){document.getElementById('participant-email').setCustomValidity('Please enter a valid email address, or leave it blank.');document.getElementById('participant-email').reportValidity();return;}}
   if(state.page===2&&state.refineBand===0){checkpoint('continue',{destinationPage:3,destinationSubstep:2});state.refineBand=1;render();scrollPage();}
   else if(state.page===2&&state.refineBand===1){
    checkpoint('continue',{destinationPage:4});checkpoint('complete',{completionPage:3,corePriorities:true});navigate(3,'view_results');
   }else navigate(state.page+1,'continue');
  };
 }
 let notice=document.getElementById('trial-flash');if(notice)notice.remove();
 if(state.flash){notice=document.createElement('div');notice.id='trial-flash';notice.className='trial-flash';notice.setAttribute('role','status');notice.textContent=state.flash;stage.prepend(notice);state.flash='';}
 document.getElementById('picker-overlay')?.remove();if(state.picker){document.body.insertAdjacentHTML('beforeend',pickerHtml());wirePicker();}
 document.getElementById('move-overlay')?.remove();if(state.moveDraft){document.body.insertAdjacentHTML('beforeend',moveModalHtml(calc()));wireMoveModal();}
 saveDraft();applyReadonly();
}
function scrollPage(){window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});document.getElementById('page-heading')?.focus({preventScroll:true});}
function navigate(page,kind='navigation'){
 page=Math.max(0,Math.min(5,page));if(page>=3&&!record?.firstCompletedAt)return;if(page===state.page)return;
 if(collectionState.checked&&!collectionState.isOpen){
  state.page=page;state.picker=null;state.moveDraft=null;render();scrollPage();return;
 }
 checkpoint(kind,{destinationPage:page+1});
 if(page>=3&&!record.firstResultsAt){
  record.preResultsSnapshot=copy(surveyPayload());checkpoint('before_first_results',{destinationPage:page+1});record.firstResultsAt=new Date().toISOString();
 }
 state.page=page;state.picker=null;state.moveDraft=null;
 record.visitedPages=Array.from(new Set([...record.visitedPages,page+1]));render();scrollPage();
 if(page>=3)checkpoint(page===3?'results_viewed':page===4?'editor_viewed':'community_viewed');
}
function go(page){navigate(page,'navigation');}
// Private capability-based response persistence. Optional email and separate communication consent.
const SURVEY_VERSION='ljov-round2-connected-v1';
const SOURCE_VERSION=METHOD.id;
const STORAGE_PREFIX='cip.ljov.round2.v1.';
const SESSION_ID=newId();
let record=null,storageProblem='',networkProblem='',syncing=false,draftTimer=null,restored=false;
function newId(){
 if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
 if(globalThis.crypto?.getRandomValues){const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
 throw Error('This browser cannot create a secure random response ID. Please use a current browser.');
}
const copy=x=>JSON.parse(JSON.stringify(x));
const SAVE_FIELDS=['communityView','page','ranking','outcomeRanking','decisions','history','scope','movedTheme','movedOutcomes','refineBand','editorGroups','editorSignature','editorHistory','editorMoves','feedback','connections','email','newsletterOptIn','planningOptIn','resultsMode','matrixWeighting','completed'];
function serialState(){return Object.fromEntries(SAVE_FIELDS.map(k=>[k,copy(state[k])]));}
function answerData(){return {themeRanking:state.ranking.slice(),outcomeRanking:state.outcomeRanking.slice(),page3Decisions:copy(state.decisions),finalOrder:state.editorGroups?state.editorGroups.flat():null,connections:state.connections.slice(),email:state.email,newsletterOptIn:state.newsletterOptIn,planningOptIn:state.planningOptIn,notes:state.feedback};}
function checkpointEndpoint(){
 const value=String(TRACKING_CONFIG.checkpointEndpoint||'');
 if(!value||!TRACKING_CONFIG.collectPartial||!/^https?:$/.test(location.protocol))return '';
 try{const u=new URL(value,location.href);return u.origin===location.origin?u.href:'';}catch(e){return '';}
}
function randomizedOrder(values){
 const a=values.slice();
 for(let i=a.length-1;i>0;i--){
  let r;
  if(globalThis.crypto?.getRandomValues){const q=new Uint32Array(1);crypto.getRandomValues(q);r=q[0]/4294967296;}
  else r=Math.random();
  const j=Math.floor(r*(i+1));[a[i],a[j]]=[a[j],a[i]];
 }
 return a;
}
function initTracking(){
 try{
  const active=localStorage.getItem(STORAGE_PREFIX+'active');
  const saved=active?JSON.parse(localStorage.getItem(STORAGE_PREFIX+active)||'null'):null;
  if(saved&&(saved.surveyVersion===SURVEY_VERSION||(saved.surveyVersion==='ljov-five-pages-participant-ux-v2'&&saved.sourceVersion==='ljov-20261109-five-page-ux-v2'))){
   if(saved.surveyVersion!==SURVEY_VERSION){saved.outbox=[];saved.migratedFrom=saved.surveyVersion;}
   saved.surveyVersion=SURVEY_VERSION;saved.sourceVersion=SOURCE_VERSION;
   if(!Array.isArray(saved.events)||!Array.isArray(saved.outbox)||!saved.draft)throw Error('Saved response is incomplete');
   record=saved;for(const k of SAVE_FIELDS)if(k in saved.draft)state[k]=saved.draft[k];
   const validOrder=(a,b)=>Array.isArray(a)&&a.length===b.length&&new Set(a).size===b.length&&a.every(x=>b.includes(x));
   if(!validOrder(state.ranking,WB.themes.map(t=>t.name))||!validOrder(state.outcomeRanking,OUTCOMES.map(o=>o.id)))throw Error('Saved ranking is incompatible');
   if(state.editorGroups)validateGroups(state.editorGroups);
   state.page=Math.max(0,Math.min(5,Number(state.page)||0));state.communityView=['topics','themes','outcomes'].includes(state.communityView)?state.communityView:'topics';state.refineBand=state.refineBand===1?1:0;
   restored=true;
  }
 }catch(e){storageProblem='Your previous save could not be restored. A new response has been opened; the old record has not been deleted.';record=null;}
 if(!record){
  Object.assign(state,{page:0,communityView:'topics',ranking:WB.themes.map(t=>t.name),outcomeRanking:OUTCOMES.map(o=>o.id),decisions:{},history:[],scope:'vision',movedTheme:false,movedOutcomes:false,refineBand:0,editorGroups:null,editorSignature:null,editorHistory:[],editorMoves:[],feedback:'',connections:[],email:'',newsletterOptIn:false,planningOptIn:false,resultsMode:'gap',matrixWeighting:'weighted',completed:false});
  state.ranking=WB.themes.map(t=>t.name).sort((a,b)=>a.localeCompare(b,'en'));
  state.outcomeRanking=randomizedOrder(OUTCOMES.map(o=>o.id));
  const now=new Date().toISOString();
  record={responseId:newId(),responseToken:newId()+newId(),surveyVersion:SURVEY_VERSION,sourceVersion:SOURCE_VERSION,createdAt:now,lastSavedAt:null,lastServerReceiptAt:null,revision:0,answerRevision:0,lastAnswer:null,events:[],outbox:[],draft:null,visitedPages:[],continuedPages:[],status:'in_progress',firstResultsAt:null,preResultsSnapshot:null,firstCompletedAt:null,lastCompletedAt:null,lastCompletedAnswer:null,confirmedRevision:null,initialDisplayOrder:{themes:state.ranking.slice(),outcomes:state.outcomeRanking.slice()}};
 }
 record.visitedPages=Array.from(new Set([...record.visitedPages,state.page+1]));
 saveDraft();
}
function persistRecord(){
 try{localStorage.setItem(STORAGE_PREFIX+record.responseId,JSON.stringify(record));localStorage.setItem(STORAGE_PREFIX+'active',record.responseId);storageProblem='';return true;}
 catch(e){storageProblem='This browser could not save your progress. Keep this tab open and download a copy before leaving.';return false;}
}
function saveDraft(){
 if(!record)return false;
 const current=JSON.stringify(answerData());
 if(record.lastCompletedAnswer&&current!==record.lastCompletedAnswer){record.status='edited_after_completion';state.completed=false;}
 record.draft=serialState();record.lastSavedAt=new Date().toISOString();
 const ok=persistRecord();updateSaveStatus();return ok;
}
function scheduleDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,350);}
function changesSincePrevious(){
 const current=answerData(),prev=record.lastAnswer;
 return Object.keys(current).filter(k=>!prev||JSON.stringify(current[k])!==JSON.stringify(prev[k]));
}
function checkpoint(kind,meta={}){
 clearTimeout(draftTimer);
 const changes=changesSincePrevious(),now=new Date().toISOString();
 if(changes.length)record.answerRevision++;
 record.revision++;
 if(kind==='continue'){record.continuedPages=Array.from(new Set([...record.continuedPages,state.page+1]));if(state.page===2)record.reviewedPage3Groups=Array.from(new Set([...(record.reviewedPage3Groups||[]),state.refineBand]));}
 if(kind==='complete'){
  record.status='completed';record.firstCompletedAt=record.firstCompletedAt||now;record.lastCompletedAt=now;record.lastCompletedAnswer=JSON.stringify(answerData());state.completed=true;
 }
 const event={eventId:newId(),responseId:record.responseId,sessionId:SESSION_ID,surveyVersion:SURVEY_VERSION,sourceVersion:SOURCE_VERSION,sourceWorkbook:WB.filename,revision:record.revision,answerRevision:record.answerRevision,eventType:kind,clientTimestamp:now,page:state.page+1,substep:state.page===2?state.refineBand+1:null,status:record.status,afterResultsShown:!!record.firstResultsAt,changedFields:changes,visitedPages:record.visitedPages.slice(),continuedPages:record.continuedPages.slice(),initialDisplayOrder:copy(record.initialDisplayOrder),...meta,snapshot:surveyPayload(),resumeState:serialState()};
 record.events.push(event);record.outbox.push(event.eventId);record.lastAnswer=copy(answerData());
 saveDraft();flushCheckpoints();return event;
}
async function flushCheckpoints(){
 const endpoint=checkpointEndpoint();
 if(!endpoint||syncing||!record.outbox.length)return;
 syncing=true;networkProblem='';updateSaveStatus();
 try{
  while(record.outbox.length){
   const id=record.outbox[0],event=record.events.find(x=>x.eventId===id);
   if(!event)throw Error('A queued checkpoint is missing');
   const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);
   let reply;
   try{reply=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+record.responseToken},credentials:'same-origin',body:JSON.stringify(event),signal:abort.signal});}
   finally{clearTimeout(timer);}
   if(reply.status===423){collectionState.isOpen=false;collectionState.checked=true;applyReadonly();throw Error('Survey closed');}
   if(!reply.ok)throw Error('Save service returned '+reply.status);
   const receipt=await reply.json();
   if(receipt.eventId!==id||!receipt.receivedAt)throw Error('The save service did not confirm this checkpoint');
   record.outbox.shift();record.lastServerReceiptAt=receipt.receivedAt;record.confirmedRevision=Math.max(record.confirmedRevision||0,event.revision);persistRecord();
  }
 }catch(e){networkProblem=e.message==='Survey closed'?'This survey has closed. Earlier saved responses remain available, but unsent changes cannot be accepted.':'Your answers have not reached Community in Public yet. They remain on this device. Please retry when connected.';}
 finally{syncing=false;updateSaveStatus();updateCompletionMessage();}
}
function updateSaveStatus(){
 let box=document.getElementById('save-problem');if(!networkProblem&&!storageProblem){box?.remove();return;}
 if(!box){box=document.createElement('div');box.id='save-problem';box.className='save-problem';box.setAttribute('role','status');document.getElementById('footerbar').insertAdjacentElement('beforebegin',box);}
 box.innerHTML='<p>'+esc(storageProblem||networkProblem)+'</p><button type="button" class="btn secondary" id="retry-save">Retry saving</button>';
 document.getElementById('retry-save').onclick=flushCheckpoints;
}
function trackingBanner(){return "";}
function wireTracking(){}
function recordBundle(){
 saveDraft();
 return {schema:'ljov-response-checkpoints-v1',responseId:record.responseId,surveyVersion:SURVEY_VERSION,sourceVersion:SOURCE_VERSION,sourceWorkbook:WB.filename,createdAt:record.createdAt,exportedAt:new Date().toISOString(),status:record.status,firstCompletedAt:record.firstCompletedAt,lastCompletedAt:record.lastCompletedAt,firstResultsAt:record.firstResultsAt,preResultsSnapshot:copy(record.preResultsSnapshot),latestResponse:surveyPayload(),visitedPages:record.visitedPages.slice(),continuedPages:record.continuedPages.slice(),lastServerReceiptAt:record.lastServerReceiptAt,confirmedRevision:record.confirmedRevision,checkpoints:copy(record.events)};
}
function downloadRecord(){download('LJ-'+record.responseId+'-checkpoints.json','application/json;charset=utf-8',JSON.stringify(recordBundle(),null,2));}
function updateCompletionMessage(){}
window.addEventListener('online',flushCheckpoints);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveDraft();});
// Prevent a second tab from silently overwriting newer checkpoints for the same ID.
window.addEventListener('storage',e=>{
 if(record&&e.key===STORAGE_PREFIX+record.responseId){
  try{const other=JSON.parse(e.newValue||'null');if(other&&other.revision>record.revision){alert('This response was updated in another tab. This tab will reload the latest checkpoint.');record=null;location.reload();}}catch(err){}
 }
});

initTracking();

window.__ljovTrial={state,calc,startingCalc,assignBands,bandWeight,groupWeight,BAND_COUNTS,BAND_FACTORS,BAND_NAMES,FACTOR_TOTAL,takeAction,replaceTopic,simulateInsertion,navigate,checkpoint,recordBundle,get record(){return record;}};
render();
if(window.LJOV_RESUME)resumeRemoteResponse(window.LJOV_RESUME);else flushCheckpoints();
if(TRACKING_CONFIG.statusEndpoint)checkCollectionStatus();

async function checkCollectionStatus(){
 const note=document.getElementById('round-notice');
 try{
  const response=await fetch(TRACKING_CONFIG.statusEndpoint,{cache:'no-store'});
  if(!response.ok)throw Error('Status unavailable');
  const info=await response.json();
  collectionState={checked:true,isOpen:info.configured===true&&info.isOpen===true,
   closesAt:info.closesAt||null,mode:info.mode||'test'};
  const closing='January 15, 2027, at 11:59 p.m. Toronto time';
  if(note)note.textContent=!info.configured?'Online saving is unavailable. Please return later.':
   collectionState.isOpen?'Test survey: responses are saved separately from public voting. You may revise until '+closing+'.':
   'The survey is closed. You may review your saved response using your private link.';
 }catch{
  collectionState.checked=true;collectionState.isOpen=false;
  if(note)note.textContent='Survey availability could not be verified. Please check your connection.';
 }
 applyReadonly();
}
async function copyPrivateReturnLink(){
 await flushCheckpoints();const button=document.getElementById('copy-return-link');
 if(!checkpointEndpoint()||record.outbox.length){button.textContent='Save online first, then copy your link';return;}
 const link=location.origin+location.pathname+'#resume='+encodeURIComponent(record.responseId+'.'+record.responseToken);
 try{await navigator.clipboard.writeText(link);button.textContent='Private link copied - keep it safe';}
 catch{download('Little-Jamaica-private-return-link.txt','text/plain;charset=utf-8',link+'\nKeep this link private: it allows access to your answers.');}
}
async function resumeRemoteResponse(value){
 window.LJOV_RESUME=null;const match=/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{64,128})$/.exec(value||'');
 if(!match){state.flash='This return link is not valid. Your existing answers have not been changed.';render();return;}
 try{
  const reply=await fetch('/api/resume',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+match[2]},body:JSON.stringify({responseId:match[1],sourceVersion:SOURCE_VERSION})});
  if(!reply.ok)throw Error('The saved response could not be opened.');const data=await reply.json();
  if(data.sourceVersion!==SOURCE_VERSION||!data.resumeState)throw Error('This response uses a different version of the survey.');
  const validOrder=(a,b)=>Array.isArray(a)&&a.length===b.length&&new Set(a).size===b.length&&a.every(x=>b.includes(x));
  if(!validOrder(data.resumeState.ranking,WB.themes.map(t=>t.name))||!validOrder(data.resumeState.outcomeRanking,OUTCOMES.map(o=>o.id)))throw Error('The saved rankings cannot be restored.');
  if(data.resumeState.editorGroups)validateGroups(data.resumeState.editorGroups);
  for(const key of SAVE_FIELDS)if(key in data.resumeState)state[key]=data.resumeState[key];
  record={responseId:match[1],responseToken:match[2],surveyVersion:SURVEY_VERSION,sourceVersion:SOURCE_VERSION,createdAt:data.createdAt,lastSavedAt:null,lastServerReceiptAt:data.updatedAt,revision:data.revision,answerRevision:data.answerRevision,lastAnswer:null,events:[],outbox:[],draft:null,visitedPages:data.visitedPages||[],continuedPages:data.continuedPages||[],reviewedPage3Groups:data.reviewedPage3Groups||[],status:data.status,firstResultsAt:data.firstResultsAt,preResultsSnapshot:data.preResultsSnapshot||null,firstCompletedAt:data.firstCompletedAt,lastCompletedAt:data.lastCompletedAt,lastCompletedAnswer:null,confirmedRevision:data.revision,initialDisplayOrder:data.initialDisplayOrder};
  record.lastAnswer=copy(answerData());if(record.firstCompletedAt)record.lastCompletedAnswer=JSON.stringify(answerData());
  state.page=record.firstCompletedAt?3:Math.max(0,Math.min(2,Number(state.page)||0));state.flash='Your saved priorities have been restored.';saveDraft();render();applyReadonly();
 }catch(e){state.flash=e.message+' Please retry using the same private return link.';render();}
}
