---
status: Accepted
last_verified: 2026-09-27
---

# ADR-0032: Hand results and stream stalls

The owner rejects the game’s 180 ms capture-age cutoff and 0.06 wrist-proximity reset. Those restrictions could discard a valid result after slow inference or erase two clearly detected nearby hands. This amends the hand availability/overlap rules in ADR-0029; curl interpretation, firing and model ownership remain in force.

Teias consumes every newly delivered hand result regardless of inference duration. The host bypasses its body capture-age gate when delivering gameplay hand input. Present hands update; omitted hands disappear and release their webs immediately. Close wrists alone do not invalidate input. Uncertain curl retains the previous grip, with no timed classification rejection.

A one-second deadline measures time since receiving a new result, protecting against a silent stream. Repeated frames and non-increasing sequences within an epoch do not extend it. Stop/error input and epoch changes clear history; reacquired fists must reopen before firing. Physics never waits for inference. Camera capture remains single-flight, without queued historical frames.

Regression checks cover close wrists, omission of one/both hands, delayed inference, immediate release, reacquisition and a stream that stops delivering new results. The host browser journey uses 500 ms-old capture timestamps to exercise the complete delivery path. This establishes downstream handling, not target-phone accuracy or latency.
