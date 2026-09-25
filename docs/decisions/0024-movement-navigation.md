---
status: Accepted
last_verified: 2026-09-24
---

# Movement operates the complete play session

The phone sits across the room beside the television. Trusted camera setup is the only step that requires touch. Every subsequent menu, game tool, help control, confirmation and return action must be reachable through fresh body movement. This replaces the touch-only confirmation decision in ADR-0023.

The SDK supplies one small DOM dwell controller shared by the host and isolated games. It invokes the same semantic buttons used by touch and keyboard, reads their actual visible rectangles, respects modal exclusivity, and shows a hand cursor with an 800 ms progress ring. New targets, completed actions and lost input require leaving all targets before re-arming. No menu state, game rules, renderer, person identity or tracking vendor enters that helper. Consumers own projection and fresh input; the game keeps its screen-side palette ownership.

Host controls remain active while an exit confirmation pauses game painting. Native modal cursors live in the modal top layer. Desenhar clear confirmations retain fresh control input while withholding paint. The active game occupies the phone's landscape screen, and host return stays inside the projected camera area. Stopping explicitly ends camera access; starting a new capture again requires browser-authorized touch. Camera or orientation failure cannot be recovered by movement without a working capture session.
