'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate } = require('../public/benchmark/scoring.js');
const dataPromise = import('../scripts/benchmark-data.mjs').then(module => module.createBenchmarkData());
const total = values => values.reduce((a, b) => a + b, 0);
const close = (actual, expected, label = '') => assert.ok(Math.abs(actual - expected) < 1e-10, `${label}: ${actual} ≠ ${expected}`);

test('all Framework default scores reproduce the original survey model in both scopes', async () => {
  const data = await dataPromise;
  for (const scope of ['vision', 'full']) {
    const result = calculate(data.framework, { scope });
    assert.equal(result.studies.length, 8);
    close(total(Object.values(result.weights)), 1, 'criterion weights');
    for (const study of result.studies) {
      close(study.raw, study.scores[scope].raw, `${study.id} raw ${scope}`);
      close(study.value, study.scores[scope].relative, `${study.id} relative ${scope}`);
      close(total(study.categories.map(area => area.value)), study.value, `${study.id} contributions`);
    }
    close(result.localRaw, 1.9059722222222217, 'original reference score');
    assert.equal(result.studies.find(study => study.isReference).value, 0);
  }
  const vision = calculate(data.framework, { scope: 'vision' });
  assert.ok(vision.studies.some(study => study.value < 0), 'vision comparisons retain negative results');
});

test('all TOR defaults reproduce the eleven approved relative net scores', async () => {
  const { tor } = await dataPromise;
  const expected = { ljovpf: 0, comp1: 5.2, comp2: 4.4, comp3: 6, comp4: 5.9, comp5: 8.6, comp6: 11.2, comp7: 4.9, comp8: 9.4, comp9: 9.4, comp10: 4.8 };
  const result = calculate(tor);
  assert.equal(result.studies.length, Object.keys(expected).length);
  close(total(Object.values(result.weights)), 1);
  for (const study of result.studies) {
    close(study.value, expected[study.id], study.id);
    close(study.value, study.score, `${study.id} source score`);
    close(total(study.categories.map(area => area.value)), study.value, `${study.id} contributions`);
    assert.equal(study.raw, null, 'TOR has no absolute quality rating');
  }
});

test('equal Framework weighting gives each public topic 5%, irrespective of criterion count', async () => {
  const { framework } = await dataPromise;
  const result = calculate(framework, { scope: 'full', weightMode: 'equal' });
  for (const topic of framework.topics) close(total(topic.criterionIds.map(id => result.weights[id])), 0.05, topic.id);
  for (const study of result.studies) {
    const expected = total(framework.topics.map(topic => total(topic.criterionIds.map(id => study.ratings[id].full)) / topic.criterionIds.length)) / 20;
    close(study.raw, expected, `${study.id} equal-topic score`);
  }
});

test('equal TOR weighting gives each area 20% and preserves the ±12 scale', async () => {
  const { tor } = await dataPromise;
  const result = calculate(tor, { weightMode: 'equal' });
  for (const value of Object.values(result.categoryWeights)) close(value, 0.2);
  for (const study of result.studies) {
    const expected = 12 * total(tor.categories.map(area => {
      const criteria = tor.criteria.filter(criterion => criterion.area === area.id);
      return total(criteria.map(criterion => study.ratings[criterion.id])) / criteria.length / 5;
    }));
    close(study.value, expected, study.id);
  }
});

test('custom weights normalize percentages while preserving grouping and source data', async () => {
  const { framework, tor } = await dataPromise;
  const before = JSON.stringify({ framework, tor });
  const fw = calculate(framework, { scope: 'full', weightMode: 'custom', customWeights: { T01: 75, T02: 25 } });
  close(total(Object.values(fw.weights)), 1);
  close(fw.weights['HR-03'], 0.375);
  close(fw.weights['HR-04'], 0.375);
  close(fw.weights['HR-05'], 0.25);
  const onlyG1 = calculate(tor, { weightMode: 'custom', customWeights: { G1: 100 } });
  close(onlyG1.weights['G1-01'], 0.5);
  close(onlyG1.weights['G1-02'], 0.5);
  const normalized = calculate(tor, { weightMode: 'custom', customWeights: { G1: 3, G2: 1 } });
  close(normalized.categoryWeights.G1, 0.75);
  close(normalized.categoryWeights.G2, 0.25);
  assert.equal(JSON.stringify({ framework, tor }), before);
});

test('area filters normalize only the selected criteria and contribution sums stay exact', async () => {
  const data = await dataPromise;
  for (const dataset of [data.framework, data.tor]) {
    for (const category of dataset.categories) {
      const result = calculate(dataset, { scope: 'full', category: category.id });
      close(total(Object.values(result.weights)), 1);
      close(result.categoryWeights[category.id], 1);
      for (const criterion of dataset.criteria) {
        if ((criterion.categoryId || criterion.area) !== category.id) assert.equal(result.weights[criterion.id], 0);
      }
      for (const study of result.studies) {
        close(total(study.categories.map(area => area.value)), study.value);
        assert.ok(Math.abs(study.value) <= (dataset === data.tor ? 12 : 4) + 1e-10);
      }
    }
  }
});

test('empty, zero, negative, unknown and non-finite weights fail rather than display misleading scores', async () => {
  const { framework, tor } = await dataPromise;
  for (const [dataset, id] of [[framework, 'T01'], [tor, 'G1']]) {
    for (const customWeights of [undefined, {}, { [id]: 0 }, { [id]: -1 }, { [id]: NaN }, { [id]: Infinity }, { [id]: '10' }, { unknown: 100 }]) {
      assert.throws(() => calculate(dataset, { weightMode: 'custom', customWeights }));
    }
  }
  assert.throws(() => calculate(framework, { category: 'missing' }), /Unknown assessment area/);
  assert.throws(() => calculate(tor, { category: 'G2', weightMode: 'custom', customWeights: { G1: 100 } }), /positive weight/);
  assert.throws(() => calculate(framework, { scope: 'imaginary' }), /Unknown document scope/);
  assert.throws(() => calculate(tor, { weightMode: 'imaginary' }), /Unknown weighting mode/);
});

test('malformed ratings are rejected and a zero reference is required for TOR', async () => {
  const { framework, tor } = await dataPromise;
  const damagedFramework = structuredClone(framework);
  delete damagedFramework.studies[1].ratings[damagedFramework.criteria[0].id].vision;
  assert.throws(() => calculate(damagedFramework), /Invalid vision rating/);
  const damagedTor = structuredClone(tor);
  damagedTor.studies.find(study => study.isReference).ratings[tor.criteria[0].id] = 1;
  assert.throws(() => calculate(damagedTor), /zero relative ratings/);
});

const {rank,RECENCY_SHARE}=require('../public/benchmark/portfolio.js');
const directory=require('../data/benchmark/councillors.json');
test('shared representation adjustment reproduces TOR portfolios and leaves source scores intact',async()=>{
  const {tor}=await dataPromise;
  const result=calculate(tor),before=JSON.stringify(result);
  const rows=rank(result.studies,directory,'tor');
  assert.equal(RECENCY_SHARE,.66);
  assert.equal(rows.length,12);
  const frances=rows.find(r=>r.id==='frances-nunziata');
  close(frances.unadjusted,1.751);
  close(frances.projects[0].weight,.165/.505);
  close(frances.projects[1].weight,.17/.505);
  close(frances.projects[2].weight,.17/.505);
  close(frances.score,1.751/.505);
  close(rows.find(r=>r.id==='josh-matlow').score,4.9*(.34/3)/(.66/4+.34/3));
  close(rows.find(r=>r.id==='mike-colle').score,rows.find(r=>r.id==='josh-matlow').score);
  assert.equal(rows.find(r=>r.id==='anthony-perruzza').rank,1);
  assert.equal(rows.find(r=>r.id==='mary-fragedakis').rank,2);
  assert.equal(rows.find(r=>r.id==='paul-ainslie').rank,2);
  assert.equal(rows.find(r=>r.id==='alejandra-bravo').score,0);
  assert.ok(!rows.some(r=>r.id==='chiara-padovani'));
  assert.ok(!rows.some(r=>r.projects.some(p=>p.study.id==='comp10')));
  assert.equal(JSON.stringify(result),before);
});
test('all portfolio weights normalize; one-study portfolios retain the study score; categories and both scopes remain supported',async()=>{
  const data=await dataPromise;
  for(const view of ['framework','tor']){
    for(const scope of ['full','vision']){
      for(const category of ['all',...data[view].categories.map(c=>c.id)]){
        const rows=rank(calculate(data[view],{scope,category}).studies,directory,view);
        for(const r of rows){
          close(total(r.projects.map(p=>p.baseWeight)),1);
          close(total(r.projects.map(p=>p.weight)),1);
          close(total(r.projects.map(p=>p.contribution)),r.score);
          if(r.projects.length===1)close(r.score,r.projects[0].study.value);
          else close(total(r.projects.filter(p=>p.isLatest).map(p=>p.baseWeight)),.66);
          for(const p of r.projects)close(p.adjustedWeight,p.baseWeight/p.sharedCount);
        }
        for(let i=1;i<rows.length;i++)assert.ok(rows[i-1].score>=rows[i].score-1e-9);
      }
    }
  }
});
test('tie-date and shared-only portfolios normalize without arbitrary recency preference',()=>{
  const d={people:[{id:'a',name:'A'},{id:'b',name:'B'}],mapping:{tor:{comp6:{historical:['a','b']},comp9:{historical:['a']}}}};
  const result=rank([{id:'comp6',name:'Study A',value:12},{id:'comp9',name:'Study B',value:0}],d,'tor');
  const a=result.find(r=>r.id==='a'),b=result.find(r=>r.id==='b');
  close(a.projects[0].baseWeight,.5);close(a.projects[1].baseWeight,.5);
  close(a.score,4);close(b.score,12);
});
test('portfolio ranking rejects missing historical mapping, unknown people, duplicate studies, and invalid scores',()=>{
  const d={people:[{id:'a',name:'A'}],mapping:{tor:{comp6:{historical:['a']}}}};
  const s={id:'comp6',name:'Study',value:1};
  assert.throws(()=>rank([s,s],d,'tor'),/Duplicate/);
  assert.throws(()=>rank([{...s,value:NaN}],d,'tor'),/Invalid/);
  assert.throws(()=>rank([{...s,id:'comp9'}],d,'tor'),/Missing/);
  assert.throws(()=>rank([s],{...d,people:[]},'tor'),/Unknown/);
});
