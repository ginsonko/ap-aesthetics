# Annotating a creative artifact

`ap_template` creates schema `ap-aesthetics/1` with `null` cues. `ap_catalog` exposes authoritative fields and ranges. Ordinary work can keep default parameters but must identify them as uncalibrated assumptions.

Each scene has `id`, `title`, `description`, `duration` in seconds, stable `object`, `cues`, `outcomesKnown` and `outcomes`. Use `annotation` to preserve method, source span/timecode and `independent_of_outcome_labels`. Descriptions are not automatically interpreted by the engine.

| Cue family | Annotate from the artifact and prior audience knowledge |
| --- | --- |
| New vs expected features | actualNovel/predictedNovel compare the same new feature; actualExpected/predictedExpected compare the same feature whose prediction is due. Surprise and dissonance can coexist. |
| Explanation | explanation/evidence/resolution describe support, available evidence and actual resolving progress. A writer knowing the answer does not mean the audience knows it. |
| Questions and development | question/load/detail/continuity/relevance/progress describe audience goals and information, not just the protagonist's objective. |
| Value | care/memory/loss/threat/safety/selfRelevance/unfairness/selfResponsibility need concrete supporting cues; do not fill in the desired emotion. |
| Form and body | pleasant/sensoryCost/craft/playfulness/scale describe cues and audience-specific value. Loudness is not the same as surprise or quality. |
| Time and space | expectedInterval/actualInterval use seconds; order/spatial use relative support; distance uses one consistent scale. Unknown rhythms stay null. |

Result entries are `pending` (p/reward/penalty), `realized` or `ruled_out` (actualPositive/actualNegative), or `unknown`. First entry needs baselineGood/baselineBad for a valid change signal. An empty outcomes array means no update, not all previous predictions disappeared. Keep a result ID across its lifecycle; use a new ID for a genuinely new occurrence.

Additional independent processes can be `event` or `rate`, with id/positive/negative/evidence. Do not add a process already represented by another source merely because it has a second emotional label. Rates integrate over real seconds; events count once.

Text: estimate reading time and record it; timecoded performance can replace it later. Images: use viewing regions or intended reveal order, not invented eye-tracking observations. Video: read actual frames and sound, preserve causal cue order. Music: annotate rhythmic expectation, development, repetition, sound comfort and learned associations without calling every minor-key passage sad for every listener. Across media, the shared cognitive schema is a hypothesis; each needs relevant data.

Missing cue propagation may make some scores unknown. Keep uncertainty visible. Compare input methods as well as creative changes; a numerical gain produced solely by a more generous annotator is not a better work.
