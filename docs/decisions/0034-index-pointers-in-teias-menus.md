---
status: Accepted
last_verified: 2026-09-27
---

# ADR-0034: Index pointers in Teias menus

The owner rejects menu circles that jump away from the tracked hands. Teias preparation, help, replay and exit pointers use the mirrored index fingertip, with the same whole-hand edge projection as the game hands and crosshairs. Amplified wrist coordinates are removed from both game-owned and host-owned hand menu controls. This amends the dedicated-hand navigation in ADR-0029; body-based games retain their existing controls.

The SDK owns the shared normalized image projection, without rendering or gesture state. The game retains player-facing 3D depth. Display and button hit testing use the same pointer coordinates. Camera-backed menus use the actual mirrored index and cover rectangle when dedicated hand observations are present. Active Teias runs still show no menu cursors or buttons.

Browser regression coverage compares help pointer positions with the displayed crosshairs, including the edge projection, and operates game help and host exit by movement at both phone viewports. Existing hand projection tests retain direct fingertip and edge geometry coverage. Real camera accuracy remains separate.
