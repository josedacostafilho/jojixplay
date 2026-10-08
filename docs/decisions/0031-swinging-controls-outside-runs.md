---
status: Accepted
last_verified: 2026-09-27
---

# ADR-0031: Swinging navigation outside active runs

The owner requires Teias gameplay to contain no buttons or movement-navigation circles. Help and host Back are available during preparation and after death; replay is available after death. Rooftop running and swinging expose only gameplay input and feedback. This amends the always-available host return choice in ADR-0024 for this game. Other games retain their current controls.

Swinging owns its run phase and reports active-run transitions through one mount callback. The host uses that boolean to hide Back and dispose its navigation cursors. The game removes its own buttons and withholds dwell input during the same interval. Death and replay preparation restore navigation; rendering failure also restores host exit for recovery. Visible actions retain movement, keyboard and touch operation.

Browser regression coverage checks absence of buttons/cursors during play, restoration after death, and replay preparation. Movement-only preparation/help/exit remains covered at both phone-sized viewports.
