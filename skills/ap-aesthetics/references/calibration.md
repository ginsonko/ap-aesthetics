# Calibration decision guide

Use `ap_inspect_dataset` before fitting. The observation schema is `ap-aesthetics-observations/1`, with dataset/source provenance, independent prediction provenance, work and group identities, explicit train/validation/test split, prediction channels and independently collected human labels.

`ap_fit_calibration` fits an output mapping; `ap_tune_parameters` tests a finite parameter grid with the same AP engine. Both return explicit candidates and comparisons rather than silently adopting a winner. `ap_apply_calibration` applies the saved mapping. Read the repository's `docs/CALIBRATION.md` and tool results for exact contracts and evidence.

- Split by work/source group. Repeated moments, translated versions or reviews of the same work must not leak into both training and test.
- Label what was measured: expressed/writer emotion, perceived emotion, reader/viewer/listener response, valence, arousal, liking and retention are different targets.
- Do not derive prediction inputs from the same labels being predicted. Freezing an LLM label doesn't make it independent human evidence.
- Report train-mean and an appropriate simple non-AP baseline, sample/work counts, held-out error and uncertainty. Improvement on one corpus does not establish cultural, platform or temporal universality.
- Publicly visible data may have redistribution or use restrictions. Download from documented sources under their terms; retain URLs, version/hash, fields and license. Do not publish usernames, private feedback or raw datasets by default.
- User feedback on the demo is an individual pilot. Keep it separate from public corpus fitting and from future held-out observations.
- A demonstration that induces one reaction is not unique evidence for AP; alternative models can predict surprise and relief too. Seek discriminating predictions and retain failures.
