'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../server/gateway.cjs');
test('Preserve approved scoring and data',()=>{assert.equal(G.WB.topics.length,39);assert.equal(G.WB.comparators.length,7);assert.deepEqual(G.M.groupCounts,[7,7,8,7,6,4]);assert.deepEqual(G.M.groupShares,[40,35,11.23,8.56,3.21,2]);});
test('Only limited survey and aggregate operations are available',()=>{const s=fs.readFileSync('server/gateway.cjs','utf8');assert.ok(s.includes('ljov_community_average'));assert.ok(s.includes('ljov_collection_status'));assert.ok(!s.includes('ljov_admin_dashboard'));});
test('Public JavaScript has no server credential',()=>{for(const file of ['public/js/config.js','public/js/app.js']){const s=fs.readFileSync(file,'utf8');assert.ok(!s.includes('SUPABASE_SERVICE_ROLE_KEY'));assert.ok(!s.includes('SURVEY_GATEWAY_TOKEN'));}});
test('Community comparison calculates theme and overlapping outcome sums',()=>{const s=fs.readFileSync('api/community.js','utf8');assert.ok(s.includes('themeWeights'));assert.ok(s.includes('outcomeWeights'));});
test('Closing state and return links supported',()=>{const s=fs.readFileSync('public/js/app.js','utf8');assert.ok(s.includes('collectionState'));assert.ok(s.includes('applyReadonly'));assert.ok(s.includes('resumeRemoteResponse'));});
