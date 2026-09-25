---
status: Active
last_verified: 2026-09-24
---

# Tracking quality and acceptance

## Diagnosed issues and replacement

A regression probe against the retired renderer demonstrated that making one hip invisible erased all visible anatomy. New adapter regression coverage proves shoulders and wrists remain available with both hips and all legs absent. This proves application behavior, not model detection quality.

The previous Lite landmarker did not select GPU acceleration. The canonical runtime now uses the self-hosted Full float16 bundle with `delegate: "GPU"`, camera-paced single-flight inference and no fallback. Full was selected as an accuracy-oriented candidate compatible with two-person inference and the existing normalized landmarks. Heavy has a greater compute burden without a measured target-phone benefit. MoveNet Thunder is single-person; MultiPose uses Lightning. A larger model alone cannot guarantee better latency or cropped-body detection.

Sources: [Google pose model family](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker), [official browser examples and model bundles](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/tasks/pose-landmarker.ts), [MoveNet variants](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/movenet/README.md).

The first inference shares the 30-second startup allowance because GPU kernels may compile on the first frame; after the first validated result, a five-second watchdog bounds each estimate. Neither allowance changes the 250 ms freshness limit for gameplay.

Freshness is measured from capture, not arrival. The SDK rejects observations older than 250 ms. The parent panel displays elapsed capture age and current observation count locally; no coordinates are logged or stored. Menu circles use the same bounded index estimate for display and hit testing, with no extra presentation smoothing or amplified reach. This approximates a fingertip, not articulated finger tracking. Fullscreen camera rotation, mirroring and cover cropping share one coordinate mapping.

## Exploratory image check (2026-09-24)

A separate Chromium worker ran the actual Full GPU model on Google's [public pose test photo](https://storage.googleapis.com/mediapipe-assets/pose.jpg), then on top-aligned crops retaining 85%, 70% and 55% of its height. All four inputs detected one pose and kept both shoulders, elbows and wrists in bounds with reported visibility at least 0.99. This single adult still image is a limited feasibility check, not child, motion, occlusion or phone validation. No fixture was committed, and no user camera data was captured.

## Required phone acceptance (Unknown)

The primary target is the owner’s Samsung Galaxy S22, assuming Chrome. Current iPhones/Safari are also in scope; no iPhone model or minimum iOS version is selected yet. Test both families on real hardware before calling the model accepted. Browser software-GPU integration tests only verify initialization and output plumbing.

For each device and one/two-person setting, compare stationary-hand jitter, a fast wave, wrists at screen edges, unequal adult/child heights, feet cropped, half-legs cropped, waist-up, one arm hidden and reacquisition. Check both landscape directions, ordinary household lighting, 10 minutes of continuous tracking, heat and external mirroring latency. Record only aggregate timing/error results, never camera pixels or coordinates without explicit consent.

Acceptance targets: visible upper-body joints survive lower-body loss when detected; unavailable joints disappear within 250 ms; no motion bridges across reacquisition; responsive waving with fresh observations during sustained use. Full GPU performance and detection recall remain Unknown until measured. If these targets fail, replace the chosen path in a new hard cutover rather than introducing model selection or fallback bloat.

## iPhone constraints

The chosen worker GPU path requires OffscreenCanvas WebGL, introduced in [Safari/iOS 17](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/). This is a prerequisite, not a declaration that every iOS 17 device is supported. Start acceptance on current iOS/Safari; select a minimum version only after hardware validation. Fullscreen, native orientation locking and wake lock remain optional browser-controlled enhancements. The landscape gate works independently and always stops a portrait session. Do not promise that a website can force an iPhone to remain physically locked in landscape. Check GPU memory, model startup, camera interruptions and sustained heat alongside frame timing.

## Corrida acceptance (Unknown)

On the Galaxy S22 and selected iPhone, test a full five-minute run with children and adults at different distances. Verify held-crouch cancellation, standing-up versus jumping, small jumps, loose arm poses, partial occlusions and reacquisition without a lost life. Check the wall preview in both landscape orientations and confirm its left/right alignment. Measure whether 650 ms jump tolerance and 38-degree arm tolerance feel fair; tune the game-local constants from observed results. Check voluntary jumps and crouches between obstacles for a steady horizon and comfortable easing, including reduced motion and TV mirroring. Repeated runs must check concurrent GPU inference/rendering frame rate and heat. No real-device results are claimed by synthetic tests.
