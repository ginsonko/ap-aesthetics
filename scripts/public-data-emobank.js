#!/usr/bin/env node
'use strict';

// Explicit read-only public data acquisition. Raw texts, ratings and row identifiers
// are kept in memory; only aggregate statistics are emitted by this script.
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fitCalibration } = require('../lib/calibration.js');
const REVISION = '248ce2a43e165a66d31aeaed83cff9641d6654e0';
const REPOSITORY = 'https://github.com/JULIELab/EmoBank';
const FILES = ['README.md', 'corpus/README.md', 'corpus/reader.csv', 'corpus/writer.csv', 'corpus/meta.tsv'];
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const PINNED_SHA256 = {
  'README.md': 'b4ea304ce4ef4ae1eb3526aff90497a44d46a810bff3a007fa77565e52939e83',
  'corpus/README.md': '5816dae63bc7ed845a2079859e9b6e500a10532006630dcf6414b149368c3451',
  'corpus/reader.csv': 'd5398f14afde4f02d3a335393b60fc4a45d03dc5ab65b6909c7c31a633dec175',
  'corpus/writer.csv': '311d895d21b1047cc875a9b082e1c3e17df548011d2dec8227cf3a53b0c34e0a',
  'corpus/meta.tsv': 'c848266476711a3fb68395b9907ef574e60289ad916c8db79b7ea2e62ab62e0e'
};
function request(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'AP-aesthetics-public-data/0.1', Accept: 'application/vnd.github+json' }, timeout: 30000 }, res => {
      const chunks = []; let length = 0;
      res.on('data', chunk => { length += chunk.length; if (length > 8 * 1024 * 1024) { req.destroy(new Error('Public file exceeds bounded fetch size')); return; } chunks.push(chunk); });
      res.on('end', () => { const body = Buffer.concat(chunks); if (res.statusCode !== 200) reject(new Error('GitHub HTTP ' + res.statusCode + '; no private token is required or read')); else resolve(body); });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Public data fetch timed out')));
    req.on('error', reject);
  });
}
async function loadFile(relative, fromDirectory) {
  if (fromDirectory) return fs.readFileSync(path.join(fromDirectory, relative));
  const api = 'https://api.github.com/repos/JULIELab/EmoBank/contents/' + relative + '?ref=' + REVISION;
  const json = JSON.parse((await request(api)).toString('utf8'));
  if (json.encoding !== 'base64' || typeof json.content !== 'string') throw new Error('Official file was not returned as base64: ' + relative);
  return Buffer.from(json.content, 'base64');
}
function parseDelimited(text, delimiter = ',') {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (quoted) throw new Error('Unterminated quote in public CSV');
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  const header = rows.shift();
  return rows.map(values => { if (values.length !== header.length) throw new Error('Column count mismatch in public table'); return Object.fromEntries(header.map((key, index) => [key.replace(/^\uFEFF/, ''), values[index]])); });
}
const avg = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const round = value => value == null ? null : Number(value.toFixed(8));
function summary(values) { const mean = avg(values); return { n: values.length, mean: round(mean), sd: round(Math.sqrt(avg(values.map(value => (value - mean) ** 2)))), min: Math.min(...values), max: Math.max(...values) }; }
function correlation(a, b) {
  const ma = avg(a), mb = avg(b), va = avg(a.map(value => (value - ma) ** 2)), vb = avg(b.map(value => (value - mb) ** 2));
  return va > 0 && vb > 0 ? avg(a.map((value, i) => (value - ma) * (b[i] - mb))) / Math.sqrt(va * vb) : null;
}
function sourceSplit(document) {
  // Fixed salt and source-document identity only. The split never sees V/A/D labels.
  const bucket = parseInt(digest('ap-aesthetics-emobank-group-v1:' + document).slice(0, 8), 16) / 4294967296;
  return bucket < .7 ? 'train' : bucket < .85 ? 'validation' : 'test';
}
function validateRatings(rows, label) {
  const ids = new Set();
  for (const row of rows) {
    if (!row.id || ids.has(row.id)) throw new Error('Duplicate/missing ' + label + ' rating id'); ids.add(row.id);
    for (const field of ['V', 'A', 'D']) { row[field] = Number(row[field]); if (!Number.isFinite(row[field]) || row[field] < 1 || row[field] > 5) throw new Error('Rating outside official [1,5] scale'); }
    row.N = Number(row.N); if (!Number.isInteger(row.N) || row.N < 1) throw new Error('Invalid rating count');
  }
  return rows;
}
function groupedMeans(rows, metadata, channel) {
  const groups = new Map();
  for (const row of rows) { const document = metadata.get(row.id)?.document; if (!document) throw new Error('Rating has no source document metadata'); if (!groups.has(document)) groups.set(document, []); groups.get(document).push((row[channel] - 1) / 4); }
  return [...groups].map(([document, values]) => ({ document, split: sourceSplit(document), mean: avg(values), values }));
}
async function run(options = {}) {
  if (!options.download && !options.fromDirectory) throw new Error('Use --download for explicit public access, or --from-directory for an already downloaded pinned corpus.');
  const files = Object.fromEntries(await Promise.all(FILES.map(async relative => [relative, await loadFile(relative, options.fromDirectory)])));
  for (const [relative, bytes] of Object.entries(files)) if (digest(bytes) !== PINNED_SHA256[relative]) throw new Error('Pinned SHA-256 mismatch; do not claim this is the reviewed corpus revision: ' + relative);
  if (!/CC-BY-SA 4\.0/.test(files['README.md'].toString('utf8'))) throw new Error('Official license declaration changed; inspect before processing');
  const reader = validateRatings(parseDelimited(files['corpus/reader.csv'].toString('utf8')), 'reader');
  const writer = validateRatings(parseDelimited(files['corpus/writer.csv'].toString('utf8')), 'writer');
  const metadataRows = parseDelimited(files['corpus/meta.tsv'].toString('utf8'), '\t');
  const metadata = new Map(metadataRows.map(row => [row.id, row]));
  if (metadata.size !== metadataRows.length) throw new Error('Duplicate metadata identity');
  const writerById = new Map(writer.map(row => [row.id, row]));
  const common = reader.filter(row => writerById.has(row.id));
  const perspectiveSummary = {}, baselines = {}, perspectiveAgreement = {};
  for (const [perspective, rows] of [['reader', reader], ['writer', writer]]) {
    const uniqueGroups = new Set(rows.map(row => metadata.get(row.id)?.document));
    perspectiveSummary[perspective] = { rows: rows.length, source_documents: uniqueGroups.size, annotation_count_sum: rows.reduce((sum, row) => sum + row.N, 0), annotation_count_is_not_unique_people: true, channels_original_1_to_5: Object.fromEntries(['V', 'A', 'D'].map(channel => [channel, summary(rows.map(row => row[channel]))])) };
    baselines[perspective] = {};
    for (const channel of ['V', 'A', 'D']) {
      const groups = groupedMeans(rows, metadata, channel), train = groups.filter(group => group.split === 'train');
      const mean = avg(train.map(group => group.mean));
      if (mean == null) throw new Error('Empty training split');
      const result = { train_source_group_mean_0_to_1: round(mean), splits: {} };
      for (const split of ['train', 'validation', 'test']) {
        const selected = groups.filter(group => group.split === split);
        const mse = avg(selected.map(group => avg(group.values.map(value => (value - mean) ** 2))));
        const mae = avg(selected.map(group => avg(group.values.map(value => Math.abs(value - mean)))));
        result.splits[split] = { source_groups: selected.length, rows: selected.reduce((sum, group) => sum + group.values.length, 0), group_balanced_mse: round(mse), group_balanced_rmse: round(mse == null ? null : Math.sqrt(mse)), group_balanced_mae: round(mae) };
      }
      baselines[perspective][channel] = result;
    }
  }
  for (const channel of ['V', 'A', 'D']) {
    const a = common.map(row => row[channel]), b = common.map(row => writerById.get(row.id)[channel]);
    perspectiveAgreement[channel] = { common_rows: common.length, pearson: round(correlation(a, b)), mean_absolute_difference_original_1_to_5: round(avg(a.map((value, i) => Math.abs(value - b[i])))), meaning: 'Agreement between two human annotation perspectives; NOT model prediction accuracy.' };
  }
  const perspectiveDataset = {
    schema: 'ap-aesthetics-observations/1', dataset_id: 'emobank-writer-to-reader-' + REVISION.slice(0, 12),
    source: { url: REPOSITORY, license: 'CC-BY-SA-4.0', label_kind: 'Human reader-perspective VAD target; human writer-perspective VAD as input. No AP prediction.' },
    prediction_provenance: { method: 'Input is copied only from the pre-existing writer.csv aggregate; target is copied only from reader.csv. Target-reader labels never construct writer inputs or group splits. Both datasets annotate the same sentences, so they are intentionally related. Worker-level independence was not established by this script.', independent_of_labels: true, independence_scope: 'Input construction is independent of target labels; does not assert statistical independence or distinct annotators.' },
    observations: common.map(row => {
      const w = writerById.get(row.id), document = metadata.get(row.id).document;
      return { id: row.id, work_id: document, group_id: document, split: sourceSplit(document), predictions: Object.fromEntries(['V', 'A', 'D'].map(channel => [channel, (w[channel] - 1) / 4])), observed: Object.fromEntries(['V', 'A', 'D'].map(channel => [channel, (row[channel] - 1) / 4])), n: row.N };
    })
  };
  const perspectiveCalibration = fitCalibration(perspectiveDataset);
  const categories = {};
  for (const row of reader) { const category = metadata.get(row.id).category; categories[category] = (categories[category] || 0) + 1; }
  return { schema: 'ap-aesthetics-public-data-report/1', generated_at: new Date().toISOString(), source: { repository: REPOSITORY, revision: REVISION, license: 'CC-BY-SA-4.0', license_url: 'https://creativecommons.org/licenses/by-sa/4.0/', attribution: 'Sven Buechel and Udo Hahn (2017), EmoBank, EACL 2017; Readers vs. writers vs. texts, LAW 2017.', papers: ['https://aclanthology.org/E17-2092/', 'https://aclanthology.org/W17-0801/'], raw_source_attribution: 'MASC and SemEval 2007 Task 14; see official README for full attribution.', file_sha256: Object.fromEntries(Object.entries(files).map(([key, value]) => [key, digest(value)])) }, statistic_license: 'CC-BY-SA-4.0 with source attribution; this report contains only aggregate statistics, no raw sentences or participant identities.', observation_scope: 'English sentence-level VAD ratings. Reader and writer perspectives remain separate. Population representativeness and AP cognitive-feeling accuracy have not been established.', perspectives: perspectiveSummary, reader_categories: categories, reader_writer_perspective_agreement: perspectiveAgreement, grouped_train_mean_baselines: baselines, human_perspective_mapping_experiment: { ap_accuracy: false, purpose: 'Real human-data execution check for the calibration pipeline. Human writer ratings are privileged labels, not an available AP text predictor.', input: 'writer.csv human ratings normalized (x-1)/4', target: 'reader.csv human ratings normalized (y-1)/4', worker_independence_verified: false, independence_scope: perspectiveDataset.prediction_provenance.independence_scope, matched_rows: common.length, calibration: perspectiveCalibration }, split_protocol: { method: 'SHA-256 of fixed salt plus metadata document; 70/15/15 thresholds; no outcome values used', unit: 'source document', differs_from_official_split: true, reason: 'Official stratified sentence split supports benchmark comparability; this stricter source-group split checks generalization across documents.', weighting: 'Equal total weight per source document, equal sentence weight within each document. N is descriptive, not independent source count.' }, ap_evaluation: { performed: false, reason: 'No independently annotated AP cue documents or frozen AP predictions exist for this corpus in this release. Neither reader nor writer labels are used to synthesize AP inputs.', needed: ['Blind independent AP cue annotation or text-to-cue extractor frozen before viewing labels', 'Explicit empirical mapping for supported VAD channels; no claim that VAD covers all AP feelings', 'Training/validation selection followed by untouched source-group test', 'New held-out data after using current test results for research decisions'] } };
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || !args.length) { console.log('Usage: node scripts/public-data-emobank.js --download [--out examples/calibration-emobank-summary.json]\n       node scripts/public-data-emobank.js --from-directory PATH [--out FILE]\nOnly official pinned public data is read. Raw files remain in memory. Output contains aggregate statistics, never AP accuracy claims.'); }
  else {
    const value = key => { const index = args.indexOf(key); if (index < 0) return undefined; if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Missing value for ' + key); return args[index + 1]; };
    const allowed = new Set(['--download', '--out', '--from-directory']);
    try {
      for (let i = 0; i < args.length; i++) { if (!allowed.has(args[i])) throw new Error('Unknown option: ' + args[i]); if (args[i] !== '--download') i++; }
      run({ download: args.includes('--download'), fromDirectory: value('--from-directory') }).then(result => { const text = JSON.stringify(result, null, 2) + '\n', output = value('--out'); if (output) { fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true }); fs.writeFileSync(output, text); console.log(JSON.stringify({ output, reader_rows: result.perspectives.reader.rows, writer_rows: result.perspectives.writer.rows, ap_evaluation_performed: false })); } else process.stdout.write(text); }).catch(error => { console.error(error.message); process.exitCode = 1; });
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
module.exports = { run, parseDelimited, sourceSplit };
