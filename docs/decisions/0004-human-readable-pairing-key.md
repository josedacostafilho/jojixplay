---
status: Active
last_verified: 2026-08-13
scope: Human-readable session pairing, credential derivation, and QR/manual entry convergence
---

# ADR-0004: One human-readable key for QR and manual pairing

- **Status:** Accepted
- **Date:** 2026-08-13
- **Decision owners:** Project owner
- **Supersedes:** ADR-0002 credential-generation and delivery clauses only
- **Superseded by:** None

## Context

The deployed television browser renders the QR code too poorly for reliable phone scanning. Pairing must therefore support phone entry without adding a backend, persistent state, a second transport, or a second authentication contract.

A short numeric PIN is not adequate. Trystero derives its signaling-encryption key with a deliberately fast SHA-256 operation, so an observer who captures encrypted signaling could test a small PIN space offline. The manually entered value must retain enough random entropy to make that attack impractical while remaining readable from a television and typeable on a phone.

## Decision

- Each television session generates exactly 20 uniformly random Crockford base32 symbols with `crypto.getRandomValues`, providing 100 bits of entropy.
- The television displays the key in five groups of four characters and embeds the same ungrouped key as the sole field in the QR URL fragment.
- The phone accepts either source. Manual input is case-insensitive, ignores spaces and hyphens, and maps Crockford's ambiguous O, I, and L inputs to 0, 1, and 1.
- Both devices derive a 128-bit room representation and a 192-bit Trystero password representation using SHA-256 inputs separated by the application context and the `room` or `secret` purpose label.
- The security level is the source key's 100 bits; longer derived encodings do not claim additional entropy.
- A QR fragment is scrubbed immediately after parsing. A manually entered key is never written to the URL. Both forms otherwise remain only in runtime memory.
- Creating a new television session generates a new key. Pairing material is no longer displayed after a phone connects.
- The former `room` plus `secret` QR fragment is rejected. There is no compatibility parser or parallel pairing path.

## Consequences

### Benefits

- Poor television QR rendering no longer blocks pairing.
- QR and manual entry converge before credential derivation, so the application owns one session contract and one transport path.
- The QR payload is shorter than the displaced room/password payload and may itself scan more reliably.
- Offline guessing remains impractical without requiring a server, account, or persistent lookup table.

### Costs and risks

- Typing five groups is slower than scanning a functioning QR code.
- A person who can see or photograph the active key can attempt to join that session; the key must be treated as ephemeral secret material.
- Session security is bounded by 100 bits rather than the nominal lengths of the derived room and password representations.

## Alternatives considered

### Six-digit PIN

Rejected because one million candidates are cheap to test offline against captured signaling ciphertext.

### Separate short lookup code backed by a service

Rejected because resolving a short code to high-entropy credentials would add owned server state and operational cost solely for pairing.

### Keep the full room and password as the manual value

Rejected because 54 ungrouped base64url characters are unnecessarily error-prone to read and type.

## Verification

- Unit tests prove alphabet, length, normalization, strict fragment shape, fixed derivation vectors, and rejection of the displaced fragment.
- Component and browser tests prove that a phone without a QR fragment can enter the displayed key and reach the same controller path.
- The TV and QR render the same source key, and network code still receives only the derived `SessionCredentials` boundary.
- Searches find no six-digit pairing path, credential lookup service, or parser for the former room/password fragment.
