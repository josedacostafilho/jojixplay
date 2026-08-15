---
status: Active
last_verified: 2026-08-14
scope: Portrait/landscape user experience, canonical camera coordinates, and game orientation behavior
---

# Camera orientation and game layouts

## Outcome

JojixPlay accepts a phone held in portrait or landscape while presenting every pose in one upright camera coordinate system. Games explicitly state which layouts they support, the shell guides incompatible game entry, and an active game never silently changes coordinate basis.

The governing rationale is [ADR-0015](../decisions/0015-canonical-camera-orientation.md). This document owns the current user-visible and runtime contract.

## Coordinate contract

```text
actual phone camera frame
        ↓ phone-local quarter-turn normalization
upright MediaPipe input
        ↓ canonical raw PosePacket
x right, y down, portrait or landscape, explicit epoch
        ↓ aspect-preserving television projection
horizontal presentation mirror: x → 1 - x
```

- Rotation precedes pose consumption. Mirroring follows canonical projection.
- Anatomical landmark indices are never swapped.
- `PosePacket.frame.layout` is `portrait` or `landscape`; its dimensions must agree with the layout.
- `PosePacket.frame.epoch` changes whenever the phone commits a different camera basis.
- Source rotation, screen angle, and source dimensions remain phone-local diagnostics.
- Camera aspect ratio is preserved as delivered. Aspect ratio is not treated as evidence of field of view, and no `4:3` preference exists.

## Phone behavior

- Camera startup reads a validated Screen Orientation type and quarter-turn angle. When the source bitmap already has the screen's layout, it is treated as browser-oriented and is not rotated again; only a source/screen layout mismatch applies the corresponding `90°` or `270°` correction.
- Tracking may begin in either layout. The camera stage follows the canonical frame aspect and identifies the active layout.
- A changed source basis must remain stable for `400 ms` before it is committed. Frames are not inferred or published while rotation is unsettled. Temporarily inconsistent source/screen metadata is dropped for at most `1,500 ms`; a continuously invalid state then stops tracking with actionable guidance.
- Before publishing a changed basis, the phone reconfigures MediaPipe with the current pose limit to reset its internal video-tracking history. Camera capture, pairing, and the acknowledged player limit remain active.
- A television game-layout request is absolute. If the requested layout is not active, the phone displays **Rotate phone to portrait** or **Rotate phone to landscape** and acknowledges only after that layout is committed.
- Tracking, pairing, and the acknowledged player limit survive a layout change.
- Invalid orientation metadata or an inconsistent/square canonical frame stops tracking with an actionable message.

## Game policies

| View or mode | Supported camera layouts | Control placement |
| --- | --- | --- |
| Main Menu | Portrait and landscape | Portrait above-head row; landscape compact left column |
| Games | Portrait and landscape | Portrait above-head row; landscape compact left column |
| Draw | Portrait and landscape | Compact left column |
| Bubbles, one player | Portrait and landscape | Compact left column while actionable |
| Bubbles, two players | Landscape only | Compact left column while actionable |

The shell evaluates the policy before mounting a game. A mismatch disables the current pose targets, requests the required layout, and shows the same rotation instruction on the television and phone. The game begins only after the acknowledgement and a matching canonical packet.

## Active-game lock

- Draw and Bubbles capture the entering frame layout.
- A different incoming layout is an orientation mismatch, not a resize.
- The mismatched pose and avatar are hidden from the game. The television instructs the user to restore the captured layout.
- Draw immediately ends the grip and current path. Artwork, selected tool, and color remain available when the expected layout returns.
- Bubbles freezes the countdown or active round, movement, effects, respawn delays, scores, and result timing. It resumes from the same remaining duration.
- Returning to the captured layout resets all temporal input history before input resumes, preventing dwell, stroke, or swept-collision bridges.
- A new Draw entry under a different layout begins with an empty canvas because the old normalized artwork has no stable physical meaning after a deliberate camera-layout change.

Ordinary pose loss remains distinct: it follows each game's existing fail-closed behavior and does not pause Bubbles time.

## Presentation behavior

- The television contains the canonical camera frame without stretching or rotating the television viewport.
- Portrait produces a centered tall arena with side gutters. Landscape produces a wider arena.
- Game targets and body-controlled actions stay inside the camera arena. Scores, timers, instructions, and other noninteractive HUD may use television space outside it.
- Draw and Bubbles scale sizes and distances from the canonical frame minimum dimension as before.
- The phone video and avatar preview share the same canonical aspect and rotation.

## Implementation plan

- [x] Add strict camera-layout, quarter-turn, frame-epoch, and game-policy domain contracts.
- [x] Hard-cut `PosePacket.frame`, worker messages, peer protocol, fixtures, and documentation to the canonical frame schema.
- [x] Normalize MediaPipe input/output at the phone boundary and expose bounded orientation diagnostics.
- [x] Add stable orientation transitions and strict acknowledged television-to-phone layout requests.
- [x] Make phone preview geometry and menu control placement layout-aware.
- [x] Gate incompatible game entry and lock active games to their entering layout.
- [x] Reset Draw input and pause/resume Bubbles safely across orientation mismatch, including gaps before the returning packet.
- [x] Add unit, component, transport, and production-browser regression coverage.
- [x] Run the complete canonical validation suite.
- [ ] Validate portrait and landscape behavior on the owner's real phone and television.

## Acceptance criteria

1. A phone can begin tracking in portrait or landscape and MediaPipe receives an upright frame in either case.
2. The TV mirror remains horizontal in physical screen space for both layouts.
3. Packet dimensions, layout, and epoch are strictly validated; obsolete packets and peers fail closed.
4. Main Menu and Games use the above-head row in portrait and the compact left column in landscape.
5. Draw and one-player Bubbles can start in either layout; two-player Bubbles cannot start until landscape is acknowledged.
6. An incompatible game selection shows a clear rotation gate on both screens without restarting pairing, tracking, or player mode.
7. Active games consume no mismatched-layout pose. Draw creates no bridge stroke, and Bubbles loses no game time or state during the mismatch.
8. Returning to the captured layout resumes through fresh input histories.
9. Phone diagnostics reveal enough non-pixel orientation state to diagnose a target browser.
10. No forced aspect ratio, alternate rotation implementation, screen-lock dependency, compatibility parser, or legacy protocol remains.

Automated checks cannot prove browser camera metadata or pose accuracy. Complete real-device orientation acceptance remains required.
