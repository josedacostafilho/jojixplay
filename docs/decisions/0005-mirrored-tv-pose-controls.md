---
status: Active
last_verified: 2026-08-13
scope: Television projection, fullscreen entry, temporary controller claiming, and pose-button interaction
---

# ADR-0005: Mirrored television pose controls

- **Status:** Accepted
- **Date:** 2026-08-13
- **Decision owners:** Project owner
- **Supersedes:** None
- **Superseded by:** None

## Context

The television is viewed like a mirror: the phone normally sits beside the screen and faces the people standing in front of it. A raw camera-space skeleton therefore feels reversed when drawn unchanged. Once paired, the body must also operate television controls without accidental activations, fixed-height targets that a person cannot reach, or persistent person identities that the first identity-independent experiments do not need.

Browser fullscreen entry is privileged and normally requires a trusted remote-control or pointer activation. A WebRTC connection callback and a pose packet are not valid user activations, so fullscreen cannot reliably begin at the instant pairing completes.

## Decision

### Coordinate contract

- Keep every `PosePacket` in raw phone-camera coordinates. Do not mutate transport data and do not swap anatomical left/right landmark indices.
- The television owns one shared contained-and-mirrored projection. It maps `screenX = 1 - cameraX` before applying the contain transform.
- The television skeleton, temporary effects, body cursor, button placement, and button hit testing must use that same projection and camera viewport.
- The phone preview remains in camera coordinates; mirroring is a television presentation and interaction decision only.

### Fullscreen entry

- Before generating credentials or joining a pairing room, the television shows one prominent **Start TV mode** button.
- Its trusted activation requests document fullscreen with hidden navigation where supported, then starts the pairing session whether fullscreen succeeds or is unavailable.
- Fullscreen is best-effort browser chrome removal, not a television capability requirement. The application must not loop, emulate fullscreen, or attempt privileged re-entry from a pose event.

### Temporary controller claim

- No stable player identifier is transmitted, stored, or inferred.
- With one usable pose, holding either wrist above its corresponding elbow for 300 ms claims control with that hand.
- With multiple usable poses, one person must hold both wrists above the shoulders for 500 ms. This deliberate gesture prevents an ordinary raised arm in a crowd from stealing control.
- A claim creates only a short-lived television-local control lease. Subsequent frames match the nearest visible torso so pose-array reordering does not immediately break the lease; this continuity is not player identity.
- The selected wrist directly controls the mirrored cursor. The wrist-above-elbow rule applies only while claiming; after a claim, the wrist may move below the elbow.
- Release the lease when the selected wrist stays below the hips for 600 ms, the controlling pose is lost for one second, the torso remains materially displaced from the frozen layout for 600 ms, the pointer is inactive for 15 seconds, or the viewport changes.

### Adaptive controls and activation

- Show instructions whenever a live skeleton exists but no controller is claimed. Show actionable buttons only for the active control lease.
- Derive the button-row anchor from the controlling torso, never from either arm:

  ```text
  shoulderY = midpoint(leftShoulderY, rightShoulderY)
  hipY = midpoint(leftHipY, rightHipY)
  anchorY = shoulderY + 0.25 × (hipY - shoulderY)
  ```

- Center the row on the shoulder midpoint, clamp it inside the contained camera viewport and television safe margins, and use screen-relative clamped target sizes. Freeze the resulting layout for the lease so reaching does not make targets chase the user.
- Hover alone does not activate. The wrist must dwell inside one target for 900 ms. Show continuous dwell progress, activate once, and require the pointer to leave before that target can activate again.
- Keep the controls as semantic buttons so television remotes, keyboards, and accessibility tools retain an explicit non-pose activation path.

### Prototype actions

The first control row has exactly three television-local actions:

1. **Background** toggles between the fixed dark-navy and dark-plum stage themes.
2. **Skeleton** toggles the complete two-pose palette between teal/rose and amber/violet, preserving per-frame multiperson distinction without implying identity.
3. **Circles** replaces any active burst with 12 bounded outline circles using the current skeleton palette; the circles render behind the skeleton and controls and fade within three seconds.

The layer order is background, circles, mirrored skeleton, buttons with dwell progress, then cursor. These actions do not change the network packet or transport contract.

## Consequences

### Benefits

- Movement and controls behave like a mirror without corrupting anatomical landmark meaning.
- Targets adapt to the visible person, remain stable during a reach, and require deliberate activation.
- Multiperson experiments can remain identity-independent while still preventing competing cursors.
- Fullscreen is requested at the only reliable point: a deliberate television-side activation before pairing.
- The interaction logic remains a television-local consumer of validated pose data and can later feed games without changing inference or transport.

### Costs and risks

- Temporary nearest-torso continuity can still release if people cross or occlude one another; that is preferable to inventing persistent identity for this scope.
- Actual reach comfort, dwell timing, and fullscreen support vary by person, camera placement, and television browser and require real-device acceptance.
- A semantic DOM control overlay and the Canvas renderer must remain aligned through the shared projection contract.

## Alternatives considered

### Continuously require the wrist above the elbow

Rejected because a button near or below torso height would turn the pointer off precisely while the person tries to reach it.

### Activate immediately on overlap

Rejected because arm motion and pose jitter would cause false presses. Dwell supplies intent without requiring a learned hand sign.

### Fixed screen-edge controls

Rejected because camera framing and a person's reach do not necessarily cover television corners. Body-relative placement keeps targets inside the pose-controlled region.

### Persistent skeleton identifiers

Rejected for the identity-independent prototype. They add tracking complexity and failure semantics that the current actions do not consume.

## Verification

- Unit tests prove mirrored contain mapping, claim timing, multiperson claiming, frozen adaptive layout, dwell latching, and release conditions.
- Component tests prove the semantic controls and local effects; end-to-end tests prove the explicit TV-mode activation and pairing flow.
- Code inspection confirms that `PosePacket` is unchanged and all television visuals and hit testing consume the same mirrored projection.
- Real-device acceptance checks fullscreen behavior, reach comfort, false activation, multiperson contention, and mirrored intuition.

## Follow-up

- Record timing or geometry changes from real-device evidence by updating this decision and the canonical product contract in the same hard cutover.
