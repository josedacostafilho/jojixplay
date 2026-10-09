# Vendored models

`pose_landmarker_full.task` is the MediaPipe Pose Landmarker Full float16 model bundle downloaded from Google's canonical model host:

```text
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task
```

- SHA-256: `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`, enforced from `pose_landmarker_full.task.sha256` by `npm run verify:assets`
- Model family: BlazePose GHUM Full
- License: Apache License 2.0, as stated by the [official model card](https://developers.google.com/ml-kit/images/vision/pose-detection/pose_model_card.pdf)
- Retrieval date: 2026-09-24

The production build copies this exact file to `dist/mediapipe/pose-landmarker-full-float16-1/`. MediaPipe runtime files use the similarly immutable `dist/mediapipe/tasks-vision-1.0.1/` path. These versioned asset paths are intentional cache-cutover boundaries: update the source, destination revision, checksum, documentation, tests, and callers atomically when replacing either dependency.

## Hand Landmarker

`hand_landmarker.task` is the float16 revision 1 task bundle from Google's canonical model host, retrieved 2026-09-27:

```text
https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
```

- SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`, enforced from `hand_landmarker.task.sha256` by `npm run verify:assets`
- Contents: palm detection and 21 hand landmarks; no gesture classifier
- License: Apache License 2.0, as stated by the [official model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf)

The build copies it to `dist/mediapipe/hand-landmarker-float16-1/`. The browser requests it only when a game first asks the host to sense hands.
