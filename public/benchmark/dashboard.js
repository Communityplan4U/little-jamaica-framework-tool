'use strict';
(() => {
  const DATA = window.BENCHMARK_DATA;
  const DIRECTORY = window.BENCHMARK_COUNCILLORS;
  const SCORING = window.BenchmarkScoring;
  const $ = id => document.getElementById(id);
  if (!DATA || !['framework','tor'].every(view => ['studies','criteria','categories'].every(key => Array.isArray(DATA[view]?.[key]))) || !Array.isArray(DATA.framework.topics) || !Array.isArray(DIRECTORY?.people) || !DIRECTORY.mapping?.framework || !DIRECTORY.mapping?.tor || typeof SCORING?.calculate !== 'function') {
    $('chart').innerHTML='<p class="empty-state">The assessment could not be loaded. Please refresh the page, or open the original community assessment.</p>';
    return;
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const signed = (value, places = 2) => `${value > 0.00000001 ? '+' : value < -0.00000001 ? '−' : ''}${Math.abs(value).toFixed(places)}`;
  const percent = value => `${(value * 100).toFixed(1).replace(/\.0$/, '')}%`;
  const safeUrl = value => {try {const url = new URL(value);return /^https?:$/.test(url.protocol) ? url.href : '#';} catch {return '#';}};
  const link = (url, label, className = '') => `<a class="${className}" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  const people = Object.fromEntries((DIRECTORY?.people || []).map(person => [person.id, person]));
  const initial = new URLSearchParams(location.search);
  const state = {view: initial.get('view') === 'tor' ? 'tor' : 'framework',scope: initial.get('scope') === 'vision' ? 'vision' : 'full',category:'all',sort:['score','name','year'].includes(initial.get('sort')) ? initial.get('sort') : 'score',representatives:initial.get('people') === 'current' ? 'current' : 'historical',search:initial.get('q') || '',selected:initial.get('study') || 'ljovpf',weightModes:{framework:'default',tor:'default'},customWeights:{framework:{},tor:{}},evidence:false};
  state.stage=['draft','adopted','final-study','framework-version'].includes(initial.get('stage'))?initial.get('stage'):'all';
  if (DATA?.[state.view]?.categories.some(category => category.id === initial.get('area'))) state.category = initial.get('area');
  if (['default','equal','custom'].includes(initial.get('weights'))) state.weightModes[state.view] = initial.get('weights');
  if (state.weightModes[state.view] === 'custom') {
    try {const parsed = JSON.parse(initial.get('custom') || '{}');if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw Error('Invalid weights');state.customWeights[state.view] = parsed;} catch {state.weightModes[state.view] = 'default';}
  }
  let calculation = null, visibleStudies = [], toastTimer, lastModalTrigger = null, weightDraft = null;
  const dataset = () => DATA[state.view];
  const mapping = study => DIRECTORY.mapping[state.view]?.[study.id] || {historical:[],current:[],wards:[],sources:[],note:'Representation information has not been verified.'};
  const representatives = study => (mapping(study)[state.representatives] || []).map(id => people[id]).filter(Boolean);
  const shortName = study => study.isReference ? 'Little Jamaica' : study.shortName || study.name;
  const dateLabel = study => state.view === 'framework' ? study.documentDate : mapping(study).historicalPeriod || 'Assessed TOR';
  const barDate = study => state.view === 'tor' && study.isReference ? '2026 study period' : state.view === 'tor' && !(mapping(study).wards || []).length ? 'Citywide' : dateLabel(study);
  const year = study => study.documentYear || Number((dateLabel(study).match(/20\d{2}/) || [0])[0]);
  const bodyLabel = study => state.view === 'framework' ? study.isReference ? 'Working draft' : study.documentType === 'Community development action plan' ? 'Action plan' : 'Planning framework' : study.body || 'Terms of reference';
  const weightLabel = () => ({default:state.view === 'framework' ? 'Survey defaults' : 'Approved weights',equal:state.view === 'framework' ? 'Equal topic weights' : 'Equal area weights',custom:'Custom weights'})[state.weightModes[state.view]];
  const icon = kind => ({calendar:'<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="5" width="14" height="12" rx="2"/><path d="M6 3v4M14 3v4M3 9h14"/></svg>',pin:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15 8c0 4-5 9-5 9S5 12 5 8a5 5 0 0110 0z"/><circle cx="10" cy="8" r="1.5"/></svg>',document:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 2h8l4 4v12H4zM11 2v5h5M7 11h6M7 14h5"/></svg>',group:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3"/><path d="M6 21v-4a6 6 0 0112 0v4M3 17v-2a4 4 0 014-4M21 17v-2a4 4 0 00-4-4"/></svg>'})[kind];
  const photo = (person, className = '') => `<img class="${className}" src="./assets/portraits/${esc(person.portrait)}" alt="${esc(person.name)}" width="44" height="44" style="object-position:${esc(person.objectPosition || '50% 20%')}" loading="eager">`;
  function toast(message) {clearTimeout(toastTimer);$('toast').textContent = message;$('toast').hidden = false;toastTimer = setTimeout(() => {$('toast').hidden = true;}, 4200);}
  function urlForView() {
    const url = new URL(location.href);url.hash = '';url.search = '';
    for (const [key, value] of Object.entries({view:state.view,scope:state.scope,area:state.category,stage:state.stage,sort:state.sort,people:state.representatives,study:state.selected,weights:state.weightModes[state.view],q:state.search})) if (value) url.searchParams.set(key,value);
    if (state.weightModes[state.view] === 'custom') url.searchParams.set('custom',JSON.stringify(state.customWeights[state.view]));
    return url;
  }
  function updateUrl() {history.replaceState(null,'',urlForView());}
  function recalculate() {
    try {calculation = SCORING.calculate(dataset(),{scope:state.scope,category:state.category,weightMode:state.weightModes[state.view],customWeights:state.customWeights[state.view]});}
    catch(error) {state.category='all';state.weightModes[state.view]='default';state.customWeights[state.view]={};calculation=SCORING.calculate(dataset(),{scope:state.scope,category:'all',weightMode:'default'});toast('This view had invalid or zero weights. The source assessment defaults have been restored.');}
  }
  function render() {
    recalculate();
    const query = state.search.trim().toLocaleLowerCase();
    const matches = calculation.studies.filter(study => (state.view==='tor'||state.stage==='all'||study.stageGroup===state.stage) && (!query || [study.name,study.body || '',...representatives(study).map(person => person.name),...mapping(study).wards.map(ward => `ward ${ward}`)].join(' ').toLocaleLowerCase().includes(query)));
    visibleStudies = matches.length ? calculation.studies.filter(study => study.isReference || matches.includes(study)) : [];
    visibleStudies.sort((a,b) => a.isReference ? -1 : b.isReference ? 1 : state.sort === 'name' ? a.name.localeCompare(b.name) : state.sort === 'year' ? year(b)-year(a) || a.name.localeCompare(b.name) : b.value-a.value || a.name.localeCompare(b.name));
    if (!visibleStudies.some(study => study.id === state.selected) && visibleStudies.length) state.selected=visibleStudies[0].id;
    document.querySelectorAll('[data-view]').forEach(button => {const active=button.dataset.view === state.view;button.classList.toggle('is-active',active);button.setAttribute('aria-selected',active);button.tabIndex=active ? 0 : -1;});
    $('comparison-content').setAttribute('aria-labelledby',`${state.view}-tab`);
    $('category-filter').innerHTML='<option value="all">All assessment areas</option>'+dataset().categories.map(category=>`<option value="${esc(category.id)}">${esc(category.name)}</option>`).join('');
    $('category-filter').value=state.category;$('scope-filter').value=state.scope;$('scope-filter').closest('label').hidden=state.view==='tor';$('sort-filter').value=state.sort;$('representative-mode').value=state.representatives;$('study-search').value=state.search;
    $('stage-filter').value=state.stage;$('stage-filter').closest('label').hidden=state.view==='tor';
    $('weight-label').textContent=weightLabel();$('framework-count').textContent=DATA.framework.studies.length;$('tor-count').textContent=DATA.tor.studies.length;
    $('chart-kicker').textContent=state.view==='framework' ? 'PLANNING FRAMEWORK COMPARISON' : 'COMMUNITY GOVERNANCE COMPARISON';
    $('comparison-title').textContent=state.view==='framework' ? 'What’s written into the plans?' : 'What do the written rules make possible?';
    const category=dataset().categories.find(item=>item.id===state.category);
    $('chart-description').textContent=category ? `${category.name} · compared with Little Jamaica` : `${dataset().studies.length} ${state.view==='framework'?'planning documents':'advisory bodies'} · ${dataset().criteria.length} criteria · ${dataset().categories.length} assessment areas${query||state.stage!=='all'&&state.view==='framework'?` · ${visibleStudies.length} shown, including reference`:''}`;
    $('chart-meaning').innerHTML='<strong>0 is the reference point, not a quality score.</strong> Positive scores mean stronger written coverage than Little Jamaica; negative scores mean less.';
    $('scope-notice').hidden=state.view!=='framework';
    $('scope-notice').textContent=state.scope==='full' ? 'Scope: Little Jamaica’s preliminary working draft vision is compared with full comparator documents. These materials differ in stage and purpose.' : 'Scope: comparator vision statements are compared with Little Jamaica’s preliminary working draft Community Visioning Statement.';
    $('chart-scroll').hidden=!visibleStudies.length;$('no-results').hidden=!!visibleStudies.length;
    renderChart();renderDetail();if(state.evidence) renderEvidence();
    $('data-version').textContent=`Assessment sources: Framework ${DATA.framework.methodologyId} · TOR ${DATA.tor.methodologyId} · Council information checked ${DIRECTORY.mapping.checkedOn}`;
    updateUrl();
  }
  function chartGeometry(studies) {
    const values=studies.map(study=>study.value);const min=Math.min(0,...values),max=Math.max(0,...values);
    const step=state.view==='tor'?3:Math.max(Math.abs(min),max)>2?1:Math.max(Math.abs(min),max)>1?.5:.25;
    const lo=min<0?Math.floor(min/step)*step:0,hi=Math.max(step,Math.ceil(max/step)*step);
    const top=98,bottom=331,scale=(bottom-top)/(hi-lo),y=value=>bottom-(value-lo)*scale;
    const ticks=[];for(let value=lo;value<=hi+step/10;value+=step)ticks.push({value,y:y(value)});
    return {lo,hi,step,y,ticks,zero:y(0)};
  }
  function renderChart() {
    if(!visibleStudies.length) {$('chart').innerHTML='';return;}
    const geometry=chartGeometry(calculation.studies), count=visibleStudies.length;
    $('chart').style.minWidth=`${Math.max(700,count*(state.view==='tor'?137:131)+78)}px`;
    const grid=`<span class="chart-unit">Δ POINTS</span><div class="chart-grid">${geometry.ticks.map(tick=>`<div class="grid-line ${Math.abs(tick.value)<1e-8?'is-zero':''}" style="top:${tick.y}px"><span>${tick.value===0?'0':signed(tick.value,state.view==='tor'?0:geometry.step<1?2:0)}</span></div>`).join('')}</div>`;
    const bars=visibleStudies.map(study=>{
      const value=study.value,positive=value>=0,zero=Math.abs(value)<1e-9,barTop=positive?geometry.y(value):geometry.zero,height=Math.abs(geometry.y(value)-geometry.zero),council=representatives(study);
      const label=council.length===1?council[0].name:council.length?`${council.length} ward councillors`:'Citywide body';
      const photos=council.length?council.map(person=>photo(person)).join(''):`<span class="portrait-initials">${icon('group')}</span>`;
      const tag=study.isReference?'Reference':state.view==='framework'?bodyLabel(study):(study.body||'TOR').replace(/Stakeholder Advisory Committee(?: \(SAC\))?/,'SAC').replace(/Local Advisory Committee(?: \(LAC\))?/,'LAC').replace(/Community Advisory Committee(?: \(CAC\))?/,'CAC').replace('Community Working Group','Working group');
      return `<button class="chart-column ${study.isReference?'is-local':''} ${state.selected===study.id?'is-selected':''}" data-study="${esc(study.id)}" type="button" aria-pressed="${state.selected===study.id}" aria-label="${esc(study.name)}: ${signed(value)} points relative to Little Jamaica. ${esc(council.map(person=>person.name).join(', ')||'Citywide body')}. Select to view the assessment."><span class="data-bar ${positive?'':'negative'} ${zero?'zero-marker':''}" style="top:${barTop}px;height:${zero?4:height}px"></span><span class="bar-cap" style="top:${barTop-6}px;transform:translateY(-100%)"><span class="bar-value">${signed(value)}</span><span class="portrait-stack ${council.length>2?'many':''}">${photos}</span><span class="bar-people-label">${esc(label)}</span></span><span class="bar-label"><span class="bar-name">${esc(shortName(study))}</span><span class="bar-date">${esc(barDate(study))}</span><span class="bar-tag">${esc(tag)}</span></span></button>`;
    }).join('');
    $('chart').innerHTML=grid+`<div class="chart-columns" style="--count:${count}">${bars}</div>`;
  }
  function renderDetail() {
    const study=calculation.studies.find(item=>item.id===state.selected)||calculation.studies.find(item=>item.isReference);
    const local=calculation.studies.find(item=>item.isReference);const map=mapping(study),council=representatives(study);
    const historical=state.representatives==='historical';
    const wards=map.wards?.length?`Ward${map.wards.length>1?'s':''} ${map.wards.join(', ')}`:'Citywide';
    const peopleCards=council.map(person=>{const ward=historical?map.historicalWardLabels?.[person.id] || `Ward ${person.ward}`:`Ward ${person.ward}`;return `<div class="representative-card">${photo(person)}<div>${link(person.profileUrl,person.name)}<small>${esc(ward)}</small></div></div>`;}).join('');
    const selectedCategory=dataset().categories.find(category=>category.id===state.category);
    const categories=study.categories.filter(category=>!selectedCategory || category.id===selectedCategory.id);
    const max=Math.max(.0001,...categories.map(category=>Math.abs(category.value)));
    const relativeRows=categories.map(category=>`<div class="breakdown-row"><span class="breakdown-label">${esc(category.name)}<small>${percent(category.weight)} of this view</small></span><span class="mini-track ${Math.abs(category.value)<1e-8?'zero':''}"><span class="mini-bar ${category.value<0?'negative':''}" style="display:block;width:${Math.abs(category.value)/max*100}%"></span></span><span class="breakdown-number">${signed(category.value)}</span></div>`).join('');
    let representationNote=historical ? `${map.historicalPeriod || 'Documented study period'}. ${map.note || ''}` : `Current ward representation, checked ${DIRECTORY.mapping.checkedOn}. This identifies who represents the area today; it does not attribute earlier decisions to them.`;
    if(!council.length) representationNote=map.note || 'This is a citywide body with no single local ward councillor.';
    const representationSource=historical?(map.sources?.length?` ${link(map.sources[0],'Representation source')}`:''):` ${link('https://www.toronto.ca/city-government/council/members-of-council/','Current council directory')}`;
    const rawNote=state.view==='framework'?(study.isReference?`Little Jamaica’s weighted written-coverage rating is <strong>${study.raw.toFixed(2)} / 5</strong>. The relative chart sets this as the zero reference.`:`Weighted written-coverage ratings: ${esc(shortName(study))} <strong>${study.raw.toFixed(2)} / 5</strong>; Little Jamaica <strong>${local.raw.toFixed(2)} / 5</strong>.`):'Each criterion compares the written provisions: +1 stronger comparator provision, 0 comparable, −1 stronger Little Jamaica provision.';
    $('study-detail').innerHTML=`<div class="study-overview"><div class="detail-eyebrow"><p class="section-kicker">SELECTED ${state.view==='framework'?'STUDY':'ADVISORY BODY'}</p><span class="document-badge ${study.isReference&&state.view==='framework'?'draft':''}">${esc(state.view==='framework'?study.documentStatus:'Terms of reference')}</span></div><h2 id="study-title">${esc(study.name)}</h2><p class="document-subtitle">${esc(state.view==='tor'?study.body:study.documentType)}</p><div class="document-meta"><span>${icon('calendar')}${esc(dateLabel(study))}</span><span>${icon('pin')}${esc(wards)}</span></div><div class="source-actions">${link(study.sourceUrl,state.view==='framework'?'Read source document':'Read terms of reference','button button-primary')}${study.proposalsUrl?link(study.proposalsUrl,'Proposals report','button'):''}${study.studyUrl?link(study.studyUrl,'Study website','button'):''}${study.decisionUrl?link(study.decisionUrl,'City decision','button'):''}</div>${study.stageNote?`<p class="representation-note document-stage-note">${esc(study.stageNote)}</p>`:''}<div class="representatives"><div class="representatives-heading"><h3>${historical?'Study-period councillors':'Current ward councillors'}</h3></div>${council.length?`<div class="representative-list">${peopleCards}</div>`:`<p class="document-subtitle">Citywide accountability body</p>`}<p class="representation-note">${esc(representationNote)}${representationSource}</p></div></div><div class="breakdown"><div class="breakdown-top"><div><h3>${study.isReference?'Little Jamaica is the reference':'Where the difference comes from'}</h3><p>${selectedCategory?esc(selectedCategory.name):'Contribution of each assessment area to the overall difference'}</p></div><div class="total-score"><strong>${signed(study.value)}</strong><span>relative points</span></div></div>${relativeRows}<p class="breakdown-note">${rawNote}<br>Area contributions add to the displayed total before rounding. ${study.isReference?'Compare another study to see where its written provisions differ.':''}</p>${study.lead?`<p class="breakdown-note"><strong>Lead team in the assessment:</strong> ${esc(study.lead)}${study.support&&study.support!=='None confirmed'?`<br><strong>Supporting divisions:</strong> ${esc(study.support)}`:''}</p>`:''}</div>`;
  }
  function renderEvidence() {
    const study=calculation.studies.find(item=>item.id===state.selected)||calculation.studies.find(item=>item.isReference);
    const criteria=dataset().criteria.filter(criterion=>state.category==='all'||(criterion.categoryId||criterion.area)===state.category);
    const rows=criteria.map(criterion=>{
      const category=dataset().categories.find(item=>item.id===(criterion.categoryId||criterion.area));const weight=calculation.weights[criterion.id]||0;
      if(state.view==='framework') {
        const rating=study.ratings[criterion.id][state.scope];
        return `<tr><td><span class="criterion-title">${esc(criterion.name)}</span><span class="criterion-category">${esc(category.name)} · ${percent(weight)} weight</span></td><td class="rating-cell">${rating} / 5</td><td class="rating-cell">${criterion.localScore} / 5</td><td><p>${esc(criterion.description)}</p>${link(study.sourceUrl,'Read source document','citation-link')}</td></tr>`;
      }
      const evidence=study.evidence.find(item=>item.criterionId===criterion.id),rating=study.ratings[criterion.id];
      const label=study.isReference?'Reference':rating>0?'Comparator stronger':rating<0?'Little Jamaica stronger':'Comparable';
      return `<tr><td><span class="criterion-title">${esc(criterion.name)}</span><span class="criterion-category">${esc(category.name)} · ${percent(weight)} weight</span><details><summary>Assessment criterion</summary><p>${esc(criterion.description)}</p></details></td><td class="rating-cell">${study.isReference?'0':signed(rating,0)}<span class="criterion-category">${label}</span></td><td colspan="2"><p>${esc(study.isReference?evidence.localSummary:evidence.rationale)}</p>${!study.isReference?`<details><summary>Compare the written provisions</summary><p><strong>Little Jamaica:</strong> ${esc(evidence.localSummary)}</p><p><strong>${esc(shortName(study))}:</strong> ${esc(evidence.comparatorSummary)}</p></details>`:''}<p class="criterion-category">${esc(evidence.sourceSection).replace(/\n/g,'<br>')}</p>${link(study.sourceUrl,'Read TOR source','citation-link')}</td></tr>`;
    }).join('');
    const header=state.view==='framework'?`<th scope="col">${esc(shortName(study))}</th><th scope="col">Little Jamaica</th><th scope="col">What the criterion assesses</th>`:'<th scope="col">Comparison</th><th scope="col" colspan="2">Assessment rationale and source sections</th>';
    const intro=state.view==='framework'?'These are the source assessment’s 1–5 criterion ratings. The dataset supplies the criterion definitions and source documents; it does not include criterion-level quotations or page citations.':'The provision summaries and rationales below come from the approved TOR assessment. They are summaries, not verbatim quotations. Each comparison preserves its source page or section references.';
    $('evidence-content').innerHTML=`<p class="evidence-intro">${esc(intro)}</p><div class="evidence-table-scroll" tabindex="0" role="region" aria-label="Detailed assessment table"><table class="evidence-table"><thead><tr><th scope="col">Assessment criterion</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function showModal(title,kicker,content) {lastModalTrigger=document.activeElement;$('modal-title').textContent=title;$('modal-kicker').textContent=kicker;$('modal-body').innerHTML=content;$('modal').showModal();}
  function closeModal() {$('modal').close();if(lastModalTrigger?.isConnected)lastModalTrigger.focus();}
  function showMethodology() {
    const fw=DATA.framework,tor=DATA.tor;
    const credits=DIRECTORY.people.map(person=>`<li>${link(person.portraitSource,person.name)} — ${esc(person.portraitCredit)}${person.licenseUrl?` · ${link(person.licenseUrl,'Licence')}`:''}</li>`).join('');
    showModal('How to read this comparison','METHOD & SOURCES',`<p>Community in Public compares selected written commitments in planning documents and advisory committee terms of reference. The assessments can identify opportunities to strengthen housing, cultural continuity and community decision-making.</p><h3>A zero reference, not a grade</h3><p>Little Jamaica is the reference and is shown as 0. Positive scores indicate stronger written coverage in a comparator; negative scores indicate stronger written coverage in Little Jamaica. The score does not measure implementation, overall planning quality or individual performance.</p><h3>Planning frameworks</h3><p>${fw.studies.length} documents, ${fw.topics.length} public topics and ${fw.criteria.length} underlying criteria. Each criterion is rated on the source assessment’s 1–5 scale.</p><div class="scale-list"><strong>1</strong><span>Not addressed</span><strong>2</strong><span>Acknowledged</span><strong>3</strong><span>Partially developed</span><strong>4</strong><span>Substantively developed</span><strong>5</strong><span>Comprehensive</span></div><div class="method-formula">Framework difference = weighted comparator rating − weighted Little Jamaica rating. The theoretical difference ranges from −4 to +4.</div><p>${esc(fw.weightingNote)} Equal topic weights assign 5% to each of the 20 topics. Custom weights redistribute weight among these same topics.</p><p><strong>Scope matters.</strong> Little Jamaica’s assessed document is a preliminary working draft vision. “Full comparator documents” compares that draft with full documents that can differ in stage, purpose and authority. The vision-statement view narrows the comparator material. Neither view is a causal test of councillor performance.</p><p>${link(fw.sourceSite,'Original Framework assessment')} · ${link(fw.sourceRepository,'Framework source and version history')}</p><h3>Advisory committee terms of reference</h3><p>${tor.studies.length} bodies and ${tor.criteria.length} criteria, grouped into five governance areas. The source assessment contains 120 approved comparator judgments: +1 for a stronger comparator provision, 0 for a comparable provision and −1 for a stronger Little Jamaica provision.</p><div class="method-formula">TOR difference = 12 × sum of each area’s weight × its mean signed criterion rating. The theoretical score ranges from −12 to +12.</div><ul>${tor.categories.map(category=>`<li>${esc(category.name)}: <strong>${percent(category.defaultWeight)}</strong></li>`).join('')}</ul><p>Equal weights give each governance area 20%. Custom weights change the area shares. Within an area, criteria share the area’s weight equally. Framework and TOR scores have different scales and cannot be compared with each other.</p><p>${link(tor.sourceRepository,'TOR source and approved assessment')} · Revision ${esc(tor.methodologyId)}</p><h3>Filters and weighting</h3><p>A single-area filter renormalizes that area’s included weights to 100%. A search only changes which studies are shown. The orange Little Jamaica reference remains visible with matching studies. Scores shown in the dashboard use source defaults or your selected weights; they are not live community survey averages. Values are rounded for display. Exported data retains additional precision.</p><h3>Why councillors appear above the bars</h3><p>Portraits identify representatives associated with the study area. “During the study” uses documented study or committee periods. “Currently representing the area” uses ward representation checked on ${esc(DIRECTORY.mapping.checkedOn)}. Historical ward changes and uncertain issue dates are noted in the selected study. Current representatives are not assigned responsibility for earlier decisions. Citywide bodies have no single ward portrait.</p><h3>Image credits and representation sources</h3><details><summary>View portrait credits</summary><ul>${credits}</ul></details><p>Study-specific representation sources are linked in each profile. The Community in Public logo is used from the organization’s website.</p><h3>Corrections and interpretation</h3><p>These are independent Community in Public assessments, not official City of Toronto or Stakeholder Advisory Committee findings. Supporting documents and assessment rationales should be read alongside the scores.</p>`);
  }
  function showWeights() {
    const entries=state.view==='framework'?dataset().topics:dataset().categories;
    weightDraft={mode:state.weightModes[state.view],values:Object.fromEntries(entries.map(entry=>[entry.id,state.weightModes[state.view]==='custom'?(state.customWeights[state.view][entry.id]||0):state.weightModes[state.view]==='equal'?100/entries.length:entry.defaultWeight*100]))};
    const inputs=entries.map(entry=>`<div class="weight-row"><label for="weight-${entry.id}">${esc(entry.name)}${state.view==='framework'?`<small>${esc(dataset().categories.find(category=>category.id===entry.categoryId)?.name)}</small>`:''}</label><span class="weight-input"><input id="weight-${entry.id}" type="number" min="0" max="100" step="0.1" inputmode="decimal" data-weight="${entry.id}" value="${Number(weightDraft.values[entry.id].toFixed(4))}" aria-label="${esc(entry.name)} weight">%</span></div>`).join('');
    showModal('Choose what the score emphasizes','ASSESSMENT WEIGHTS',`<p>${state.view==='framework'?'The source tool’s defaults assign 60% across six high-priority topics, 37% across twelve middle topics and 3% across two lower topics. These are starting priorities, not measured survey averages.':'The approved assessment weights community influence, accountability, transparency and participation across five governance areas.'}</p><div class="mode-choices"><label class="mode-choice"><input type="radio" name="weight-mode" value="default" ${weightDraft.mode==='default'?'checked':''}>${state.view==='framework'?'Survey defaults':'Approved weights'}</label><label class="mode-choice"><input type="radio" name="weight-mode" value="equal" ${weightDraft.mode==='equal'?'checked':''}>${state.view==='framework'?'Equal topics':'Equal areas'}</label><label class="mode-choice"><input type="radio" name="weight-mode" value="custom" ${weightDraft.mode==='custom'?'checked':''}>Custom</label></div><div id="weight-inputs">${inputs}</div><div class="weight-total"><span>Total weight</span><span id="weight-total-number"></span></div><p id="weight-validation" hidden class="weight-error"></p><div class="modal-actions"><button class="button" type="button" data-action="normalize-weights">Normalize to 100%</button><button class="button button-orange" type="button" data-action="apply-weights">Apply weights</button></div>`);
    updateWeightInputs();
  }
  function updateWeightInputs() {
    document.querySelectorAll('[data-weight]').forEach(input=>{input.disabled=weightDraft.mode!=='custom';input.value=Number(weightDraft.values[input.dataset.weight].toFixed(4));});
    const total=Object.values(weightDraft.values).reduce((sum,value)=>sum+value,0);$('weight-total-number').textContent=`${total.toFixed(2)}%`;
    $('weight-validation').hidden=total>0&&Math.abs(total-100)<.05;
    $('weight-validation').textContent=total<=0?'Add a positive weight to at least one topic or area.':'Custom weights must total 100%. Use “Normalize to 100%” to keep your proportions.';
  }
  function applyWeights() {
    const total=Object.values(weightDraft.values).reduce((sum,value)=>sum+value,0);
    if(total<=0||Math.abs(total-100)>.05||Object.values(weightDraft.values).some(value=>!Number.isFinite(value)||value<0)){toast('Weights must be non-negative and total 100%.');return;}
    state.weightModes[state.view]=weightDraft.mode;state.customWeights[state.view]={...weightDraft.values};state.category='all';closeModal();render();toast('Comparison updated with your selected weights.');
  }
  function exportDialog() {
    showModal('Take the comparison with you','EXPORT CURRENT VIEW',`<p>Your export includes the active assessment, scope, weights and source details.</p><div class="export-options"><button class="export-option" type="button" data-action="export-png">${icon('document')}<span><strong>Chart image · PNG</strong><small>Portraits, study labels and scores, ready for a presentation or briefing.</small></span></button><button class="export-option" type="button" data-action="export-csv">${icon('document')}<span><strong>Assessment data · CSV</strong><small>Scores, assessment-area contributions and source document links.</small></span></button></div>`);
  }
  function download(blob,filename) {const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function exportCsv() {
    const activeArea=dataset().categories.find(category=>category.id===state.category)?.name||'All assessment areas';
    const allocation=JSON.stringify(calculation.weights),viewUrl=urlForView().href;
    const rows=[['Assessment','Study','Document or study period','Scope','Weighting','Score component','Relative score','Weighted document rating (1-5, Framework only)','Councillors shown','Representation mode','Source document','Methodology version','Active area filter (area-only views renormalized to 100%)','Component weight','Active criterion weights (proportions; JSON)','Reproducible view URL']];
    visibleStudies.forEach(study=>{const base=[dataset().title,study.name,dateLabel(study),state.view==='framework'?state.scope:'Written TOR',weightLabel()];rows.push([...base,state.category==='all'?'Overall total':`${activeArea} — area-only total`,study.value.toFixed(8),study.raw?.toFixed(8)||'',representatives(study).map(person=>person.name).join('; '),state.representatives,study.sourceUrl,dataset().methodologyId,activeArea,'1.00000000',allocation,viewUrl]);study.categories.filter(category=>state.category==='all'||category.id===state.category).forEach(category=>rows.push([...base,category.name,category.value.toFixed(8),'',representatives(study).map(person=>person.name).join('; '),state.representatives,study.sourceUrl,dataset().methodologyId,activeArea,category.weight.toFixed(8),allocation,viewUrl]));});
    const cell=value=>{let text=String(value??'');if(/^[=+@-]/.test(text)&&!/^[-+]?\d+(\.\d+)?$/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    download(new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),`little-jamaica-${state.view}-comparison.csv`);closeModal();toast('Assessment CSV exported.');
  }
  async function exportPng() {
    if(!visibleStudies.length){toast('Choose at least one study to export.');return;}
    const exportState={view:state.view,scope:state.scope,mode:state.representatives,weights:weightLabel(),weightMode:state.weightModes[state.view],customWeights:{...state.customWeights[state.view]},area:state.category,areaName:dataset().categories.find(category=>category.id===state.category)?.name||'All assessment areas',studies:visibleStudies.slice(),geometry:chartGeometry(calculation.studies),people:visibleStudies.map(study=>representatives(study))};
    toast('Preparing chart image…');
    try {
      const canvas=document.createElement('canvas'),width=Math.max(1450,exportState.studies.length*176+130),height=1020;canvas.width=width*2;canvas.height=height*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);
      ctx.fillStyle='#df5720';ctx.font='700 18px Arial';ctx.fillText('COMMUNITY IN PUBLIC',58,55);ctx.fillStyle='#1f302b';ctx.font='700 41px Arial';ctx.fillText('How does Little Jamaica compare?',58,119);ctx.font='18px Arial';ctx.fillStyle='#5f6e67';ctx.fillText(`${dataset().title} · ${exportState.view==='framework'?exportState.scope==='full'?'Full comparator documents':'Vision statements':'Written committee terms'} · ${exportState.weights}`,58,157);
      const {lo,hi,step}=exportState.geometry,top=300,bottom=675,scale=(bottom-top)/(hi-lo),y=value=>bottom-(value-lo)*scale,left=90,right=width-45,col=(right-left)/exportState.studies.length;
      ctx.font='14px Arial';for(let tick=lo;tick<=hi+step/10;tick+=step){const ty=y(tick);ctx.strokeStyle=Math.abs(tick)<1e-8?'#9aafa1':'#e0e6e1';ctx.lineWidth=Math.abs(tick)<1e-8?1.5:1;ctx.setLineDash(Math.abs(tick)<1e-8?[]:[4,5]);ctx.beginPath();ctx.moveTo(left,ty);ctx.lineTo(right,ty);ctx.stroke();ctx.textAlign='right';ctx.fillStyle='#65766a';ctx.fillText(signed(tick,exportState.view==='tor'?0:2),left-15,ty+5);}ctx.setLineDash([]);
      const loadImage=person=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=`./assets/portraits/${person.portrait}`;});
      const loaded=await Promise.all(exportState.people.map(group=>Promise.all(group.map(loadImage))));
      const wrap=(text,x,y,maxWidth,font,lineHeight,maxLines=3)=>{ctx.font=font;const words=text.split(' ');let line='',lines=[];for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);lines.slice(0,maxLines).forEach((value,index)=>ctx.fillText(value,x,y+index*lineHeight));return lines.length;};
      ctx.textAlign='left';ctx.fillStyle='#506c5b';wrap(`${exportState.areaName}${exportState.area==='all'?'':' · Area-only view; weights renormalized to 100%'}`,58,190,width-116,'700 16px Arial',20,2);
      for(let i=0;i<exportState.studies.length;i++){
        const study=exportState.studies[i],x=left+col*(i+.5),value=study.value,barY=Math.min(y(value),y(0)),barHeight=Math.max(3,Math.abs(y(value)-y(0)));ctx.fillStyle=study.isReference?'#ee6a2c':'#9aafa1';ctx.fillRect(x-col*.22,barY,col*.44,barHeight);
        ctx.fillStyle=study.isReference?'#df5720':'#1f302b';ctx.textAlign='center';ctx.font='700 25px Arial';ctx.fillText(signed(value),x,barY-98);
        const group=exportState.people[i],size=group.length>2?37:48,spacing=size-8,start=x-(group.length*spacing+8)/2;
        if(!group.length){ctx.fillStyle='#edf1eb';ctx.beginPath();ctx.arc(x,barY-57,23,0,Math.PI*2);ctx.fill();ctx.fillStyle='#506c5b';ctx.font='700 11px Arial';ctx.fillText('CITY',x,barY-53);}
        for(let j=0;j<group.length;j++){const image=loaded[i][j],px=start+j*spacing,py=barY-81;ctx.save();ctx.beginPath();ctx.arc(px+size/2,py+size/2,size/2,0,Math.PI*2);ctx.clip();ctx.fillStyle='#e3e8e2';ctx.fillRect(px,py,size,size);if(image){const crop=Math.min(image.width,image.height),sx=(image.width-crop)/2,sy=(image.height-crop)*.2;ctx.drawImage(image,sx,sy,crop,crop,px,py,size,size);}ctx.restore();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(px+size/2,py+size/2,size/2,0,Math.PI*2);ctx.stroke();}
        ctx.fillStyle='#65766a';wrap(group.length===1?group[0].name:group.length?`${group.length} ward councillors`:'Citywide body',x,barY-16,col-15,'12px Arial',14,1);
        ctx.fillStyle=study.isReference?'#b7471a':'#1f302b';wrap(shortName(study),x,710,col-16,'700 15px Arial',19,3);ctx.fillStyle='#65766a';wrap(barDate(study),x,777,col-15,'12px Arial',15,2);
      }
      ctx.textAlign='left';ctx.fillStyle='#1f302b';ctx.font='700 15px Arial';ctx.fillText('0 is Little Jamaica’s reference point, not a quality score.',58,847);ctx.fillStyle='#65766a';ctx.font='13px Arial';ctx.fillText(`Portraits: ${exportState.mode==='historical'?'councillors during the study':'current representatives'}. Assessment compares written provisions, not councillor performance.`,58,873);
      if(exportState.view==='framework')ctx.fillText(exportState.scope==='full'?'Scope: Little Jamaica’s working draft vision is compared with full comparator documents.':'Scope: Little Jamaica’s working draft vision is compared with comparator vision statements.',58,898);
      ctx.fillText('Sources and methodology: '+location.origin+location.pathname+' · Council information checked '+DIRECTORY.mapping.checkedOn,58,925);
      if(exportState.weightMode==='custom')wrap('Custom allocation (%): '+Object.entries(exportState.customWeights).map(([key,value])=>`${key} ${Number(value.toFixed(2))}`).join(' · '),58,949,width-116,'12px Arial',17,2);
      ctx.font='11px Arial';ctx.fillText('Portraits: City of Toronto and City Archives (Jose San Juan); Mike Layton: Hoovy Boovy, CC0. Full credits and reproducible weights available in the dashboard and CSV export.',58,995);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Image export unavailable');download(blob,`little-jamaica-${exportState.view}-comparison.png`);closeModal();toast('Chart image exported.');
    } catch(error) {toast('The image could not be exported. You can still export the assessment CSV.');}
  }
  document.addEventListener('click',async event=>{
    const viewButton=event.target.closest('[data-view]');if(viewButton){state.view=viewButton.dataset.view;state.category='all';state.search='';state.selected=dataset().referenceId;state.evidence=false;$('evidence-content').hidden=true;$('evidence-toggle').setAttribute('aria-expanded','false');$('evidence-toggle').innerHTML='Show assessment criteria <span class="chevron" aria-hidden="true"></span>';render();$('chart-scroll').scrollLeft=0;return;}
    const studyButton=event.target.closest('[data-study]');if(studyButton){state.selected=studyButton.dataset.study;render();const replacement=document.querySelector(`[data-study="${CSS.escape(state.selected)}"]`);replacement?.focus({preventScroll:true});return;}
    const action=event.target.closest('[data-action]')?.dataset.action;
    switch(action){
      case 'methodology':showMethodology();break;
      case 'weights':showWeights();break;
      case 'close-modal':closeModal();break;
      case 'share':try{await navigator.clipboard.writeText(urlForView().href);toast('Link copied with this assessment, filters and weights.');}catch{showModal('Copy this view link','SHARE COMPARISON',`<label>View link<input class="share-url" value="${esc(urlForView().href)}" readonly style="width:100%;padding:10px;font-size:13px"></label>`);$('modal-body').querySelector('input').select();}break;
      case 'reset-search':state.search='';state.stage='all';render();$('study-search').focus();break;
      case 'toggle-evidence':state.evidence=!state.evidence;$('evidence-content').hidden=!state.evidence;$('evidence-toggle').setAttribute('aria-expanded',state.evidence);$('evidence-toggle').innerHTML=`${state.evidence?'Hide':'Show'} assessment criteria <span class="chevron" aria-hidden="true"></span>`;if(state.evidence)renderEvidence();break;
      case 'apply-weights':applyWeights();break;
      case 'normalize-weights':{const total=Object.values(weightDraft.values).reduce((sum,value)=>sum+value,0);if(total<=0){toast('Enter at least one positive weight first.');break;}weightDraft.mode='custom';document.querySelector('[name="weight-mode"][value="custom"]').checked=true;Object.keys(weightDraft.values).forEach(key=>weightDraft.values[key]=weightDraft.values[key]/total*100);updateWeightInputs();break;}
      case 'export':exportDialog();break;
      case 'export-csv':exportCsv();break;
      case 'export-png':await exportPng();break;
    }
  });
  $('study-search').addEventListener('input',event=>{state.search=event.target.value;render();});
  [['category-filter','category'],['scope-filter','scope'],['stage-filter','stage'],['sort-filter','sort'],['representative-mode','representatives']].forEach(([id,key])=>$(id).addEventListener('change',event=>{state[key]=event.target.value;render();}));
  $('modal').addEventListener('click',event=>{if(event.target===$('modal')){const rectangle=$('modal').getBoundingClientRect();if(event.clientX<rectangle.left||event.clientX>rectangle.right||event.clientY<rectangle.top||event.clientY>rectangle.bottom)closeModal();}});
  $('modal').addEventListener('cancel',()=>{if(lastModalTrigger?.isConnected)lastModalTrigger.focus();});
  $('modal-body').addEventListener('change',event=>{if(event.target.name==='weight-mode'){weightDraft.mode=event.target.value;const entries=state.view==='framework'?dataset().topics:dataset().categories;if(weightDraft.mode!=='custom')weightDraft.values=Object.fromEntries(entries.map(entry=>[entry.id,weightDraft.mode==='equal'?100/entries.length:entry.defaultWeight*100]));updateWeightInputs();}});
  $('modal-body').addEventListener('input',event=>{if(event.target.dataset.weight){const value=Number(event.target.value);weightDraft.values[event.target.dataset.weight]=Number.isFinite(value)&&value>=0?value:0;const total=Object.values(weightDraft.values).reduce((sum,item)=>sum+item,0);$('weight-total-number').textContent=total.toFixed(2)+'%';$('weight-validation').hidden=total>0&&Math.abs(total-100)<.05;$('weight-validation').textContent='Custom weights must total 100%. Use “Normalize to 100%” to keep your proportions.';}});
  document.querySelector('.assessment-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...document.querySelectorAll('[data-view]')],current=tabs.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();tabs[next].focus();});
  $('chart').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key)||!event.target.matches('[data-study]'))return;event.preventDefault();const bars=[...document.querySelectorAll('[data-study]')],index=bars.indexOf(event.target),next=bars[(index+(event.key==='ArrowRight'?1:-1)+bars.length)%bars.length];next.focus();next.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});});
  if(!DATA||!SCORING||!DIRECTORY){$('chart').innerHTML='<p class="empty-state">The assessment could not be loaded. Please refresh the page.</p>';return;}
  render();
})();
