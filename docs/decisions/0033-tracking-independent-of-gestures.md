---
status: Accepted
last_verified: 2026-09-27
---

# ADR-0033: Tracking independent of gesture recognition

The owner requires hand tracking and visibility to remain independent of downstream gesture recognition. This amends the game-local ownership in ADR-0029 and retains the result availability rules in ADR-0032.

Teias associates wrists and stores detected observations in tracking state with no dependency on gesture code. Rendering receives those observations separately from aim and web controls. Gesture recognition reads the assigned observations; it cannot erase them, change their ownership or reset inference. Missing, stopped or stalled input and epoch changes remain tracking lifecycle events.

Unknown curl, gesture resets, replay and disabled gameplay gesture handling do not hide detected hands. Opening after reacquisition remains a firing requirement only. Help disables game actions while observation updates and hand rendering continue.

Regression checks cover disabled gesture handling, gesture resets, unknown curl on reacquisition, replay and visible crosshairs during help. These establish separation of downstream state; they do not establish that MediaPipe reacquires real hands reliably.
