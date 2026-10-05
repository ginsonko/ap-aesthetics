# Model card and calculation contract

Package: 0.2.0. Core: 0.1.0. Status: exploratory, authored parameterization. The wrapper does not imply an empirically improved core. No fitted population model is enabled by default.

## What the model computes

The input is a chronological document of annotated stages. Each stage includes duration, stable attention object, subject/world/layer scope, observable cues and optional predicted-outcome accounts. Thirty-one cue fields describe features, explanation evidence, relationships, sensory form and relative time/space. Unknowns remain null. The output includes 47 state channels and 19 configurable emotion combinations. The complete machine-readable dictionary, defaults and combination expressions are returned by `ap_catalog` and live in `web/catalog.js`.

The model is causal with respect to document order: no later scene is read to compute an earlier state. An annotator must independently avoid using future knowledge. An input field alone cannot prove that independence.

## Update order

1. Resolve subject/world/layer and stable object identity; restore state for that scope.
2. Recover fatigue and internal activation for unattended objects according to elapsed time.
3. Compare actual and expected features; compute surprise, mismatch and evidence-supported explanation changes.
4. Update each predicted outcome separately: reward gain/loss and punishment gain/reduction. Realized outcomes exit their open lifecycle without a second fictitious cancellation penalty.
5. In steps of 0.5 seconds, evolve attention, internal continuity, unresolved questions, feeling, fatigue, familiarity and habit.
6. Count one-time events once; integrate sustained signal rates over seconds. Preserve positive and negative sources together.
7. Combine concurrent feelings into each emotion target and approach it with a configurable half-life.
8. Return means, peaks, end states, coverage and source accounts; calculate a goal-conditioned creative index.

## Equations and units

For `[x]+ = max(0,x)`, surprise is the positive excess of an actual novel feature over its predicted strength and threshold. Dissonance is the unmet portion of an expected, now-due feature. Separate features permit both together. Surprise can recruit attention without implying threat or punishment.

For outcome j, `G_j = p_j × reward_j`, `B_j = p_j × punishment_j`:

```
positive_change_j = [G_new - G_old]+ + [B_old - B_new]+
negative_change_j = [G_old - G_new]+ + [B_new - B_old]+
```

Sum after separating outcomes; one good outcome must not erase another loss. Unresolved reward predictions and avoidable punishment support anticipation; unresolved punishment and reward-loss risk support pressure. Subjective values are annotation inputs, not universal rewards.

Evidence-supported explanation growth, correction of mismatch and closure retain separate state readouts. For one shared explanatory contribution, the default signal accounting uses the maximum of weighted contributions, instead of counting the same evidence fully three times. Distinct processes can carry separate identities. This is a conservative prototype convention, not a demonstrated neural law.

Attention priorities include habit baseline, internal activation, surprise, mismatch, unresolved questions, predicted value, continuity, relevance and fatigue. A softmax distributes attention between the current object, old objects and background. Attention modulates gain; fatigue suppresses it. There is no fixed emotional winner.

For a rate-driven state X with half-life h, `lambda = ln(2)/h`:

```
X_next = X × exp(-lambda × dt) + input_rate × (1-exp(-lambda × dt))/lambda
slow_next = slow × 2^(-dt/h) + target × (1-2^(-dt/h))
emotion_target = 1-exp(-emotionGain × sum(weight × combination))
```

These are numerical prototype units, not neurotransmitter measurements. Most state intensities are on 0–1; positive/negative rates have distinct units. Intensities are not event probabilities. The known/default expression range for missing inputs is not a statistical confidence interval. Numerical stepping of nonlinear attention is not proven invariant to arbitrary timestep changes. The current surprise-event display uses a fixed four-second pulse half-life.

## Creative score and diagnostics

The target index weights understanding, relationship, development, comfort, form, afterglow and selected emotion targets. Quiet, bittersweet, comedy and suspense targets differ. Unknown components retain their weight and produce a range. A higher score under one target need not be preferable under another.

`ap_compare` holds audience, target and model fixed by default. `ap_sensitivity` varies an assumption; it is not evidence of a better artifact. Diagnostics point to a state and plausible causes, but ambiguity, sadness, waiting and tension are not automatically defects. Scores reflect supplied annotations and can be gamed; re-annotation must follow actual creative changes and retain provenance.

## Calibration and intended validation

Output calibration and finite parameter tuning are separate adapters. They return versioned candidates with dataset identity, held-out results and baselines. They never silently replace core defaults. A valence/arousal adapter does not validate all cognitive states. Group-average responses do not identify each person's response or reveal the underlying causal mechanism.

The most useful next validation compares independent cue annotations and human responses for several versions of the same works, with work-level separation across fitting and testing. Compare against a train-only mean and direct prediction baselines. Inspect subgroup errors, sample counts, uncertainty, drift and annotation reliability. Failure can arise in cues, priors, parameters, emotion mapping, reporting or the mechanism itself; do not explain away every counterexample.

## Known limitations

- Human/agent cue annotation is required; raw text, audio and video are not automatically parsed.
- The current single-focus stage model is not the complete AP organism, a full associative-memory implementation or multi-modal subconscious simulation.
- Long-term habit here is an exposure trace, not a learned policy from real action outcomes.
- Unresolved questions mainly attach to objects, not a complete graph of distinct questions.
- Positive/negative source accounting cannot automatically detect every semantic double-count in input annotations.
- Current scoring emphasizes means and ending state; transition rhythm, peak/end memory and narrative genre may need richer independent validation.
- Default emotion combinations and coefficients are editable hypotheses; no universal psychological constants are claimed.
- Multiple subject/world scopes do not become one person's experience; unsupported aggregate scores stay unknown.

Design provenance: the author's AP aesthetics formula drafts 0.2 and correction 0.2.1, plus the implemented catalog and original sample annotations. Source labels in the catalog retain distinctions between AP definitions and consultation extensions. This release does not redistribute private research archives or claim that every historical AP document was fully reviewed.
