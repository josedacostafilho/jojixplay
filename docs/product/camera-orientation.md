---
status: Active
last_verified: 2026-09-24
---

# Camera coordinates

Phone-only landscape is authoritative. Screen orientation metadata plus the viewport gate entry. Native lock is optional. Portrait unmounts play and releases the camera.

The camera controller normalizes source dimensions and quarter-turn rotation into one upright landscape basis. A source change must stabilize before publishing a new `{ width, height, layout: "landscape", epoch }`. An epoch changes whenever the committed camera basis changes. Raw worker observations remain unmirrored and unsmoothed; every temporal consumer resets on a new epoch. MediaPipe receives the corresponding quarter-turn and its output is transformed once. Presentation alone mirrors horizontal position. Anatomical left/right names never swap.

Missing joints are independently unavailable; no body completeness check controls orientation, readiness or observation delivery. See [architecture](../architecture/overview.md) for the SDK conversion.
