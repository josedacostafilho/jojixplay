---
status: Active
last_verified: 2026-08-13
scope: Client technology stack, inference boundary, and game-renderer independence
---

# ADR-0003: Typed static client with an independent renderer boundary

- **Status:** Accepted
- **Date:** 2026-08-13
- **Decision owners:** Project owner
- **Supersedes:** None
- **Superseded by:** None

## Context

The first slice needs a small phone and television interface, synchronous browser pose inference isolated from the user interface, and a simple skeleton renderer. Future games may be polished 2D or modest 3D experiences, so the application shell and pose pipeline must not be coupled to a particular game renderer. Installing a game engine before a game exists would add weight and speculative architecture.

## Decision

- Use TypeScript, Vite, Preact, and npm for the static client.
- Use MediaPipe Tasks Vision Pose Landmarker Lite in a module worker for phone-local inference.
- Define and validate an application-owned `PosePacket` at the boundary between inference, transport, and rendering.
- Use Canvas 2D as the skeleton viewer's intentional renderer.
- Keep Preact responsible for application UI and lifecycle, not frame-level game rendering.
- Do not install Phaser, PlayCanvas, Three.js, Babylon.js, or another game engine until a concrete game requires one.
- Future games must receive validated pose-domain input through the shell boundary and dynamically load exactly one chosen renderer.

## Consequences

### Benefits

- Strong types and strict validation protect the privacy-sensitive network boundary.
- Worker isolation prevents synchronous inference from blocking the phone interface.
- The prototype remains small and directly tests the uncertain pose and peer-to-peer pipeline.
- Future 2D and 3D choices remain evidence-driven without a speculative universal game abstraction.

### Costs and risks

- MediaPipe worker and WebAssembly behavior must be verified on actual target phones.
- Canvas 2D skeleton code is prototype-specific and is not itself a future game engine.
- Each future renderer will need an explicit game-host integration when its first real consumer exists.

## Alternatives considered

### One game engine for the prototype and all future games

Rejected because the skeleton viewer does not require an engine and the game catalogue is not defined. A forced choice would either make 2D work awkward in a 3D engine or make 3D unavailable in a 2D engine.

### Main-thread pose inference

Rejected because MediaPipe video inference is synchronous and can block interaction and status rendering.

### Framework-owned canvas scene graph

Rejected. Preact owns menus and lifecycle; a rendering loop must own its canvas directly so future engines are not mediated through component rerenders.

## Verification

- Type analysis runs in strict mode.
- The television renderer imports the application pose contract but not MediaPipe or Trystero.
- The phone worker is the only module importing MediaPipe.
- Dependency inspection finds no game engine.
- Production chunks keep phone inference code separate from the shell and television path.

