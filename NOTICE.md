# Source and license notices

Original software, authored scenario annotations, demo graphics and generated-example code in this repository are provided under the repository MIT license.

## EmoBank

- Authoritative repository: https://github.com/JULIELab/EmoBank
- Dataset reference: Buechel, S. and Hahn, U. (2017), *EmoBank: Studying the Impact of Annotation Perspective and Representation Format on Dimensional Emotion Analysis*.
- Dataset license stated by the upstream repository: **CC BY-SA 4.0**. The MIT license here does not relicense EmoBank.
- The download script pins an upstream revision and records URL, digest, counts, source perspective and license in its result. Raw data is read into memory and is not redistributed in the source repository. Derived `examples/calibration-emobank-summary.json` statistics retain CC BY-SA 4.0 attribution and terms.
- Writer and reader ratings represent different annotation perspectives. They are not AP-generated predictions, clinical measurements, artistic satisfaction or labels for all cognitive feelings. Their relationship can demonstrate a statistical pipeline but cannot establish AP accuracy.
- See `docs/CALIBRATION.md` for label semantics, splitting and remaining limitations.

## Dependencies and demo reproduction

The Model Context Protocol TypeScript SDK retains its own MIT license and notices in the installed dependency. Node.js, FFmpeg, Pillow, system fonts and speech voices are separately installed tools; their binaries, fonts and voice engines are not redistributed here. Check the installed voice/tool terms if redistributing newly rendered media commercially. The repository does not bundle a trained language model or an external API credential.

No other public affect dataset is bundled. Mention of a possible future source is not permission to download, relicense or redistribute it.
