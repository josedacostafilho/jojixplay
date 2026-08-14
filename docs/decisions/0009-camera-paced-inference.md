---
status: Active
last_verified: 2026-08-14
scope: Phone camera cadence, pose-inference scheduling, backpressure, and performance claims
---

# ADR-0009: Camera-paced serial pose inference

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project owner
- **Supersedes:** The fixed 15 Hz inference ceiling introduced with the initial skeleton-viewer prototype
- **Superseded by:** None

## Context

The first prototype requested a camera stream with an ideal and maximum rate of 30 frames per second, but then independently rejected otherwise eligible frames until 66.7 ms had passed. That fixed 15 Hz ceiling was selected conservatively before target-device measurement. It halves motion samples on capable phones and is especially unsuitable for continuous drawing.

The pipeline already owns the safety properties that a second low ceiling attempted to approximate: only one inference can be active, a camera frame is ignored while inference or player-limit reconfiguration is active, and transport retains only the newest pending pose packet. Removing the 15 Hz timer cannot create an inference or network backlog.

## Decision

- Request the user-facing camera at `1280 × 720` ideal resolution and `30 FPS` ideal/maximum cadence.
- Do not impose an independent elapsed-time sampling gate below the camera cadence. When the camera presents a frame, submit it if tracking is active, current video data exists, player-limit reconfiguration is idle, and no inference is owned.
- Allow exactly one `createImageBitmap`/worker/MediaPipe estimate pipeline at a time. Frames presented while it is occupied are discarded before bitmap creation.
- Keep MediaPipe inference worker-owned and serialized. Do not queue source frames or run parallel landmarkers.
- Keep latest-only WebRTC backpressure: at most one send is active and one newer packet may replace the pending packet.
- Describe 30 pose updates per second as a ceiling, never a guaranteed rate. Actual cadence is bounded by camera delivery, bitmap capture, serialized inference, browser scheduling, device thermals, and transport delivery.
- Do not add an automatic reduced-rate fallback. If target hardware cannot sustain acceptable behavior, measure the actual bottleneck and replace the relevant policy explicitly.

## Cadence vocabulary and bottleneck model

These rates are different and must not be reported interchangeably:

| Rate | Meaning | Upper bound or loss point |
| --- | --- | --- |
| Camera delivery | Frames the browser presents through `requestVideoFrameCallback` | Requested at 30 FPS maximum; the camera, browser, visibility, and power policy may deliver fewer |
| Inference submission | Presented frames accepted while tracking is active and the inference slot is free | Never exceeds camera delivery; callbacks arriving while inference/reconfiguration owns the slot are dropped |
| Inference completion | Valid pose estimates returned by the worker | Never exceeds submission; bitmap creation, worker transfer, MediaPipe runtime, device load, and thermals add time |
| Pose send | Completed packets offered to the peer sender while connected | Never exceeds completion; the sender keeps the active send plus only the newest pending packet |
| TV acceptance | Strictly valid, increasing, fresh packets accepted by the television | Never exceeds send; transport delay, disconnects, validation, ordering, and freshness can reject packets |
| TV drawing update | Accepted packets consumed by pose controls, avatar presentation, and games | Packet-driven and therefore never a promise of display-refresh-rate input |

The practical inference ceiling is approximately the lower of camera delivery cadence and the reciprocal of end-to-end serialized processing time. For example, a sustained 50 ms estimate path can accept at most roughly 20 camera frames per second even when the camera presents 30. This is natural backpressure, not a configured 20 FPS mode.

No current rate is actually measured by application telemetry. The former 15 Hz value was hardcoded; 30 FPS is now a requested camera ceiling; any achieved rate remains unknown until measured on a named device and browser.

## Measurement contract

Performance acceptance must distinguish one-player and two-player modes and record:

1. Device, operating system, browser/version, camera resolution, and whether the page remained foregrounded.
2. Warm-up duration and the sustained observation window.
3. Camera callbacks, inference submissions, inference completions, accepted TV packets, and elapsed time for each window.
4. Median and tail end-to-end pose age where available, rather than FPS alone.
5. Temperature or visible thermal throttling, battery impact, and frame-rate change over time.
6. Drawing responsiveness and visible path gaps under the same run.

A result without this context is anecdotal and must not be turned into a new fixed cadence. Instrumentation added for measurement must avoid pose coordinates, pairing keys, camera pixels, and persistent telemetry unless separately authorized.

## Consequences

### Benefits

- Capable phones can provide twice the former temporal resolution and lower worst-case sampling delay.
- Slower phones degrade naturally to the next camera frame available after inference completes without accumulating stale work.
- The scheduler has one source cadence, one single-flight guard, and no redundant timer whose jitter could accidentally skip additional frames.
- Continuous games receive the freshest feasible pose stream within the existing 30 FPS camera budget.

### Costs and risks

- Capable phones may perform up to twice as many inferences, increasing power use and heat.
- Sustained inference can thermally throttle, particularly in two-player mode.
- Actual rate and end-to-end latency remain hardware-dependent until measured on the owner's devices.
- Higher packet cadence increases browser and transport work, although strict single-flight/latest-only bounds remain.

## Alternatives considered

### Retain 15 Hz

Rejected because it is not measurement-backed and unnecessarily degrades temporal input on hardware that can sustain more work.

### Add a second explicit 30 Hz timer

Rejected because the camera is already constrained to at most 30 FPS. Comparing callback timestamps to another 33.3 ms interval is redundant and can skip valid frames when callback timing arrives fractionally early.

### Remove every camera frame-rate constraint

Rejected because some cameras can supply 60 FPS or more, which would increase inference load without a current product requirement. Thirty FPS is the accepted motion-interaction ceiling for this slice.

### Queue the latest camera frame during inference

Rejected for now because creating and retaining a bitmap while inference is occupied increases continuous load and ownership complexity. The next presented frame after completion is newer and sufficient.

## Verification

- Unit tests prove that consecutive eligible camera callbacks are submitted without a 15 Hz time gate and that callbacks are discarded while inference is active.
- Existing worker and sender tests prove one pending estimate and latest-only transport behavior.
- Production-browser coverage proves the 30 FPS camera constraint and first inference still initialize through real MediaPipe assets.
- Real-device acceptance must record achieved one-/two-player inference cadence, end-to-end pose freshness, sustained temperature behavior, and any throttling.
