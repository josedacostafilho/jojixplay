---
status: Accepted
last_verified: 2026-09-24
---

# Simple circle menu pointers

The owner rejected the rendered hands. Replace them with the existing shared DOM dwell cursor, drawn as a small circle. Delete the hand renderer, GLB, asset notices/checksum and dedicated asset lab. Three.js remains game-owned.

Outside games, estimate the index point from the fresh wrist toward the coarse index observation (1.1 times that vector), otherwise extend the elbow-to-wrist vector by 22%, otherwise aim 3.5% of frame height above the wrist. Bound displacement to 8% of frame height, accounting for aspect ratio, and clamp to the canonical frame. This is a rough hand-sized estimate, not articulated finger tracking or amplified reach. The circle and hit test use exactly the same camera-cover projection. No torso or legs are required. Missing/stale wrists remove pointers.

Games retain their own input mapping. Shared game button cursors also use circles; Desenhar painting remains wrist-driven. Fullscreen camera, dwell, neutral rearming and modal behavior remain unchanged.
