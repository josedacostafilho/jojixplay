---
status: Accepted
last_verified: 2026-09-27
---

# ADR-0030: Index aim and first-person hands

- **Status:** Accepted
- **Date:** 2026-09-27
- **Decision owners:** Product owner
- **Amends:** The aiming and hand-presentation choices in ADR-0029; tracking ownership and firing rules remain in force

The owner rejected amplified neutral-relative aim, camera-facing hand depth and disappearing hands at screen edges. Open-hand crosshairs now share the rendered index fingertip's mirrored image projection. Either hand can reach either screen half. Stable open hands start play without calibrating an aim offset. Curl onset still freezes the shot, and opening still releases.

The game reverses local depth to show the hands from the player's side. It fits each hand silhouette inside the viewport at edges instead of coupling visibility to aim position. The host retains detected hands whose image points extend beyond the camera edges; the receiving boundary accepts only finite hand image coordinates in the bounded interval −1 to 2. This does not fabricate landmarks or preserve stale detection. Missing observations still expire and release webs.

Tests cover direct index alignment, shared edge projection, reversed depth and real worker-to-validator handling of out-of-image fingertips at every source rotation. Live-camera accuracy, comfort and sustained phone performance remain device acceptance work.
