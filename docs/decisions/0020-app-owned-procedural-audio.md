---
status: Accepted
last_verified: 2026-08-18
scope: Application-wide audio ownership, browser activation, sound controls, and procedural cue policy
---

# ADR-0020: Own one procedural Web Audio runtime on the rendering device

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision owners:** Project owner
- **Supersedes:** The silent-runtime scope in [ADR-0016](0016-phaser-canvas-racing.md) and the Main Menu action set in [ADR-0010](0010-menu-and-draw-game.md)
- **Superseded by:** None

## Context

JojixPlay has no sound. Menus lack activation feedback, Draw has no tool contact, Bubbles has no pop or countdown feedback, and Racing has no engine or road response. Sound is needed in paired television and all-in-one phone play, but Phaser is lazy and Racing-only. Making Phaser or each game own audio would create duplicate contexts and couple shared application behavior to one renderer.

Browsers require audible playback to be unlocked by a real user activation. A pose-derived dwell is not a trusted browser event. TV mode and local play already begin through explicit Start buttons, providing the correct activation boundary. The paired phone controller does not render game state and must not produce an earlier, duplicated copy of game audio.

## Decision

- The rendering host owns exactly one native `AudioContext`: the television in paired mode and the phone in local mode. The paired phone controller remains silent.
- Web Audio is a required capability for television and local modes. Missing support fails at the existing capability boundary; no HTML Audio, prefixed API, Phaser Sound Manager, Howler, or silent compatibility path is added.
- TV **Start TV mode** and local **Start local play** synchronously request audio startup alongside fullscreen/camera work. Entry does not complete if the required context cannot start. Subsequent visibility recovery attempts `resume()` and reports an actionable sound state rather than fabricating success.
- One bounded graph owns category gains, master gain, short procedural one-shots, one Draw contact voice, and at most one Racing engine voice per active car. Sources are cleaned up deterministically on state exit, stop, unmount, or context close.
- Phaser retains `audio.noAudio: true`. Pure game sessions remain independent of browser audio; presentation code translates exact action/phase/pop/drawing/racing state changes into semantic cues and continuous parameters.
- The initial sound set is generated with Web Audio oscillators, filters, envelopes, and bounded noise. No remote or vendored sound asset, license obligation, codec fallback, or new dependency is introduced.
- Sound starts enabled. The Main Menu hard-cuts its Background action to **Settings**; Settings owns **Sound: On/Off**, **Background**, and **Return** as a compact left-column action set. Mute is session-local and is not persisted.
- Sound never becomes the only carrier of countdown, result, error, tracking, or control state. Existing semantic and visual output remains authoritative.
- Hidden documents suspend continuous output and visible documents attempt to resume it. Missed one-shot cues are not replayed. Local OS/wired mirroring receives audio only according to the external platform's behavior; JojixPlay does not select an output device or own casting.

## Consequences

### Benefits

- Every current game and menu shares one low-latency audio lifecycle without loading Phaser outside Racing.
- Procedural cues add no asset downloads, licensing uncertainty, or backend requirement and match the arcade presentation.
- Game rules and deterministic tests remain independent from browser side effects.
- Sound and visuals originate on the same rendering device, avoiding paired phone/television echo and timing disagreement.

### Costs and risks

- Procedural sound has a deliberately synthetic character and requires careful gain limits to avoid fatigue or clipping.
- Web Audio behavior after backgrounding varies by browser and needs real Silk/mobile acceptance.
- Local screen mirroring may route, delay, or omit audio according to the operating system.
- Adding audio consumes some CPU on already weak display hardware; node counts and update cadence must remain bounded and measured.

## Alternatives considered

### Use Phaser Sound Manager for Racing and another system elsewhere

Rejected. It creates two owners and either loads Phaser too broadly or makes global sound behavior depend on a Racing-only engine. Phaser's HTML Audio fallback also conflicts with the required modern baseline.

### Add Howler or Tone.js

Rejected. The selected cue, gain, oscillator, and continuous-voice requirements are small enough for a focused native boundary; another dependency and compatibility behavior are not justified.

### Download free sound assets

Rejected for the first sound slice. Assets add licensing, attribution, codec, preload, and network concerns. A future quality replacement may hard-cut individual procedural cues to locally vendored, explicitly licensed assets.

## Verification

- Capability tests prove audio is required only on rendering modes.
- Audio-runtime tests prove trusted start, one-context ownership, mute gain, bounded cue/voice creation, parameter updates, visibility suspension/resume, and deterministic cleanup.
- Component tests prove Settings replaces the old Main Menu Background action, all semantic actions remain usable, mute labels are accurate, and each game emits its intended cues without making sound its only feedback.
- Production-browser tests prove the real Web Audio context is requested from the trusted TV/local actions, local mode still reaches tracking, and Racing keeps one `noAudio` Phaser runtime.
- Real-device acceptance covers audibility, latency, clipping, fatigue, two-engine distinction, background recovery, Silk behavior, and external mirroring.

## Follow-up

- Complete the target-device acceptance in [Audio](../product/audio.md).
- Add music or sample assets only through a separately accepted product and licensing decision.
