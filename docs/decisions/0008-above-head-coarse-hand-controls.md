---
status: Active
last_verified: 2026-08-14
scope: Television control placement, coarse-hand pointing, framing eligibility, and post-claim arming
---

# ADR-0008: Above-head coarse-hand controls

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project owner
- **Supersedes:** The torso-relative target row, direct wrist pointer, and immediately armed lease portions of [ADR-0005](0005-mirrored-tv-pose-controls.md)
- **Superseded by:** [ADR-0015](0015-canonical-camera-orientation.md) for landscape Main Menu/Games placement; portrait retains the above-head row

## Context

The original adaptive row was centered one-quarter of the way from the controlling shoulders to the hips. It was physically convenient but covered the skeleton's torso, making both the drawing and the controls harder to understand. The selected wrist also drove the cursor even though MediaPipe Pose already supplies a coarse four-point hand. This made interaction look and feel as though the forearm, rather than the hand, pressed a target.

Moving controls above the head introduces two correctness requirements. The row must remain inside the projected camera area because a pose pointer cannot reach outside that area, and the raised-hand claim must not allow a newly created target underneath the hand to start dwelling immediately.

## Decision

### Above-head layout and framing gate

- The controlling pose must have the existing usable torso landmarks and at least one usable MediaPipe face landmark from indices 0 through 10.
- The highest projected usable face landmark defines the top of the visibly drawn head. Center the row horizontally on the projected shoulder midpoint and place the row's bottom a small screen-relative gap above that head point.
- Preserve the existing bounded target sizing, horizontal safe-area clamping, and frozen-per-lease layout. Do not let head or hand motion move the row after the lease begins.
- The complete row, gap, and safe margin must fit above the head inside the projected camera viewport. If they do not fit, enter an explicit **needs headroom** state, show a framing instruction, and do not begin a control claim or show buttons.
- Do not move an unfit row over the torso, into letterboxing, or to another edge. There is one canonical placement rule and no fallback layout.

### Coarse-hand pointer

- Wrist landmarks continue to govern the one-/two-hand claim gesture and the wrist-below-hips release gesture because those are arm-state decisions.
- Cursor projection, hit testing, dwell, and pointer-activity measurement use one coarse hand center: the arithmetic mean of the selected side's wrist, pinky, index, and thumb landmarks (`15/17/19/21` on the left or `16/18/20/22` on the right).
- All four selected-hand landmarks must meet the canonical visibility threshold. If any becomes unusable, hide the cursor and reset hover/dwell immediately. Do not jump to the wrist or another derived point. A sustained loss releases the lease through the existing one-second loss bound.
- Do not add MediaPipe Hand Landmarker for this interaction. Detailed finger models become justified only when an accepted game requires finger gestures or precision that the pose hand cannot supply.

### Neutral post-claim arming

- A new lease starts unarmed while its buttons and coarse-hand cursor are visible.
- Body activation becomes armed only after a subsequent pose update places the coarse hand outside every target plus the existing hover-hysteresis margin. This guarantees a neutral leave-then-reach sequence even when the claim gesture ends over a newly spawned target.
- Once armed, the existing 900 ms dwell and leave-before-reactivation rules apply. The neutral gate does not disable semantic remote, keyboard, or accessibility activation.
- User instructions distinguish insufficient headroom, an incomplete hand cluster, the neutral arming step, and normal dwell interaction.

## Consequences

### Benefits

- Controls no longer obscure the controlling avatar's torso or face.
- The cursor aligns with the hand shape already drawn by the renderer while averaging coarse distal-landmark noise.
- Framing and neutral-state failures are explicit instead of producing unreachable or accidentally activated controls.
- Claim/release behavior keeps the more stable wrist semantics without conflating them with the pointing location.

### Costs and risks

- People need visible space above the head and must reach higher, which may increase fatigue; these prototype controls should remain occasional rather than continuous gameplay input.
- Requiring all four coarse-hand landmarks may pause or release control more often on distant or poorly lit bodies.
- The pose hand is still not a detailed palm or fingertip model, so real-device acceptance must determine whether its stability is sufficient.
- Another nearby person's body can still visually cross a controller-relative row in multiperson scenes; no persistent identity or alternate layout is introduced to prevent that.

## Alternatives considered

### Index landmark as the pointer

Rejected for the current large dwell targets because a single distal point is less stable at full-body distance and falsely implies fingertip precision that Pose Landmarker does not provide.

### Add MediaPipe Hand Landmarker

Rejected because it adds another model and inference lifecycle without a current requirement for finger gestures.

### Clamp an unfit row to the top of the camera area

Rejected because the row could overlap the head and silently violate the design goal. The user must correct framing instead.

## Verification

- Unit tests prove above-head geometry, insufficient-headroom rejection, frozen targets, coarse-hand projection, no wrist fallback, neutral arming, dwell latching, and wrist-based release.
- Component tests prove the explicit headroom and arming instructions while retaining semantic buttons.
- Code inspection confirms that the old torso anchor and direct wrist cursor no longer exist.
- Real-device acceptance records framing comfort, hand-cluster stability, reach fatigue, and false activations.

## Follow-up

- Replace the coarse pose hand with a detailed hand model only when an accepted game supplies concrete gesture and performance requirements.
