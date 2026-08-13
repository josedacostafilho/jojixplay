# Vendored pose model

`pose_landmarker_lite.task` is the MediaPipe Pose Landmarker Lite float16 model bundle downloaded from Google's canonical model host:

```text
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
```

- SHA-256: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`, enforced from `pose_landmarker_lite.task.sha256` by `npm run verify:assets`
- Model family: BlazePose GHUM Lite
- License: Apache License 2.0, as stated by the [official model card](https://developers.google.com/ml-kit/images/vision/pose-detection/pose_model_card.pdf)
- Retrieval date: 2026-08-13

The production build copies this exact file to `dist/mediapipe/pose-landmarker-lite-float16-1/`. MediaPipe runtime files use the similarly immutable `dist/mediapipe/tasks-vision-1.0.1/` path. These versioned asset paths are intentional cache-cutover boundaries: update the source, destination revision, checksum, documentation, tests, and callers atomically when replacing either dependency.
