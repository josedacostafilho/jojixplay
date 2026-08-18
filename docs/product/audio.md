---
status: Active
last_verified: 2026-08-18
scope: Implemented application audio behavior, sound catalog, lifecycle, controls, and acceptance criteria
---

# Application audio

## Outcome

JojixPlay provides immediate procedural sound feedback throughout the rendered experience. Paired play emits sound on the television; local play emits sound on the phone and lets the operating system route it during external mirroring. The paired camera phone remains silent. [ADR-0020](../decisions/0020-app-owned-procedural-audio.md) governs the boundary.

## Ownership and graph

```text
trusted TV/local Start activation
        ↓
one rendering-host AudioContext
        ├── short UI/game cues ── effects gain ─┐
        ├── Draw contact voice ── activity gain ├── master gain ── output
        └── Racing engine voices ─ engine gain ─┘
```

- One explicit audio runtime owns context creation, graph nodes, scheduling, mute state, visibility handling, and cleanup.
- `BodyPlayfield` receives that active runtime and emits presentation events; game sessions and `PosePacket` remain audio-free.
- Every one-shot has a bounded duration and disconnects after completion. Draw owns at most one continuous contact voice. Racing owns at most one engine voice per car.
- Continuous parameters use short scheduled ramps rather than per-render-frame node recreation. Muting ramps the master gain to prevent clicks.
- Phaser remains configured with `audio.noAudio: true` and never creates a second context.

## User activation and failure behavior

- **Start TV mode** constructs/resumes audio in the same trusted handler that requests fullscreen, before pairing begins.
- **Start local play** constructs/resumes audio in the same trusted handler that requests camera, fullscreen, and wake behavior. Failure stops partial startup and returns to an actionable setup error.
- Audio is required on the rendering host and omitted from paired-phone capability checks.
- A hidden page suspends continuous sound. Visibility restoration attempts resume, restarts only current continuous state, and never replays missed one-shots.
- Context start, resume, or node-construction failure is reported; no automatic alternate audio API is selected.
- Local stop, page teardown, and TV teardown stop voices, remove listeners, disconnect nodes, and close the owned context.

## Settings

Main Menu retains three coarse reachable targets:

```text
Main Menu
├── Games
├── Players
└── Settings
    ├── Sound: On/Off
    ├── Background
    └── Return
```

- Sound starts on after successful trusted startup.
- Mute schedules a short click-free ramp on the master gain and immediately updates the semantic control label.
- The setting lasts for the current page session only. No local storage, account preference, or transmitted setting exists.
- Visual and semantic feedback remains complete while muted.

## Sound catalog

| Surface | Required procedural feedback |
| --- | --- |
| Navigation | Action activation, back/exit, invalid/unavailable action, player/layout success or failure |
| Draw | Pencil contact, Eraser contact, tool switch, color change, clear |
| Bubbles | Three countdown beats, Go, bubble pop pitched by radius, round finish |
| Racing | Calibration countdown, Go, continuously speed-dependent engine per car, off-road texture, pause/resume, finish |

- Rapid repeating cues are rate-limited or represented by one continuous voice; no event may create an unbounded node count.
- Two-player engine voices use restrained left/right placement corresponding to the split-screen slots.
- Cue levels preserve speech and household comfort; simultaneous effects pass through bounded gain staging.
- Music is not part of this slice.

## Completed implementation plan

- [x] Add the required rendering-mode Web Audio capability and one tested rendering-host audio runtime.
- [x] Integrate trusted audio startup and complete cleanup into television and local mode lifecycle ownership.
- [x] Hard-cut Main Menu Background to Settings and add session-local Sound/Background/Return actions without increasing the three-target Main Menu.
- [x] Add bounded semantic navigation, Draw, Bubbles, and Racing cues plus continuous Draw/Racing voices.
- [x] Keep Phaser audio disabled and pure sessions, transport, pose packets, and deterministic simulation free of Web Audio state.
- [x] Add unit and component coverage for activation, settings, cue transitions, voice bounds, lifecycle, and failure behavior.
- [x] Reconcile architecture, product, testing, status, backlog, agent, and decision documentation with implemented truth.
- [x] Run the complete canonical validation suite and record real-device audio acceptance as outstanding.

## Acceptance criteria

1. Television and local modes reject a browser without standard Web Audio support; the paired phone does not require it.
2. No sound or context begins at page load. Each rendering mode starts exactly one context from its existing trusted Start action.
3. Paired game sound exists only on the television. Local game sound exists only on the local phone page.
4. Main Menu contains Games, Players, and Settings; Settings contains Sound, Background, and Return with shared body-control geometry and neutral re-arming.
5. Muting silences every current/future voice through one master boundary without stopping visual or semantic game behavior.
6. Every current game has the catalogued cues, and Racing engine pitch follows actual car speed continuously for one or two players.
7. Contexts, listeners, one-shots, Draw contact, and Racing voices cannot survive their declared stop/unmount boundaries.
8. Hidden-page suspension consumes no missed cue backlog and visibility recovery never fabricates success.
9. No Phaser sound manager, HTML Audio fallback, prefixed API, audio dependency, remote asset, persisted setting, or transmitted audio state exists.
10. Automated checks pass; target Silk/mobile testing records latency, mix clarity, performance, background recovery, and external-mirroring behavior.
