---
name: ap-aesthetics
description: Evaluate and improve audience cognition, emotional progression and pacing in a story, script, video, image sequence or music using the local AP Aesthetics calculator. Compare creative variants, explain weak spots, or calibrate predictions against independent audience observations. Use when creating or reviewing emotionally purposeful media; not for clinical assessment or claiming mind reading.
---

# AP Aesthetics / 观众心景

Use the calculator to make creative hypotheses explicit and comparable. Keep the user's medium, artistic intention and audience. A higher heuristic score is one consideration, never a substitute for an actual viewing/listening and human response.

## Entry

Prefer MCP server `ap-aesthetics`: start with `ap_catalog` and `ap_template`; then `ap_evaluate`, `ap_compare` or `ap_audience_panel`. All these tools compute locally from supplied structured data; they do not read media, call an external model, or upload work.

If MCP is unavailable, run `node <this-skill>/scripts/run.js catalog` (then `template`, `evaluate`, `compare`, `panel`, `inspect`, `fit`, `tune`). The installer records the local package location; a repository checkout also works. Read [input annotation](references/annotation.md) for cue semantics and [calibration](references/calibration.md) when fitting empirical data.

## Creative evaluation

1. Establish the intended experience and audience. Preserve genre and negative emotions that serve it. Select an existing target or explain the target's limits; never make every work cheerful or shocking.
2. Inspect the actual authorized text, frames and/or audio. Divide meaningful events into stages with real or stated estimated durations. Keep observed artifact facts, audience prior assumptions and annotations separate. The engine cannot see the media just because its path appears in the prompt.
3. Annotate each stage using only information already available to that audience. Stable object IDs carry attention, fatigue and habit. Preserve `null` for unknown cues. Attach source spans/timecodes and record annotation uncertainty. For video/music, distinguish perceived expressive emotion from the feeling induced in a viewer/listener.
4. Evaluate all cognitive channels, mixed emotions, attention and source contributions. Distinguish stage mean, peak and end state. A short shock can have a low mean. Unresolved questions may be deliberate; diagnostics are hypotheses to inspect, not automatic defects.
5. Propose concrete changes to the artifact and what causal path they should change. Compare plausible alternatives, including keeping an intentional quiet passage. Hold audience, target, formula version and annotation method fixed. Do not inflate cue values or change scoring weights to manufacture improvement.
6. Re-evaluate the actual revised artifact and inspect/listen to it. Report the score delta, changed trajectories, tradeoffs, missing evidence and whether any audience feedback exists. Stop iterating when further score gains merely exploit the model or no longer improve the intended experience.

Use `ap_sensitivity` to expose dependence on uncertain parameters; this changes model assumptions, not the creative artifact. Use `ap_audience_panel` for stated audience scenarios; its weighted mixture is not a demographic estimate unless actual sampling evidence supports the weights.

## Learning from people

Freeze predictions and artifact identity before collecting responses. Capture unprompted feedback before revealing hypotheses when feasible; permit no feeling, another feeling, guessed ending and missed cue. Record first viewing versus repeat viewing. An unexpected response is informative, not automatically proof of the theory or proof that all theory is wrong.

Human labels must be independent of the cue annotation and predictions. Dataset inspection and fitting keep works/source groups separated across train, validation and test. Test labels must not guide choices. Return candidate calibration/model versions; do not silently replace the baseline. A fitted valence/arousal interface does not validate every AP cognitive state or aesthetics as a whole.

## Output

Provide the useful creative diagnosis first, followed by a compact stage table and concrete revision choices. Link input and result JSON so the analysis can be reproduced. State whether results are heuristic, calibrated on which data, or actually validated on a held-out audience. Never call the artistic target index a satisfaction percentage. The tool is an aid for making and testing art, not a medical model or evidence that AP has explained all psychology.
