'use strict';

// Calibration is a separate output adapter. It never rewrites the AP engine or its defaults.
const crypto = require('node:crypto');
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clip = value => Math.max(0, Math.min(1, value));
const splits = ['train', 'validation', 'test'];
const safeKey = key => /^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
const hash = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');

function inspectDataset(dataset) {
  const errors = [], warnings = [];
  const counts = Object.fromEntries(splits.map(split => [split, 0]));
  const groupSets = Object.fromEntries(splits.map(split => [split, new Set()]));
  const channelCounts = Object.create(null), ids = new Set(), workSplits = new Map(), groupSplits = new Map();
  if (!object(dataset) || dataset.schema !== 'ap-aesthetics-observations/1') errors.push('schema must be ap-aesthetics-observations/1');
  if (typeof dataset?.dataset_id !== 'string' || !dataset.dataset_id.trim()) errors.push('dataset_id is required');
  for (const field of ['url', 'license', 'label_kind']) if (typeof dataset?.source?.[field] !== 'string' || !dataset.source[field].trim()) errors.push('source.' + field + ' is required');
  if (dataset?.prediction_provenance?.independent_of_labels !== true || !dataset?.prediction_provenance?.method) errors.push('prediction_provenance must state method and independent_of_labels:true');
  const rows = Array.isArray(dataset?.observations) ? dataset.observations : [];
  if (!rows.length || rows.length > 200000) errors.push('observations must contain 1–200000 rows');
  rows.forEach((row, index) => {
    const prefix = 'row ' + index + ': ';
    if (!object(row)) { errors.push(prefix + 'expected an object'); return; }
    if (typeof row.id !== 'string' || !row.id || ids.has(row.id)) errors.push(prefix + 'id must be nonempty and unique');
    ids.add(row.id);
    if (!splits.includes(row.split)) errors.push(prefix + 'split must be train, validation or test');
    else { counts[row.split]++; if (row.group_id) groupSets[row.split].add(row.group_id); }
    for (const [key, seen] of [['work_id', workSplits], ['group_id', groupSplits]]) {
      if (typeof row[key] !== 'string' || !row[key].trim()) errors.push(prefix + key + ' is required');
      else {
        if (seen.has(row[key]) && seen.get(row[key]) !== row.split) errors.push(prefix + key + ' crosses splits: ' + row[key]);
        seen.set(row[key], row.split);
      }
    }
    if (row.n != null && (!Number.isInteger(row.n) || row.n < 1)) errors.push(prefix + 'n must be a positive integer');
    if (row.weight != null && (!finite(row.weight) || row.weight <= 0 || row.weight > 1000000)) errors.push(prefix + 'weight must be positive and at most 1000000');
    for (const field of ['predictions', 'observed']) {
      if (!object(row[field])) { errors.push(prefix + field + ' must be an object; use {} or null values for unknown channels'); continue; }
      for (const [channel, value] of Object.entries(row[field])) {
        if (!safeKey(channel)) { errors.push(prefix + 'unsafe channel name: ' + channel); continue; }
        if (value != null && (!finite(value) || value < 0 || value > 1)) errors.push(prefix + field + '.' + channel + ' must be null or a number in [0,1]');
        channelCounts[channel] ||= { predicted: 0, observed: 0, paired: 0 };
        if (finite(value)) channelCounts[channel][field === 'observed' ? 'observed' : 'predicted']++;
      }
    }
    for (const channel of Object.keys(row.observed || {})) if (safeKey(channel) && finite(row.observed[channel]) && finite(row.predictions?.[channel])) channelCounts[channel].paired++;
  });
  for (const split of splits) if (!counts[split]) warnings.push('No ' + split + ' observations; no accuracy claim is available for that split.');
  for (const split of splits) if (counts[split] && groupSets[split].size < 5) warnings.push(split + ' has fewer than five independent groups; uncertainty is poorly estimated.');
  warnings.push('Prediction independence is a provenance declaration, not an automated proof; audit annotation timing and information access.');
  warnings.push('n is descriptive only. It does not turn repeated ratings of the same work into independent works.');
  let datasetHash = null;
  try { datasetHash = hash(dataset); } catch { errors.push('dataset must be JSON-serializable'); }
  return { valid: errors.length === 0, errors, warnings, dataset_id: dataset?.dataset_id ?? null, dataset_hash: datasetHash, observations: rows.length, split_counts: counts, group_counts: Object.fromEntries(splits.map(split => [split, groupSets[split].size])), channels: channelCounts };
}
function requireDataset(dataset) {
  const inspection = inspectDataset(dataset);
  if (!inspection.valid) throw new Error('Invalid calibration dataset: ' + inspection.errors.join('; '));
  return inspection;
}
function pairs(rows, channel, prediction = row => row.predictions?.[channel]) {
  const out = rows.map(row => ({ id: row.id, group: row.group_id, weight: row.weight ?? 1, x: prediction(row), y: row.observed?.[channel] })).filter(row => finite(row.x) && finite(row.y));
  const totals = new Map();
  for (const row of out) totals.set(row.group, (totals.get(row.group) || 0) + row.weight);
  for (const row of out) row.w = row.weight / totals.get(row.group);
  return out;
}
function stats(points, predict = point => point.x) {
  if (!points.length) return { rows: 0, groups: 0, mse: null, rmse: null, mae: null, bias: null, pearson: null };
  let weight = 0, squared = 0, absolute = 0, bias = 0, sx = 0, sy = 0, xx = 0, yy = 0, xy = 0;
  for (const point of points) {
    const x = predict(point), y = point.y, w = point.w;
    weight += w; squared += w * (x - y) ** 2; absolute += w * Math.abs(x - y); bias += w * (x - y);
    sx += w * x; sy += w * y; xx += w * x * x; yy += w * y * y; xy += w * x * y;
  }
  const varianceProduct = Math.max(0, xx / weight - (sx / weight) ** 2) * Math.max(0, yy / weight - (sy / weight) ** 2);
  return { rows: points.length, groups: new Set(points.map(point => point.group)).size, mse: squared / weight, rmse: Math.sqrt(squared / weight), mae: absolute / weight, bias: bias / weight, pearson: varianceProduct > 1e-14 ? Math.max(-1, Math.min(1, (xy / weight - sx * sy / weight ** 2) / Math.sqrt(varianceProduct))) : null };
}
function meanObserved(points) { const sw = points.reduce((sum, row) => sum + row.w, 0); return sw ? points.reduce((sum, row) => sum + row.w * row.y, 0) / sw : null; }
function affine(points, lambda) {
  const w = points.reduce((sum, row) => sum + row.w, 0), mx = points.reduce((sum, row) => sum + row.w * row.x, 0) / w, my = meanObserved(points);
  const variance = points.reduce((sum, row) => sum + row.w * (row.x - mx) ** 2, 0) / w;
  const covariance = points.reduce((sum, row) => sum + row.w * (row.x - mx) * (row.y - my), 0) / w;
  // Ridge shrinks slope toward 1. Nonnegative slope preserves the direction of a named feeling.
  const slope = variance + lambda > 1e-15 ? Math.max(0, (covariance + lambda) / (variance + lambda)) : 0;
  return { kind: 'affine', slope, intercept: my - slope * mx, lambda };
}
const predict = (x, model) => clip(model.slope * x + model.intercept);
function bootstrapDifference(points, model, baseline, rounds = 300) {
  const groups = new Map();
  for (const point of points) {
    const d = (baseline(point) - point.y) ** 2 - (predict(point.x, model) - point.y) ** 2;
    groups.set(point.group, (groups.get(point.group) || 0) + point.w * d);
  }
  const values = [...groups.values()];
  if (values.length < 2) return { groups: values.length, mean_mse_improvement: values[0] ?? null, ci95: null, method: 'group bootstrap unavailable: fewer than two groups' };
  let seed = 0x6d2b79f5;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const draws = [];
  for (let b = 0; b < rounds; b++) { let sum = 0; for (let i = 0; i < values.length; i++) sum += values[Math.floor(random() * values.length)]; draws.push(sum / values.length); }
  draws.sort((a, b) => a - b);
  return { groups: values.length, mean_mse_improvement: values.reduce((a, b) => a + b, 0) / values.length, ci95: [draws[Math.floor(.025 * (draws.length - 1))], draws[Math.floor(.975 * (draws.length - 1))]], method: 'deterministic percentile bootstrap of source-group mean paired squared-error differences', rounds, limitation: 'Descriptive uncertainty within this population and dataset, not a guarantee for new audiences or an individual.' };
}
function fitCalibration(dataset, options = {}) {
  const inspection = requireDataset(dataset), partitions = Object.fromEntries(splits.map(split => [split, dataset.observations.filter(row => row.split === split)]));
  if (!partitions.train.length || !partitions.validation.length) throw new Error('fit requires preassigned train and validation groups; test is not a substitute');
  const lambdas = options.lambdas ?? [0, .001, .01, .1, 1];
  if (!Array.isArray(lambdas) || !lambdas.length || lambdas.length > 100 || lambdas.some(value => !finite(value) || value < 0 || value > 1000000)) throw new Error('lambdas must contain 1–100 finite nonnegative values');
  const channelModels = {}, reports = {}, skipped = {};
  const fitChannels = [...new Set([...partitions.train, ...partitions.validation].flatMap(row => Object.keys(row.observed || {}).filter(channel => finite(row.observed[channel]))))].sort();
  for (const channel of Object.keys(inspection.channels)) if (!fitChannels.includes(channel)) skipped[channel] = 'No observed training/validation labels; test-only or entirely unknown channel is not fitted.';
  for (const channel of fitChannels) {
    const train = pairs(partitions.train, channel), validation = pairs(partitions.validation, channel);
    if (train.length < 2 || !validation.length) { skipped[channel] = 'Requires at least two paired training rows and one paired validation row; missing values were not imputed.'; continue; }
    const baseline = meanObserved(train);
    const candidates = [{ kind: 'identity', slope: 1, intercept: 0, lambda: null }, ...[...new Set(lambdas)].sort((a, b) => a - b).map(lambda => affine(train, lambda))];
    const trials = candidates.map(candidate => ({ ...candidate, train_mse: stats(train, row => predict(row.x, candidate)).mse, validation_mse: stats(validation, row => predict(row.x, candidate)).mse }));
    let selected = 0;
    for (let index = 1; index < trials.length; index++) if (trials[index].validation_mse < trials[selected].validation_mse - 1e-12) selected = index;
    channelModels[channel] = { ...candidates[selected], train_mean: baseline, train_rows: train.length, train_groups: new Set(train.map(row => row.group)).size };
    const splitReports = {};
    for (const split of splits) {
      const data = pairs(partitions[split], channel);
      splitReports[split] = { raw: stats(data), calibrated: stats(data, row => predict(row.x, candidates[selected])), train_mean_baseline: stats(data, () => baseline), improvement_vs_raw: bootstrapDifference(data, candidates[selected], row => row.x), improvement_vs_train_mean: bootstrapDifference(data, candidates[selected], () => baseline) };
    }
    reports[channel] = { selected_index: selected, trials, splits: splitReports };
  }
  if (!Object.keys(channelModels).length) throw new Error('No channel has enough independent prediction/label pairs for calibration');
  const selectionHash = hash({ source: dataset.source, provenance: dataset.prediction_provenance, rows: dataset.observations.filter(row => row.split !== 'test'), lambdas });
  return { schema: 'ap-aesthetics-calibration/1', model_id: 'affine-' + hash({ selectionHash, channelModels }).slice(0, 20), dataset_id: dataset.dataset_id, dataset_hash: inspection.dataset_hash, selection_hash: selectionHash, source: clone(dataset.source), channel_models: channelModels, report: { weighting: 'Each source group has total weight 1 per channel; weight changes row importance within a group. n does not increase independent sample size.', selection: 'Training fits coefficients; validation chooses identity or lambda; test is reported only after selection. No automatic adoption.', channels: reports, skipped, warnings: inspection.warnings }, accuracy_claim: 'Held-out dataset error for specified label channels only; not satisfaction probability, causal proof, or population-wide accuracy.' };
}
function applyCalibration(predictions, model) {
  if (!object(predictions) || model?.schema !== 'ap-aesthetics-calibration/1' || !object(model.channel_models)) throw new Error('Expected predictions object and ap-aesthetics-calibration/1 model');
  for (const [channel, m] of Object.entries(model.channel_models)) {
    if (!safeKey(channel) || !object(m) || !finite(m.slope) || m.slope < 0 || !finite(m.intercept)) throw new Error('Invalid calibration coefficients or channel: ' + channel);
  }
  const output = {};
  for (const [channel, value] of Object.entries(predictions)) {
    if (!safeKey(channel) || (value != null && (!finite(value) || value < 0 || value > 1))) throw new Error('Invalid prediction channel or value: ' + channel);
    const m = Object.hasOwn(model.channel_models, channel) ? model.channel_models[channel] : null;
    output[channel] = value == null ? null : m ? predict(value, m) : value;
  }
  return output;
}

function tuneParameters(dataset, options = {}) {
  const inspection = requireDataset(dataset), engine = require('../web/engine.js'), catalog = require('../web/catalog.js');
  const grid = options.parameter_grid;
  if (!object(grid) || !Object.keys(grid).length) throw new Error('parameter_grid must name at least one existing AP parameter');
  let candidates = [{}];
  for (const key of Object.keys(grid).sort()) {
    const values = grid[key];
    if (!Object.hasOwn(catalog.parameters, key) || !Array.isArray(values) || !values.length || values.some(value => !finite(value) || value < 0 || value > 10000)) throw new Error('Invalid parameter grid: ' + key);
    if (candidates.length * values.length > 256) throw new Error('parameter_grid exceeds 256 combinations; choose a bounded hypothesis');
    candidates = candidates.flatMap(candidate => [...new Set(values)].map(value => ({ ...candidate, [key]: value })));
  }
  candidates = [{}, ...candidates]; // frozen document defaults always remain a candidate
  const partitions = Object.fromEntries(splits.map(split => [split, dataset.observations.filter(row => row.split === split)]));
  if (!partitions.train.length || !partitions.validation.length) throw new Error('Parameter tuning requires train and validation; test cannot select parameters');
  const documents = new Map(), documentSplits = new Map(), sourceDocuments = Object.create(null);
  const channels = [...new Set([...partitions.train, ...partitions.validation].flatMap(row => Object.keys(row.observed || {}).filter(channel => finite(row.observed[channel]))))].sort();
  if (!channels.length) throw new Error('No observed train/validation channels; test labels cannot choose the search objective');
  const testOnlyChannels = Object.keys(inspection.channels).filter(channel => inspection.channels[channel].observed > 0 && !channels.includes(channel));
  const channelMap = options.channel_map ?? {};
  for (const row of dataset.observations) {
    if (!row.document || row.document.schema !== 'ap-aesthetics/1') throw new Error('Every tuning observation needs an independent AP document: ' + row.id);
    engine.validate(row.document);
    const digest = hash(row.document);
    if (documentSplits.has(digest) && documentSplits.get(digest) !== row.split) throw new Error('Identical AP document crosses splits; changing work_id does not make an independent work');
    documentSplits.set(digest, row.split);
    if (documents.has(row.work_id) && documents.get(row.work_id).hash !== digest) throw new Error('One work_id cannot refer to different document contents; use distinct version ids and the same source group');
    documents.set(row.work_id, { hash: digest, document: row.document });
    sourceDocuments[row.work_id] = { input_sha256: digest, scene_ids: row.document.scenes.map(scene => scene.id) };
    if (row.scene_id != null && !row.document.scenes.some(scene => scene.id === row.scene_id)) throw new Error('Unknown scene_id: ' + row.scene_id);
  }
  function binding(channel) {
    const spec = channelMap[channel] || (catalog.defs.some(item => item.id === channel) ? { kind: 'cfs', id: channel } : catalog.emotions.some(item => item.id === channel) ? { kind: 'emotion', id: channel } : null);
    if (!spec || !['cfs', 'emotion', 'score_metric', 'score'].includes(spec.kind) || !['mean', 'peak', 'end'].includes(spec.aggregation || 'mean')) throw new Error('Explicit supported channel_map is required for ' + channel);
    if (spec.kind === 'cfs' && (!catalog.defs.some(item => item.id === spec.id) || ['positive', 'negative'].includes(spec.id))) throw new Error('cfs mapping must name a bounded AP state, not an unbounded signal rate');
    if (spec.kind === 'emotion' && !dataset.observations.every(row => (row.document.emotionModel || catalog.emotions).some(item => item.id === spec.id))) throw new Error('Emotion mapping is absent from a document: ' + spec.id);
    return spec;
  }
  const bindings = Object.fromEntries(channels.map(channel => [channel, binding(channel)]));
  function extract(result, row, spec) {
    if (spec.kind === 'score') return result.score.value == null ? null : result.score.value / 100;
    if (spec.kind === 'score_metric') {
      if (!Object.hasOwn(result.score.metrics, spec.id)) throw new Error('Unknown score metric: ' + spec.id);
      return result.score.metrics[spec.id];
    }
    const selected = row.scene_id ? result.rows.filter(item => item.id === row.scene_id) : result.rows;
    const aggregation = spec.aggregation || 'mean';
    if (spec.kind === 'emotion' && aggregation === 'peak') throw new Error('Emotion peak is not retained by the shared engine; use mean or end');
    const values = selected.map(item => spec.kind === 'emotion' ? aggregation === 'end' ? (item.emotions[spec.id].value === null ? null : item.emotions[spec.id].end.low) : item.emotions[spec.id].value : aggregation === 'peak' ? item.peak[spec.id] : aggregation === 'end' ? item.endState[spec.id] : item.cfs[spec.id]);
    if (!values.every(finite)) return null;
    if (values.some(value => value < 0 || value > 1)) throw new Error('Selected state is not normalized to [0,1]');
    if (aggregation === 'end') return values.at(-1);
    if (aggregation === 'peak') return Math.max(...values);
    const duration = selected.reduce((sum, item) => sum + item.duration, 0);
    return values.reduce((sum, value, index) => sum + value * selected[index].duration, 0) / duration;
  }
  function recompute(rows, parameters) {
    const cache = new Map();
    return rows.map(row => {
      const entry = documents.get(row.work_id);
      if (!cache.has(entry.hash)) { const doc = clone(entry.document); doc.parameters = { ...(doc.parameters || {}), ...parameters }; cache.set(entry.hash, engine.evaluate(doc)); }
      const result = cache.get(entry.hash);
      return { ...row, predictions: Object.fromEntries(channels.map(channel => [channel, extract(result, row, bindings[channel])])) };
    });
  }
  function losses(rows) {
    const perChannel = Object.fromEntries(channels.map(channel => [channel, stats(pairs(rows, channel))]));
    if (channels.some(channel => perChannel[channel].mse === null)) return { mse: null, channels: perChannel };
    return { mse: channels.reduce((sum, channel) => sum + perChannel[channel].mse, 0) / channels.length, channels: perChannel };
  }
  const trials = candidates.map((parameters, index) => ({ index, parameters, train: losses(recompute(partitions.train, parameters)), validation: losses(recompute(partitions.validation, parameters)) }));
  if (trials.some(trial => trial.train.mse === null || trial.validation.mse === null)) throw new Error('Every selected channel needs observed, computable pairs in train and validation; do not replace missing feelings with zero');
  let selected = 0;
  for (let i = 1; i < trials.length; i++) if (trials[i].validation.mse < trials[selected].validation.mse - 1e-12) selected = i;
  const selectedParameters = candidates[selected], selectedTrain = recompute(partitions.train, selectedParameters), selectedTest = recompute(partitions.test, selectedParameters);
  const test = losses(selectedTest), baselineTest = losses(recompute(partitions.test, {}));
  const trainMeanBaseline = Object.fromEntries(channels.map(channel => {
    const trainMean = meanObserved(pairs(selectedTrain, channel));
    return [channel, { train_mean: trainMean, test: stats(pairs(selectedTest, channel), () => trainMean), test_improvement: bootstrapDifference(pairs(selectedTest, channel), { slope: 1, intercept: 0 }, () => trainMean) }];
  }));
  const sourceHash = hash({ dataset_id: dataset.dataset_id, source: dataset.source, rows: dataset.observations.filter(row => row.split !== 'test'), grid, bindings });
  return { schema: 'ap-aesthetics-parameter-search/1', candidate_id: 'parameters-' + hash({ sourceHash, selectedParameters }).slice(0, 20), engine_version: catalog.version, dataset_id: dataset.dataset_id, dataset_hash: inspection.dataset_hash, selection_hash: sourceHash, selected_index: selected, parameters: clone(selectedParameters), channel_map: bindings, trials, test, baseline_test: baselineTest, train_mean_baseline: trainMeanBaseline, test_only_channels: Object.fromEntries(testOnlyChannels.map(channel => [channel, 'Unvalidated; no training/validation labels and excluded from selection or channel binding.'])), source_documents: sourceDocuments, selected_document_hashes: Object.fromEntries([...documents].map(([id, entry]) => { const doc = clone(entry.document); doc.parameters = { ...(doc.parameters || {}), ...selectedParameters }; return [id, hash(doc)]; })), adoption: 'Candidate only. Original documents and engine defaults were not changed. Test is reported after selection and must not be reused to tune again.', warnings: inspection.warnings };
}

module.exports = { inspectDataset, fitCalibration, applyCalibration, tuneParameters };
