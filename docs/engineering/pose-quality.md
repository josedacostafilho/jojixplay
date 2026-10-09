---
status: Active
last_verified: 2026-10-09
---

# Tracking quality and acceptance

## Diagnosed issues and replacement

A regression probe against the retired renderer demonstrated that making one hip invisible erased all visible anatomy. New adapter regression coverage proves shoulders and wrists remain available with both hips and all legs absent. This proves application behavior, not model detection quality.

The previous Lite landmarker did not select GPU acceleration. The canonical runtime now uses the self-hosted Full float16 bundle with `delegate: "GPU"`, camera-paced single-flight inference and no fallback. Full was selected as an accuracy-oriented candidate compatible with two-person inference and the existing normalized landmarks. Heavy has a greater compute burden without a measured target-phone benefit. MoveNet Thunder is single-person; MultiPose uses Lightning. A larger model alone cannot guarantee better latency or cropped-body detection.

Sources: [Google pose model family](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker), [official browser examples and model bundles](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/tasks/pose-landmarker.ts), [MoveNet variants](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/movenet/README.md).

The first inference shares the 30-second startup allowance because GPU kernels may compile on the first frame; after the first validated result, a five-second watchdog bounds each estimate. Neither allowance changes the 250 ms freshness limit for gameplay.

Freshness is measured from capture, not arrival. The SDK rejects observations older than 250 ms. The menu shows a one-line capture-age and observation-count readout locally; no coordinates are logged or stored. Menu circles use the same bounded index estimate for display and hit testing, with no extra presentation smoothing or amplified reach. This approximates a fingertip, not articulated finger tracking. Fullscreen camera rotation, mirroring and cover cropping share one coordinate mapping.

## Exploratory image check (2026-09-24)

A separate Chromium worker ran the actual Full GPU model on Google's [public pose test photo](https://storage.googleapis.com/mediapipe-assets/pose.jpg), then on top-aligned crops retaining 85%, 70% and 55% of its height. All four inputs detected one pose and kept both shoulders, elbows and wrists in bounds with reported visibility at least 0.99. This single adult still image is a limited feasibility check, not child, motion, occlusion or phone validation. No fixture was committed, and no user camera data was captured.

## Required phone acceptance (Unknown)

The primary target is the owner’s Samsung Galaxy S22, assuming Chrome. Current iPhones/Safari are also in scope; no iPhone model or minimum iOS version is selected yet. Test both families on real hardware before calling the model accepted. Browser software-GPU integration tests only verify initialization and output plumbing.

For each device and one/two-person setting, compare stationary-hand jitter, a fast wave, wrists at screen edges, unequal adult/child heights, feet cropped, half-legs cropped, waist-up, one arm hidden and reacquisition. Check both landscape directions, ordinary household lighting, 10 minutes of continuous tracking, heat and external mirroring latency. Record only aggregate timing/error results, never camera pixels or coordinates without explicit consent.

Acceptance targets: visible upper-body joints survive lower-body loss when detected; unavailable joints disappear within 250 ms; no motion bridges across reacquisition; responsive waving with fresh observations during sustained use. Full GPU performance and detection recall remain Unknown until measured. If these targets fail, replace the chosen path in a new hard cutover rather than introducing model selection or fallback bloat.

## Hand sensing acceptance (Unknown)

The Hand Landmarker (float16 revision 1, two hands, GPU) runs instead of the pose model while a game asks for hands. Nothing about it has been measured on a phone. Use the **Sensores** bench on the Galaxy S22 to find out: the distance at which a child's and an adult's hands are still found, since the model expects a hand that fills a fair share of the image and players normally stand across the room; whether **Esquerda** and **Direita** match the person's own hands on a live camera (see the photo check below); the reading rate and delay shown on the bench against the pose model's; the pause when switching kinds; and heat over ten minutes. Browser tests only prove that the real model loads and that its output is carried correctly.

Exploratory photo check (2026-10-09): Google's public [two-hands test photo](https://storage.googleapis.com/mediapipe-assets/woman_hands.jpg), letterboxed to 1280×720 and played as Chromium's fake camera through the production build, was found as two hands with all 42 points on the fingers of the mirrored image. The model's own labels named her right and left hands correctly on the unmirrored frame, matching the labels Google's `left_hands.jpg` and `right_hands.jpg` fixtures expect, so the adapter passes them through unchanged. Older MediaPipe documentation says to swap them; doing so mislabelled this photo. One adult still image at close range is a feasibility check, not distance, child, motion or phone validation. No fixture was committed.

## Silhouette acceptance (partly measured)

The silhouette is the pose model's own mask on the GPU, shown in the **Sensores** bench under **Silhueta**. Owner's Galaxy S22, 2026-10-09: 60 to 70 ms from capture to arrival; a CPU variant tried beside it took about 100 ms and was removed. Laptop with a discrete GPU, one stock photo in Chromium: 18 ms. Still to judge on the phone at playing distance: outline quality on a whole child and a whole adult with arms out and legs apart, holes and background picked up, how far the outline trails a fast arm, and heat over ten minutes. Comparing the bench's delay in **Corpo** with **Silhueta** shows what the mask adds. Two other models were tried the same day and dropped: the selfie segmenter for quality, RF-DETR Seg Nano for taking about 500 ms a reading on the phone and drawing nothing.

## iPhone constraints

The chosen worker GPU path requires OffscreenCanvas WebGL, introduced in [Safari/iOS 17](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/). This is a prerequisite, not a declaration that every iOS 17 device is supported. Start acceptance on current iOS/Safari; select a minimum version only after hardware validation. Fullscreen, native orientation locking and wake lock remain optional browser-controlled enhancements. The landscape gate works independently and always stops a portrait session. Do not promise that a website can force an iPhone to remain physically locked in landscape. Check GPU memory, model startup, camera interruptions and sustained heat alongside frame timing.

## Corrida acceptance (Unknown)

On the Galaxy S22 and selected iPhone, test a full five-minute run with children and adults at different distances. Verify held-crouch cancellation, standing-up versus jumping, small jumps, loose arm poses, partial occlusions and reacquisition without a lost life. Check the wall preview in both landscape orientations and confirm its left/right alignment. Measure whether symbolic dip-and-rise jumps, the two-second early/one-second late jump window and 38-degree arm tolerance feel fair; tune the game-local constants from observed results. Confirm ducking starts in level one and jumping is introduced only in level three. Verify jump preparation never ducks the camera, unrelated gestures leave the viewpoint upright, and the 1.8-second jump arc feels comfortable. Check large text and every control using the visible hand circles from the actual TV viewing position, including reduced motion and TV mirroring. Repeated runs must check concurrent GPU inference/rendering frame rate and heat. No real-device results are claimed by synthetic tests.
