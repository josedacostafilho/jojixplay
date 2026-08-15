---
status: Active
last_verified: 2026-08-14
scope: Raw-pose ownership, consumer-specific filtering, diagnostics, model selection, and historical Draw stationarity rationale
---

# ADR-0011: Consumer-specific pose stability

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project owner
- **Supersedes:** The single-anchor, every-outlier-resets stationary test in [ADR-0010](0010-menu-and-draw-game.md)
- **Superseded by:** [ADR-0012](0012-two-hand-draw-grip.md) for Draw's stationary engagement/lifting classifier; [ADR-0014](0014-procedural-body-avatar.md) for the visible display signal; [ADR-0015](0015-canonical-camera-orientation.md) for the orientation-implicit, byte-for-byte MediaPipe landmark basis. Unfiltered canonical-pose ownership, consumer separation, diagnostics, and model-selection decisions remain active

> **Current-scope note:** ADR-0012 supersedes every Draw stationarity rule and test expectation below, ADR-0014 supersedes the unfiltered stick-skeleton display row, and ADR-0015 supersedes the statement that packets retain MediaPipe's orientation-specific image coordinates unchanged. Those passages remain only as historical rationale. Unfiltered canonical-pose ownership after phone-local orientation normalization, consumer-specific filtering, local diagnostics, and the model-selection boundary remain operative.

## Context

On the target phone, the one-player skeleton and especially its coarse hand move visibly while the person believes they are still. Draw originally required every coarse-hand sample to remain within a fixed radius of one raw anchor for 500 ms. A single landmark excursion beyond that radius reset the entire hold, even though Draw separately smoothed the rendered and recorded path. This made engagement and lifting difficult without proving that a different gesture was needed.

The current application uses `@mediapipe/tasks-vision`, not the legacy MediaPipe Pose Solution. The current JavaScript [`PoseLandmarkerOptions`](https://developers.google.com/edge/api/mediapipe/js/tasks-vision.poselandmarkeroptions) exposes detection, presence, tracking, pose-count, and segmentation options but no `smoothLandmarks` option. The underlying [Pose Landmarker graph](https://github.com/google-ai-edge/mediapipe/blob/02d83cb8eb451099dfb24c02a8784ed996a1710c/mediapipe/tasks/cc/vision/pose_landmarker/pose_landmarker_graph.cc#L303-L315) automatically enables its temporal landmark smoother for one pose in stream mode. JojixPlay already runs the graph in `VIDEO` mode and defaults to one pose.

Adding one application-wide low-pass filter would stack latency on top of MediaPipe's adaptive smoothing and force visually smooth rendering, continuous drawing, button hit testing, controller release, and stationary classification to share one tradeoff. These consumers have different latency and noise requirements.

## Decision

### Scope and canonical data

- Optimize and validate pose stability for the default one-player path first. This decision does not change or remove the existing two-player capability, but it makes no new stability claim for that mode.
- Keep each validated `PosePacket` as the canonical unmodified MediaPipe result in raw phone-camera coordinates. Do not smooth in the worker, serializer, transport, packet validator, or packet object.
- Derive the complete coarse-hand feature in one shared domain module. Pose controls, Draw, and diagnostics must not maintain different wrist/pinky/index/thumb definitions.
- Do not create a universal "smoothed pose." Name and own every derived temporal signal according to its consumer.

### Signal responsibilities

| Signal | Owner and consumers | Contract |
| --- | --- | --- |
| Validated pose | Phone worker and television packet boundary | Immutable canonical MediaPipe output and capture timestamp |
| Coarse hand | Shared pose-feature derivation | Arithmetic mean of the usable wrist, pinky, index, and thumb; no fallback |
| Continuous Draw point | Draw session | Existing timestamp-aware speed-adaptive smoothing; optimized for responsive paths |
| Stationarity evidence | Draw session | Raw coarse-hand positions evaluated over time; no coordinate filter or delayed cursor |
| Display pose | Avatar presentation session | Immutable consumer-local copy with the bounded one-pose-only filter in ADR-0014; never consumed by interaction |

### Robust 500 ms stationary hold

- Preserve the existing 500 ms engagement/lifting duration and `0.012` frame-normalized stationary radius.
- Preserve immediate tool lifting for unavailable hands, board exit, toolbar entry, stale input, frame changes, and the existing `0.12` implausible-jump bound.
- A stationary candidate owns one anchor and capture-time-based evidence. A point inside the radius continues the candidate.
- A point outside the radius starts an excursion instead of immediately destroying the candidate. Returning inside the candidate region before 100 ms treats that excursion as estimation noise.
- An outside cluster that itself remains within the same radius for 100 ms becomes the new candidate, backdated to the cluster's first sample. Continuous motion restarts that outside cluster as it leaves each candidate region.
- Completion requires the current point to be inside the candidate region and no more than 20% of the candidate's elapsed time to have been spent in tolerated excursions. Thus one short spike cannot prevent a hold, while frequent noise or sustained motion cannot activate one.
- Completion remains latched until a sustained new stationary candidate is established, preserving the deliberate move-before-lift behavior.
- All timing uses monotonic sample timestamps. The classifier must behave consistently across irregular 15–30 Hz-or-lower packet cadence and must never count a stale gap as stationary time.

### Local diagnostics and model decisions

- The phone reports a collapsed, explicitly labeled local **Pose diagnostics** panel while tracking. It aggregates camera callbacks, inference submissions/completions, processing-age median/tail, and a rolling two-second one-player spread for each complete coarse hand and its four constituent landmarks.
- Diagnostics publish at most twice per second, retain only a bounded in-memory window, and never log, persist, transmit, or display coordinates, camera pixels, pairing data, or identifiers.
- Hand spread is explicitly labeled as motion-inclusive. It becomes a jitter measurement only while a person deliberately holds that hand still.
- Keep the vendored Lite model as the sole runtime model until the target-phone protocol in [Pose quality](../engineering/pose-quality.md) produces comparable evidence for Full. A model experiment uses a branch-local hard cutover; the repository must not retain a runtime model selector, parallel landmarkers, or both production model assets.
- Do not change confidence thresholds as a smoothing mechanism. They gate detection, presence, and tracking acceptance rather than tune coordinate stabilization.

## Consequences

### Benefits

- Draw tolerates bounded inference outliers without changing the user's half-second gesture or adding a second coordinate-filter delay to stationarity.
- Continuous drawing retains its low-latency adaptive path instead of inheriting a presentation-oriented filter.
- Diagnostics reveal whether a future change improves noise at the cost of cadence, processing age, or thermals.
- Raw packets, privacy, mirroring, and renderer independence remain unchanged.
- The accepted avatar presentation filter is evaluated independently and cannot silently change game input.

### Costs and risks

- The 100 ms excursion and 20% time-share values are explicit initial classifier parameters and still require real-device acceptance.
- Extremely slow real movement inside the accepted radius is observationally indistinguishable from stillness; no temporal filter can remove that ambiguity.
- The diagnostic hand spread includes deliberate motion unless the person follows the stationary measurement protocol.
- Lite-versus-Full selection remains an external hardware decision; automated tests cannot establish phone accuracy, perceived latency, or thermal behavior.

## Alternatives considered

### Use one application-wide stabilized pose

Rejected because it compounds MediaPipe's one-player smoothing, couples unrelated consumers, can delay hit testing and release, and can make the pointer disagree with the live body.

### Feed Draw's filtered cursor into stationarity

Rejected because its 25–100 ms adaptive time constant can delay settling and can hide slow real motion. Stationarity needs temporal evidence, not a lagging position.

### Increase the stationary radius or shorten dwell

Rejected because the reported problem is noisy measurement, not an accepted interaction change. The existing gesture geometry and duration remain intact.

### Ship Lite and Full with a runtime selector

Rejected because it adds model weight, lifecycle and control protocol without product value, and would retain two canonical inference paths after the experiment.

## Verification

- Unit tests prove that a clean hold completes at exactly 500 ms, isolated excursions are tolerated, frequent or sustained movement is rejected, a stable new region is timed from its first stable sample, stale gaps reset evidence, and completion remains latched until deliberate movement.
- Draw regression tests prove engagement, lifting, path breaking, and responsive path smoothing through the new stationarity owner.
- Diagnostic tests prove bounded windows, exact coarse-hand derivation, rate/age aggregates, motion spread, frame/dropout reset, and one-player-only hand statistics.
- Component tests prove that the phone diagnostics are local, collapsed, accessible, and disclose their motion-inclusive interpretation.
- Real-device acceptance records the protocol defined in [Pose quality](../engineering/pose-quality.md).

## Follow-up

- Record the target-phone Lite and current avatar-presentation baseline before selecting another model or replacing presentation smoothing.
- If Full is evaluated, perform a branch-local model hard cutover, run the same protocol, and accept or reject it through a new decision that leaves only one production model.
