---
status: Accepted
date: 2026-10-09
---

# Silhouettes from the pose model; games may draw the camera picture

Extends [ADR-0031](0031-host-sensing-service.md). Sensing stays a host service and games still interpret. This adds a third thing to sense and gives games camera pixels.

## Context

The owner wants the outline of everyone in view, in real time: laid over the camera image, or used to show only the person on another background. They ruled out delaying the picture to match the silhouette: the picture is the player's mirror and must stay live.

Three models were tried side by side in the bench on 2026-10-09: the pose model's own mask, MediaPipe Selfie Segmenter, and RF-DETR Seg Nano on ONNX Runtime Web with WebGPU. On the owner's Galaxy S22 the selfie model's quality was unacceptable and RF-DETR took about half a second per reading and drew nothing; on a laptop the pose mask and RF-DETR looked alike in a brief comparison. The pose mask was kept and the other two, with the second runtime, were removed.

## Decision

- A **silhouette** is one grid of person confidence, 0 to 255, laid over the whole unmirrored camera image, coarser than the image (at most 320 columns). Everyone in view is one shape; separating players is deferred. It travels in the frame like joints and hand points, and its buffer is transferred from the worker, not copied.
- The silhouette is the **pose model's own mask**, so the same reading also carries joints.
- The pose model computes that mask correctly on the GPU, as an 8-bit texture with the mask in red, but MediaPipe's own conversion of the texture to an array returns zeros (every release from 0.10.3 to 1.1.0, in a bare page as well as in our worker). On the GPU the worker therefore reads the texture itself: it shrinks each mask on the GPU and reads back only the small result, restoring the bindings MediaPipe relies on.
- Silhouettes run on the **GPU only**, as the one sensing kind `silhouette`. A CPU variant was tried beside it: on the owner's S22 the GPU took 60 to 70 ms from capture to arrival and the CPU about 100 ms (an earlier 30 ms CPU reading was a misreading); on a laptop with a discrete GPU, 18 ms against 42 ms. The CPU variant was removed.
- The picture is never delayed. A game shows the live camera and the most recent silhouette, which is one inference behind; on fast movement the outline trails the body.
- **Games may draw the camera picture.** `GameHost.camera()` hands a game the live video element and the rotation that makes it upright. A game may draw it and must not record it, keep copies or send it anywhere. Pixels still never leave the phone.
- With no fingertip to point with, the bench lets a silhouette press a button by covering a quarter of it. That is the bench's own interpretation, not an SDK feature.

## Consequences

Silhouettes cost no second model or runtime. Their quality is the pose model's: a coarse mask that can miss parts of a body in unusual framing. Mask orientation on a camera that delivers rotated pixels is assumed, not verified. Silhouette sensing is slower than body sensing by whatever the mask costs to compute and read back; that share has not been measured.
