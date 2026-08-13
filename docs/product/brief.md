---
status: Active
last_verified: 2026-08-13
scope: Product purpose, users, constraints, and first outcome
---

# JojixPlay product brief

## Purpose

JojixPlay turns a phone into a private, camera-based body controller for games shown on a nearby television. The phone performs pose estimation locally and sends only pose landmarks to the television; camera pixels never leave the phone.

The first product proof is a live skeleton viewer. It validates camera capture, on-device pose estimation, pairing, peer-to-peer transport, and television rendering without committing the project to a game engine prematurely.

## Primary users and setting

- People who want free, Kinect-like motion experiences using devices they already own.
- A modern phone with a camera and a television browser on the same Wi-Fi network.
- One or two simultaneously visible players for the first prototype.

The initial experience assumes internet access to load the static application and perform decentralized peer discovery. After WebRTC connects, pose traffic should travel directly between the devices.

## Core experience

1. Open JojixPlay on the television and choose **TV display**.
2. Scan the displayed QR code, or open JojixPlay on the phone and enter the displayed 20-character key.
3. Connect, grant camera access, and start pose tracking.
4. See each currently detected person rendered as an identity-independent skeleton on the television.

## Product invariants

- Camera frames and video streams remain on the phone.
- The network contract contains pose landmarks and minimal session metadata only.
- No account, database, owned backend, analytics, or retained session data exists in the prototype.
- People are independent detections. Array position is not an identity and must not be tracked across frames.
- The application shell does not depend on a particular game renderer.
- Each future game selects exactly one renderer and loads it only when needed.
- The repository remains greenfield and follows mandatory hard cutovers under [ADR-0001](../decisions/0001-greenfield-hard-cutover.md).

## Prototype non-goals

- A playable game, scoring, menus for a game catalogue, or a game-engine integration.
- Stable player identity, cross-frame skeleton matching, profiles, or accounts.
- Camera-pixel streaming, recording, upload, or persistence.
- TURN service, relay transport, transport fallbacks, or offline peer discovery.
- Supporting obsolete browsers through polyfills or alternate implementations.

## First-outcome success criteria

The prototype succeeds when the journey in [Skeleton-viewer specification](skeleton-viewer.md) works on a real phone and television, one or two detected bodies render continuously, failures are actionable, and inspection confirms that no camera pixels cross the peer connection.
