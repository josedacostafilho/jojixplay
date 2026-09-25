---
status: Accepted
last_verified: 2026-09-24
---

# Brazilian Portuguese and Desenhar

The touch-only confirmation clause below is superseded by [ADR-0024](0024-movement-navigation.md); all post-setup controls support movement.

The owner chose Brazilian Portuguese for all product UI, while engineering documentation and conversation remain English. Use direct pt-BR copy; no locale switch or translation framework exists.

Desenhar is the first new game, authorized for a simple professional implementation. It owns an isolated `games/desenhar` workspace. The host lazy-loads its public mount function and supplies only the existing SDK observations and lifecycle. It applies the selected one- or two-person inference limit before entry. The game has an independent synthetic development page, build and tests.

One or two people share the same drawing. Two-person input belongs to current left/right shoulder zones, never detector array order; a central gap releases control before crossing. One selected wrist per person moves a mirrored brush; raising the other wrist above its shoulder paints, lowering it pauses. Left/right brush preference is selectable. No hips or legs are needed. Independent missing, stale or implausible input breaks strokes. Six colors, two widths, undo and confirmed clear are available through touch or fresh wrist dwell. All controls use the same DOM rectangles for visual placement and hit testing. No scoring, persistence, download, extra game engine or body identity is introduced.

Three.js renders shaded paint segments with bounded instancing. Art lives only in the mounted session. Exit, stop or rotation discards it; the host clearly warns before leaving. A grown-up confirms destructive clear/exit actions by touch. CPU-only session tests cover continuity, freshness, gesture hysteresis, undo and bounded storage. No universal pose smoothing or archived game implementation is restored.
