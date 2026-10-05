# AP Aesthetics · 观众心景

**Make audience experience an inspectable creative hypothesis.** Model how attention, curiosity, surprise, understanding, fatigue and mixed emotions evolve through a work; compare concrete revisions; calibrate against independent human observations.

[中文说明](README.zh-CN.md) · [Model & formulas](docs/MODEL.md) · [Calibration](docs/CALIBRATION.md) · [Skill](skills/ap-aesthetics/SKILL.md)

This is a working research and creative-assistance prototype, not a validated universal theory of psychology. Its creative-target index is **not a satisfaction percentage**. Population prediction accuracy remains to be measured on independent artifact annotations and audience responses.

## Try it

Requires Node.js 20+ (no API key, model download, or paid service).

```sh
git clone https://github.com/ginsonko/ap-aesthetics.git
cd ap-aesthetics
npm ci
npm run build
npm run serve
```

Open **http://127.0.0.1:18933/**. The calculator also works offline by opening `dist/ap-aesthetics.html`. Work data stays local. The local server binds only to loopback and serves an explicit set of app/media assets, not private datasets.

## Use while creating

```sh
node bin/cli.js catalog
node bin/cli.js evaluate examples/magi.json > evaluation.json
node bin/cli.js compare original.json revised.json > comparison.json
```

1. Inspect the actual work, identify the intended audience and artistic goal.
2. Annotate time-ordered cues and expected outcomes, using only information the audience has at each stage. Keep unknowns `null`.
3. Inspect trajectories, source contributions, mixed emotions and diagnostics.
4. Change the artifact; re-annotate and compare using the same audience, goal and formulas.
5. Freeze predictions, collect human feedback independently, then calibrate and test on separate works.

The engine accepts text, image sequences, film and music annotations through the same stage schema. It **does not automatically see, hear or understand media files**. A human or a capable agent supplies evidence-based annotations. See [annotation guidance](skills/ap-aesthetics/references/annotation.md).

## Skill and MCP

```sh
npm run install:skill
codex mcp add ap-aesthetics -- node /absolute/path/to/ap-aesthetics/bin/mcp.js
```

On Windows use the absolute Node executable if it is not on the client's PATH. Restart or open a new client session if discovery does not refresh. The installer preserves a backup of an existing skill managed by this package; it refuses to overwrite an unrelated skill of the same name.

Example request: **“Use $ap-aesthetics to inspect this script, identify where a first-time viewer may lose the thread, propose two edits that preserve its quiet tone, and compare the real revisions.”**

Any stdio MCP client can use:

```json
{
  "mcpServers": {
    "ap-aesthetics": {
      "command": "node",
      "args": ["/absolute/path/to/ap-aesthetics/bin/mcp.js"]
    }
  }
}
```

| Tool | Purpose |
| --- | --- |
| `ap_catalog`, `ap_template` | Definitions and an unknown-first document skeleton |
| `ap_evaluate` | 47 state channels, 19 configurable emotion combinations, source accounts, diagnostics |
| `ap_compare` | Actual version comparison with model/audience/goal held fixed by default |
| `ap_audience_panel` | Explicit weighted audience scenarios; not an inferred population |
| `ap_sensitivity` | Dependence on model assumptions |
| `ap_inspect_dataset` | Missingness, provenance declarations and group leakage |
| `ap_fit_calibration`, `ap_apply_calibration` | Versioned output adapters and explicit application |
| `ap_tune_parameters` | Finite search using the same calculation engine |

The browser, CLI and MCP use one calculation core in `web/engine.js`. All tools compute locally from supplied objects. They do not call external LLMs, upload work, adopt a fitted model automatically, or execute text in a story.

## Learn from data

```sh
node bin/cli.js inspect examples/calibration-synthetic.json
node bin/cli.js fit examples/calibration-synthetic.json > candidate-model.json
npm run data:emobank -- --download --out examples/calibration-emobank-summary.json
```

See the complete [calibration protocol](docs/CALIBRATION.md). Public-data downloads are explicit commands. The EmoBank adapter reads pinned source files into memory and writes aggregate statistics; raw third-party text is not committed. Its own license applies to derived statistics. EmoBank writer/reader statistics are a calibration-pipeline demonstration, **not AP prediction accuracy**. VAD ratings do not provide ground truth for all AP states or overall artistic quality.

Calibration keeps train, validation and test separated by work/source group. Reports retain baseline comparisons, missing channels, group counts, error and uncertainty. Parameter fitting returns a candidate; a human decides whether the evidence justifies adopting it.

## Experience demo

The original 126-second illustrated sketch and its feedback page are preserved under `demo/` as a technical example. Its visual and narration quality were rejected in first user review; a fully redesigned creative version is in progress. Rendered video/audio are not committed. See [reproduction and evidence](docs/EXPERIENCE.md). First viewers can record free responses before explanations, including no feeling, missed cues and guessed endings. Feedback stays in the browser until explicitly exported. Passing functional checks is not artistic acceptance.

## Development and scope

```sh
npm test
npm run build
```

MIT for original code and content. Third-party datasets keep their own terms; see [NOTICE](NOTICE.md). No claim of clinical validity, universal aesthetics, or proven improvement in audience satisfaction. Contributions should expose evidence and uncertainty, preserve artistic differences, and test against independent observations instead of optimizing self-assigned scores.
