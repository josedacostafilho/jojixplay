---
status: Accepted
date: 2026-10-09
---

# Each sensed body is also reported in its own space

Extends [ADR-0031](0031-host-sensing-service.md). Sensing stays a host service and games still interpret.

## Context

The pose model returns every joint twice in the same pass: as a place in the camera image, and as metres from the midpoint of the person's hips (MediaPipe's "world landmarks"). Only the first was read. Image joints say where a person is and are what menus, painting, lanes, crouching and jumping need; they flatten posture, so an arm pointed at the camera merely looks short. World joints say how the body is held, in three dimensions and independent of size and distance, and say nothing about where it is: stepping aside, jumping or walking closer changes none of them. The owner wants both available, for Corrida's arms and for games not yet chosen, and to judge the steadiness of the depth axis on a phone before any game relies on it.

## Decision

- **The worker reports both.** Every pose in a packet carries its 33 world landmarks beside its 33 image landmarks, turned upright the same way. The receiving boundary rejects a pose without exactly 33 finite ones.
- **The SDK adds a frame part, not a field on a joint.** `WorldFrame.worldBodies` holds the same people as `bodies`, in the same order, as `WorldBody` maps of `WorldJoint`. `Frame` includes it. A game typed on `BodyFrame` is untouched; a game that wants posture types its input to include `WorldFrame`.
- **Raw axes.** Metres; x towards the unmirrored camera image's right, y downwards, z away from the camera; origin at the hips' midpoint. Unsmoothed, like every other observation.
- **Nothing is reported that the picture does not show.** A world joint is present exactly when its image joint is: sure enough and inside the picture. The model predicts hidden and out-of-view joints in world space, and those predictions are not passed on.
- **No new sensing kind.** It is the same model in the same pass at no measurable cost, present whenever bodies are sensed, including with a silhouette.
- **The bench shows it** as **Corpo 3D**: the body from the front, from the side and from above on one scale, with how far each wrist is in front of the hips in centimetres.

## Consequences

Corrida was the first game to read world joints, for its arms and punches ([ADR-0038](0038-corrida-first-person-depth-and-punch.md)). Depth is the model's estimate from one camera and is expected to be the least steady axis; nothing has been measured on a phone. The upright turn of world landmarks assumes MediaPipe reports them on the axes of the image it was given, as it does image landmarks; a phone whose camera needs no turning in landscape does not exercise that, and it is covered only by a unit test of the arithmetic.
