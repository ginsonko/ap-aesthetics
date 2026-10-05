'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const API=require('../lib/api.js'),E=require('../web/engine.js'),X=require('../web/examples.js');
test('evaluation uses same engine and all channels, without mutating source',()=>{
 const d=X.make(),snapshot=JSON.stringify(d),r=API.evaluate(d);assert.equal(r.result.score.value,E.evaluate(d).score.value);assert.equal(Object.keys(r.result.stages[0].states).length,47);assert.equal(JSON.stringify(d),snapshot);assert.equal(r.document_sha256.length,64);
});
test('template leaves evidence unknown and propagates it',()=>{
 const d=API.createDocument({stages:[{title:'Unknown opening',duration:8}]});assert.equal(d.scenes[0].cues.care,null);assert.equal(API.evaluate(d).result.score.value,null);
});
test('summary keeps numeric time boundaries distinct from end-state values',()=>{
 const d=X.make(),r=API.evaluate(d).result.stages;
 assert.equal(r[0].start,0);assert.equal(r[0].end,d.scenes[0].duration);
 assert.equal(r.at(-1).end,d.scenes.reduce((n,s)=>n+s.duration,0));
 assert.equal(typeof r[0].endState.attention,'number');
 assert.equal(r[1].start,r[0].end);
});
test('comparison fixes model controls rather than accepting candidate score inflation',()=>{
 const a=X.make(),b=X.make('spoiler');b.parameters.emotionGain=5;b.profile.relationship=2;
 const r=API.compare(a,b);assert.equal(r.candidate.model_sha256,r.base.model_sha256);assert.notEqual(r.base.document_sha256,r.candidate.document_sha256);assert.equal(r.stage_deltas.length,8);
});
test('future input edit preserves earlier states',()=>{
 const a=X.make(),b=X.make();b.scenes.at(-1).cues.care=0;assert.deepEqual(API.evaluate(a).result.stages.slice(0,-1),API.evaluate(b).result.stages.slice(0,-1));
});
test('diagnostics retain unknown input and do not require emotional winner',()=>{
 const r=API.evaluate(API.createDocument());assert.ok(r.diagnostics.issues.some(i=>i.kind==='missing_evidence'));const m=API.evaluate(X.make()).result.stages[6].emotions;assert.ok(m.warmth.value>0&&m.sadness.value>0);
});
test('audience panel respects weights without calling them demographics',()=>{
 const r=API.audiencePanel(X.make(),[{id:'a',weight:3,profile:{relationship:.4}},{id:'b',weight:1,profile:{relationship:1.3}}]);assert.equal(r.weighted_score,(r.groups[0].evaluation.result.score.value*3+r.groups[1].evaluation.result.score.value)/4);assert.match(r.caution,/not been established/);
});
test('sensitivity changes only specified model parameter',()=>{
 const d=X.make(),r=API.sensitivity(d,'fatigueHalf',[40,80]);assert.equal(r.runs.length,2);assert.notEqual(r.runs[0].evaluation.result.score.value,r.runs[1].evaluation.result.score.value);assert.equal(d.parameters.fatigueHalf,80);
});
test('CLI accepts JSON and produces equivalent structured result',()=>{
 const {spawnSync}=require('node:child_process'),path=require('node:path');const d=X.make();const r=spawnSync(process.execPath,[path.join(__dirname,'../bin/cli.js'),'evaluate','-'],{input:JSON.stringify(d),encoding:'utf8',maxBuffer:2e6});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).document_sha256,API.hash(d));
});
