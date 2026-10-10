---
status: Accepted
date: 2026-10-09
---

# The adult chooses the camera by looking, and the phone remembers it

## Context

The app opened the phone's front camera. In the owner's small living room it cannot fit a whole body. Phones have wider cameras: on the owner's Galaxy S22, Chrome 154 offers four (two facing front, two facing back), every one with a zoom range that starts at 1, so nothing can be widened by zooming out. The owner compared a still from each: of the two back cameras "camera 2" sees more than "camera 0" (it is the ultrawide), and of the two front cameras "camera 1" sees more than "camera 3".

Nothing the browser reports says how wide a camera sees. Android names them only "camera N, facing back". A rule for picking the widest would be a guess per phone model.

The project's rules said that nothing is persisted. That sentence merged two things: a privacy promise (camera pictures, coordinates and anything about a person are never saved, sent or logged) and an early description of scope (no backend, accounts or storage were needed). Only the first has a reason.

## Decision

- **One more touch step.** After **Ligar a câmera**, the camera's picture fills the screen with one button for every camera the phone offers and **Começar**. The adult tries cameras, keeps the one that shows the whole body in that room, and presses **Começar**; only then does the movement-operated menu appear. The step is shown every session, since it is also where the adult sees that the phone is aimed well.
- **No rule guesses the wide camera.** Cameras are listed as the browser orders them and named by side and count: **Frente 1**, **Frente 2**, **Trás 1**, **Trás 2**; **Câmera N** when the browser does not say a side.
- **The choice is remembered** on the phone, by the browser's name for the camera, and opened first next time when the browser will already tell names (it does where camera access was granted before). An unknown or unopenable remembered camera falls back to the front camera.
- **What may be saved is narrowed, not widened.** Camera pixels, coordinates, anything sensed and anything about a person are never saved, transmitted or logged. A device setting that says nothing about the picture or the people in it may be saved on the phone. The camera's name is the only one.
- **Switching** stops the camera in use before opening the next, because a phone opens one at a time. If the next will not open, the previous one returns and the step says so; if neither opens, the session ends. A switch starts a new frame epoch.
- **A back camera changes nothing downstream.** The phone then stands with its back to the room and its screen to the wall; the game is watched on the television. Images stay unmirrored in the pipeline and mirrored on screen, so the television still behaves as a mirror.

## Consequences

Each session takes one more tap. Untried on a phone with a back camera in play: tracking with the ultrawide's stretched edges and smaller figures, its noise and frame rate in dim rooms, whether a step near the edge of its view reads as a bigger step than one in the middle, and whether its sensor's mounting needs a rotation the pipeline has not yet met on this phone (the world landmarks' turn in [ADR-0036](0036-body-in-its-own-space.md) is only unit-tested). A phone that exposes a telephoto camera will list it too; the adult will see that it is the wrong one.
