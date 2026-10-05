'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inspectDataset, fitCalibration, applyCalibration, tuneParameters } = require('../lib/calibration.js');
const examples = require('../web/examples.js');
const engine = require('../web/engine.js');
const copy = value => JSON.parse(JSON.stringify(value));
function synthetic() {
  const observations = [];
  for (const split of ['train', 'validation', 'test']) for (let i = 0; i < 12; i++) {
    const x = i / 11;
    observations.push({ id: split + '-' + i, work_id: split + '-work-' + i, group_id: split + '-group-' + i, split, predictions: { warmth: x, absent: null }, observed: { warmth: .15 + .65 * x, absent: null }, n: 5 });
  }
  return { schema: 'ap-aesthetics-observations/1', dataset_id: 'synthetic-affine-test-only', source: { url: 'urn:ap-aesthetics:synthetic-test', license: 'CC0-1.0', label_kind: 'synthetic software fixture; not human observations' }, prediction_provenance: { method: 'Fixed x values; synthetic labels are generated solely to test recovery, not to establish AP accuracy.', independent_of_labels: true }, observations };
}
test('Dataset inspection retains null and reports actual groups and channel coverage', () => {
  const data = synthetic(), result = inspectDataset(data);
  assert.equal(result.valid, true);
  assert.equal(result.observations, 36);
  assert.equal(result.channels.absent.paired, 0);
  assert.equal(result.group_counts.test, 12);
});
test('Same work or source group crossing splits is rejected', () => {
  const data = synthetic(); data.observations[12].work_id = data.observations[0].work_id;
  assert.equal(inspectDataset(data).valid, false);
  assert.throws(() => fitCalibration(data), /work_id crosses splits/);
  data.observations[12].work_id = 'validation-special'; data.observations[12].group_id = data.observations[0].group_id;
  assert.throws(() => fitCalibration(data), /group_id crosses splits/);
});
test('Malformed scales, duplicate identities and missing independence are rejected', () => {
  const data = synthetic(); data.observations[0].observed.warmth = 85;
  assert.equal(inspectDataset(data).valid, false);
  data.observations[0].observed.warmth = .85; data.observations[0].id = data.observations[1].id;
  assert.equal(inspectDataset(data).valid, false);
  delete data.prediction_provenance;
  assert.throws(() => fitCalibration(data), /prediction_provenance/);
});
test('Affine fit recovers a known synthetic mapping with validation selection and reports baselines', () => {
  const model = fitCalibration(synthetic());
  assert.ok(Math.abs(model.channel_models.warmth.slope - .65) < 1e-12);
  assert.ok(Math.abs(model.channel_models.warmth.intercept - .15) < 1e-12);
  const report = model.report.channels.warmth.splits.test;
  assert.ok(report.calibrated.mse < 1e-25);
  assert.ok(report.train_mean_baseline.mse > .02);
  assert.ok(report.improvement_vs_raw.ci95[0] > 0);
  assert.match(model.report.skipped.absent,/not fitted/);
});
test('Changing test labels changes only reporting, never the chosen model identity or coefficients', () => {
  const a = synthetic(), b = copy(a);
  b.observations.filter(row => row.split === 'test').forEach(row => { row.observed.warmth = 1 - row.observed.warmth; });
  const ma = fitCalibration(a), mb = fitCalibration(b);
  assert.deepEqual(ma.channel_models, mb.channel_models);
  assert.equal(ma.model_id, mb.model_id);
  assert.equal(ma.selection_hash, mb.selection_hash);
  assert.notEqual(ma.dataset_hash, mb.dataset_hash);
  assert.notEqual(ma.report.channels.warmth.splits.test.calibrated.mse, mb.report.channels.warmth.splits.test.calibrated.mse);
});
test('Calibration clips outputs, retains missingness, preserves unfitted channels and does not mutate', () => {
  const model = fitCalibration(synthetic()), input = { warmth: 1, absent: null, novelty: .5 }, before = copy(input);
  model.channel_models.warmth = { slope: 5, intercept: -.2 };
  assert.deepEqual(applyCalibration(input, model), { warmth: 1, absent: null, novelty: .5 });
  assert.deepEqual(input, before);
  assert.throws(() => applyCalibration({ warmth: '0.5' }, model), /Invalid prediction/);
  assert.throws(() => applyCalibration({ warmth: NaN }, model), /Invalid prediction/);
  assert.throws(() => applyCalibration({ warmth: .5 }, { ...model, schema: 'anything' }), /Expected predictions/);
  model.channel_models.unused = { slope: Infinity, intercept: 0 };
  assert.throws(() => applyCalibration({ warmth: .5 }, model), /Invalid calibration coefficients/);
});
test('A valid channel which shadows a JavaScript inherited name remains an ordinary own field', () => {
  const data = synthetic();
  data.observations.forEach(row => { row.predictions = { toString: row.predictions.warmth }; row.observed = { toString: row.observed.warmth }; });
  const model = fitCalibration(data);
  assert.ok(Math.abs(applyCalibration({ toString: .5 }, model).toString - .475) < 1e-12);
  assert.deepEqual(applyCalibration({ valueOf: .7 }, model), { valueOf: .7 });
});
test('A source group with repeated rows does not acquire arbitrary weight', () => {
  const a = synthetic(), b = copy(a), repeated = b.observations[0];
  for (let i = 0; i < 100; i++) b.observations.push({ ...copy(repeated), id: 'repeat-' + i, n: 100000 });
  assert.ok(Math.abs(fitCalibration(a).channel_models.warmth.slope - fitCalibration(b).channel_models.warmth.slope) < 1e-12);
});
test('Missing validation cannot silently use test labels', () => {
  const data = synthetic(); data.observations = data.observations.filter(row => row.split !== 'validation');
  assert.throws(() => fitCalibration(data), /train and validation/);
});
test('One paired group has unavailable bootstrap uncertainty rather than a confident interval', () => {
  const data = synthetic(); data.observations.filter(row => row.split === 'test').forEach(row => { row.group_id = 'one-test-source'; });
  const result = fitCalibration(data).report.channels.warmth.splits.test.improvement_vs_raw;
  assert.equal(result.ci95, null); assert.equal(result.groups, 1);
});
test('Identity can win when calibration would damage validation', () => {
  const data = synthetic(); data.observations.filter(row => row.split === 'validation').forEach(row => { row.observed.warmth = row.predictions.warmth; });
  assert.equal(fitCalibration(data).channel_models.warmth.kind, 'identity');
});
function tuningFixture() {
  const base = synthetic(); base.dataset_id = 'synthetic-engine-recovery-only';
  base.source.label_kind = 'synthetic labels produced by a known engine parameter; software verification only';
  base.prediction_provenance.method = 'Independently frozen AP cue documents; labels intentionally simulated by emotionGain=.7 to verify search plumbing, not empirical validity.';
  base.observations = ['train', 'validation', 'test'].flatMap(split => [0, 1].map(i => {
    const document = examples.make(i ? 'no_tail' : 'original');
    document.title = split + ':' + i;
    document.scenes.forEach(scene => { scene.duration = 1 + i; });
    const teacher = copy(document); teacher.parameters.emotionGain = .7;
    const observed = engine.evaluate(teacher).rows.at(-1).emotions.warmth.value;
    return { id: split + '-' + i, work_id: split + '-work-' + i, group_id: split + '-group-' + i, split, predictions: {}, observed: { warmth: observed }, document, scene_id: document.scenes.at(-1).id };
  }));
  return base;
}
test('Finite parameter search uses the shared AP engine, retains hashes and leaves documents unchanged', () => {
  const data = tuningFixture(), before = JSON.stringify(data);
  const result = tuneParameters(data, { parameter_grid: { emotionGain: [.3, .7, 1.3] } });
  assert.equal(result.parameters.emotionGain, .7);
  assert.ok(result.test.mse < 1e-20);
  assert.equal(JSON.stringify(data), before);
  assert.equal(Object.keys(result.source_documents).length, 6);
  assert.match(result.source_documents['train-work-0'].input_sha256, /^[a-f0-9]{64}$/);
});
test('Parameter search does not choose by test labels', () => {
  const data = tuningFixture(), first = tuneParameters(data, { parameter_grid: { emotionGain: [.3, .7] } });
  data.observations.filter(row => row.split === 'test').forEach(row => { row.observed.warmth = .999; });
  const second = tuneParameters(data, { parameter_grid: { emotionGain: [.3, .7] } });
  assert.equal(first.candidate_id, second.candidate_id);
  assert.deepEqual(first.parameters, second.parameters);
  assert.notEqual(first.test.mse, second.test.mse);
});
test('A new test-only channel and test missingness cannot change the parameter objective or chosen candidate', () => {
  const data = tuningFixture(), options={parameter_grid:{emotionGain:[.3,.7]}};
  const first=tuneParameters(data,options);
  data.observations.filter(row=>row.split==='test').forEach(row=>{row.observed.testOnlyUnknown=.9;row.observed.warmth=null;});
  const second=tuneParameters(data,options);
  assert.equal(second.candidate_id,first.candidate_id);
  assert.deepEqual(second.parameters,first.parameters);
  assert.deepEqual(second.channel_map,first.channel_map);
  assert.equal(second.test.mse,null);
  assert.match(second.test_only_channels.testOnlyUnknown,/excluded/);
});
test('Parameter search rejects unbounded expansion and unknown channels', () => {
  const data = tuningFixture();
  assert.throws(() => tuneParameters(data, { parameter_grid: { madeUp: [1] } }), /Invalid parameter grid/);
  assert.throws(() => tuneParameters(data, { parameter_grid: { emotionGain: Array.from({ length: 257 }, (_, i) => i / 100) } }), /256 combinations/);
  data.observations.forEach(row => { row.observed = { valence: .5 }; });
  assert.throws(() => tuneParameters(data, { parameter_grid: { emotionGain: [.3] } }), /channel_map/);
});
test('Renaming the identity of an identical document cannot bypass split protection', () => {
  const data = tuningFixture();
  data.observations[2].document = copy(data.observations[0].document);
  assert.throws(() => tuneParameters(data, { parameter_grid: { emotionGain: [.7] } }), /Identical AP document crosses splits/);
});
test('Unsafe JSON channel keys cannot poison prototype or models', () => {
  const data = synthetic(); data.observations[0].observed = JSON.parse('{"__proto__":0.4}');
  assert.equal(inspectDataset(data).valid, false);
  assert.equal({}.polluted, undefined);
});
test('Committed synthetic example has explicit evidence limitations and is executable', () => {
  const file = path.join(__dirname, '../examples/calibration-synthetic.json');
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.match(data.source.label_kind, /synthetic/);
    assert.equal(inspectDataset(data).valid, true);
    assert.equal(fitCalibration(data).schema, 'ap-aesthetics-calibration/1');
  }
});
test('Public data parser preserves quoted delimiters and split assignment ignores labels', () => {
  const {parseDelimited, sourceSplit} = require('../scripts/public-data-emobank.js');
  assert.deepEqual(parseDelimited('id,text\r\na,"a,b"\r\nb,"say ""hi"""\r\n'), [{id:'a',text:'a,b'},{id:'b',text:'say "hi"'}]);
  assert.throws(() => parseDelimited('id,text\na,"unterminated'), /Unterminated quote/);
  assert.equal(sourceSplit('same-work'), sourceSplit('same-work'));
  assert.ok(['train','validation','test'].includes(sourceSplit('same-work')));
});
test('Real public-data report keeps perspective mapping separate from AP accuracy', () => {
  const report=JSON.parse(fs.readFileSync(path.join(__dirname,'../examples/calibration-emobank-summary.json'),'utf8'));
  assert.equal(report.ap_evaluation.performed,false);
  assert.equal(report.human_perspective_mapping_experiment.ap_accuracy,false);
  assert.equal(report.human_perspective_mapping_experiment.matched_rows,10062);
  assert.equal(report.human_perspective_mapping_experiment.calibration.report.channels.V.splits.test.raw.groups,22);
  assert.equal(report.human_perspective_mapping_experiment.worker_independence_verified,false);
});
