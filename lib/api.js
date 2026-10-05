'use strict';
const crypto = require('node:crypto');
const C = require('../web/catalog.js');
const E = require('../web/engine.js');
const X = require('../web/examples.js');
const clone = E.clone;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const finite = value => typeof value === 'number' && Number.isFinite(value);
const mean = values => values.length && values.every(finite) ? values.reduce((a, b) => a + b, 0) / values.length : null;

function catalog() {
  return { version: '0.2.0', engineVersion: C.version, inputs: C.inputs, states: C.defs,
    emotions: C.emotions, parameters: C.parameters, profile: C.profile, styles: C.styles,
    meanings: { score: 'Uncalibrated creative-target index, not satisfaction probability.', strength: 'Relative model intensity, not occurrence probability.', unknown: 'null; never silently zero.', evidence: 'The caller must independently annotate visible cues; the engine does not read media.' } };
}

function createDocument({ title = 'Untitled work', medium = 'text', stages = [], style = 'bittersweet', profile = {} } = {}) {
  const d = X.blank(); d.title = title; d.medium = medium; d.style = style;
  d.profile = { ...d.profile, ...profile };
  if (stages.length) d.scenes = stages.map((s, i) => ({
    id: s.id || 'stage-' + (i + 1), title: s.title || 'Stage ' + (i + 1), description: s.description || '',
    duration: s.duration ?? 10, object: s.object || 'main-focus',
    cues: Object.fromEntries(C.inputs.map(f => [f.id, null])), outcomesKnown: false, outcomes: [],
    annotation: { method: 'unannotated', source_span: s.source_span || '', independent_of_outcome_labels: null }
  }));
  E.validate(d); return d;
}

function diagnose(result, options = {}) {
  const thresholds = { overload: .7, unresolved: .55, boredom: .28, attention: .25, confusion: .35, ...options.thresholds };
  for (const value of Object.values(thresholds)) if (!finite(value) || value < 0 || value > 1) throw new Error('Diagnostic thresholds must be within 0..1');
  const issues = [];
  const add = (row, kind, severity, observation, alternatives, channels) => issues.push({
    stage_id: row.id, title: row.title, time: [row.start, row.end], kind, severity, observation, alternatives,
    evidence: Object.fromEntries(channels.map(k => [k, row.cfs[k] ?? null])),
    note: 'A model-conditioned observation, not an instruction to remove ambiguity or negative emotion.'
  });
  for (const r of result.rows) {
    if (r.coverage.missing.length) add(r, 'missing_evidence', 1-r.coverage.inputs,
      `${r.coverage.missing.length} cue fields are unannotated; dependent emotions may be unknown.`,
      ['Annotate only what this audience can know at this moment, with a source span.', 'Retain null where evidence is unavailable.'], r.coverage.missing);
    if (r.cfs.boredom > thresholds.boredom) add(r, 'low_development', r.cfs.boredom,
      'Repeated attention with little new development raises the boredom estimate.',
      ['Introduce a meaningful new detail or consequence.', 'Try a shorter cut.', 'Keep the duration if stillness is intentional, and compare actual audience response.'], ['boredom','fatigue','novelty','care']);
    if (r.cfs.complexity > thresholds.overload && r.cfs.unresolved > thresholds.unresolved) add(r, 'open_questions_load', mean([r.cfs.complexity,r.cfs.unresolved]),
      'Several processing demands remain open in this annotation.',
      ['Provide an interpretable anchor while preserving the main question.', 'Reorder information or allow a brief processing beat.'], ['complexity','unresolved','grasp']);
    if (r.cfs.attention !== null && r.cfs.attention < thresholds.attention) add(r, 'weak_focus', 1-r.cfs.attention,
      'Current focus receives a low share under this audience profile.',
      ['Make the relationship or consequence worth caring about visible.', 'Compare stronger continuity with a different focus, without adding arbitrary shock.'], ['attention','internal','care','expectation','pressure']);
    if (r.emotions.confused?.value > thresholds.confusion) add(r, 'unclear_interpretation', r.emotions.confused.value,
      'The current interpretation remains difficult under the supplied evidence.',
      ['Check which clue the audience actually has.', 'Keep productive mystery; resolve accidental spatial or referential confusion.'], ['grasp','dissonance','complexity','unresolved']);
  }
  return { thresholds, issues: issues.sort((a,b)=>b.severity-a.severity),
    guidance: ['Negative feelings can support meaningful art.', 'Change the artifact, then re-annotate visible evidence; never edit cue numbers merely to improve a score.', 'Use comparable target, audience, model and annotator conditions.', 'Separate human outcome labels from model-input annotation.'] };
}

function summarize(r) {
  return { title: r.title, duration: r.duration, score: r.score, totals: r.totals, warnings: r.warnings,
    stages: r.rows.map(row => ({ id: row.id, title: row.title, start: row.start, end: row.end,
      states: row.cfs, peaks: row.peak, endState: row.endState,
      emotions: Object.fromEntries(Object.entries(row.emotions).map(([id,e])=>[id,{value:e.value,low:e.low,high:e.high,coverage:e.coverage}])),
      summary: row.summary, coverage: row.coverage, sources: row.signals.sources })) };
}

function evaluate(document, options = {}) {
  const result = E.evaluate(document);
  return { schema:'ap-aesthetics-evaluation/1', version:'0.2.0', document_sha256:hash(document),
    model_sha256:hash({parameters:result.parameters,profile:result.profile,emotions:result.emotionModel,style:document.style}),
    evidence_boundary:result.assumptions, annotation:document.annotationNote || 'Caller annotations; provenance not supplied.',
    diagnostics:diagnose(result,options), result: options.detail === 'full' ? result : summarize(result) };
}

function compare(base, candidate, options = {}) {
  const same = { style:base.style || 'bittersweet', profile:base.profile || C.profile, parameters:base.parameters || C.parameters, emotionModel:base.emotionModel || C.emotions };
  const candidateDoc = options.allowModelChange ? clone(candidate) : { ...clone(candidate), ...clone(same) };
  const a=evaluate(base,options), b=evaluate(candidateDoc,options);
  const stages = b.result.stages || b.result.rows;
  const baseStages = a.result.stages || a.result.rows;
  const pairs = stages.map(row=>{
    const previous=baseStages.find(r=>r.id===row.id); const now=row.states||row.cfs, old=previous?.states||previous?.cfs;
    return {id:row.id,title:row.title,matched:!!previous,delta:old?Object.fromEntries(C.defs.map(d=>[d.id,finite(now[d.id])&&finite(old[d.id])?now[d.id]-old[d.id]:null])):null};
  });
  return { schema:'ap-aesthetics-comparison/1', controls:options.allowModelChange?'model may differ; not an isolated artifact comparison':'same audience, target, parameters and emotion definitions',
    score_delta: finite(a.result.score.value)&&finite(b.result.score.value)?b.result.score.value-a.result.score.value:null,
    base:a,candidate:b,stage_deltas:pairs, conclusion:'Higher score is a model-conditioned preference under fixed goals, not evidence of greater population satisfaction.' };
}

function audiencePanel(document, profiles, options={}) {
  if (!Array.isArray(profiles) || !profiles.length) throw new Error('Provide at least one audience profile');
  let total=0;
  const groups=profiles.map((item,i)=>{
    const weight=item.weight??1;if(!finite(weight)||weight<=0)throw new Error('Group weights must be positive');total+=weight;
    return {id:item.id||'group-'+i,weight,assumption:item.assumption||'hypothetical audience; not sampled population',evaluation:evaluate({...clone(document),profile:{...(document.profile||C.profile),...item.profile}},options)};
  });
  const score=groups.every(g=>finite(g.evaluation.result.score.value))?groups.reduce((n,g)=>n+g.weight*g.evaluation.result.score.value,0)/total:null;
  return {schema:'ap-aesthetics-audience-panel/1',groups,weighted_score:score,weight_basis:options.weight_basis||'user-supplied, unverified mixture',
    range:score===null?null:[Math.min(...groups.map(g=>g.evaluation.result.score.value)),Math.max(...groups.map(g=>g.evaluation.result.score.value))],
    caution:'This is scenario analysis across stated profiles. A stable population distribution or demographic validity has not been established.'};
}

function sensitivity(document, parameter, values, options={}) {
  if(!Object.hasOwn(C.parameters,parameter))throw new Error('Unknown parameter');
  if(!Array.isArray(values)||!values.length||values.length>40)throw new Error('Provide 1–40 explicit sensitivity values');
  const runs=values.map(value=>{const d=clone(document);d.parameters={...C.parameters,...d.parameters,[parameter]:value};return {value,evaluation:evaluate(d,options)};});
  return {parameter,runs,interpretation:'Sensitivity analysis changes model assumptions; it is not an improved creative artifact or empirical calibration.'};
}

module.exports={catalog,createDocument,evaluate,compare,audiencePanel,sensitivity,diagnose,hash};
