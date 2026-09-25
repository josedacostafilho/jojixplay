---
status: Active
last_verified: 2026-09-24
---

# Desenhar

A simple collaborative air-painting game for ages 4–7, with a grown-up nearby. Product copy is Brazilian Portuguese. There are no scores, timers or win conditions.

## Playing

After **Vamos começar**, choose **Desenhar** from the main game list, then **Sozinho** or **Em dupla**. The host waits for the camera to apply that inference count before entering. Two people stand on opposite screen sides with some space between them. They share one page, each with independent colors, brush width and selected drawing hand. Adult/child height differences do not affect ownership.

The right wrist moves the mirrored brush by default. Raise the other wrist above its shoulder to paint; lower it to move without painting. The hand button switches drawing hands. Feet, legs, hips and face are not prerequisites. Six colors and two brush widths are available. Hover over a control for 800 ms, or tap it. Move clear of the controls to re-arm after a selection. **Desfazer** removes that person's last stroke. **Nova folha** asks for movement-operated confirmation before clearing everyone's page. **Voltar** asks before leaving and discarding the drawing; both choices use the same hand dwell. Initial camera setup is the only required touch. Help, player selection and session stop are also movement operated.

## Input and art rules

- Player count is fixed at entry, never inferred from how many bodies happen to be detected in a frame.
- In two-person mode, shoulder midpoint selects mirrored left (`x < 0.44`) or right (`x > 0.56`) ownership. The center is unassigned. Two bodies in the same zone do not draw. Detector array order is never an identity.
- Controls need the chosen wrist; painting additionally needs the opposite wrist and opposite shoulder; two-person ownership additionally needs both shoulders. Missing painting requirements withhold paint while an available selected wrist can still operate controls.
- The opposite wrist engages at 0.07 normalized frame heights above its shoulder and releases at 0.02. No hidden body-part estimates are invented.
- Input must be fresh within 250 ms with increasing timestamps and sequences. A gap above 180 ms, frame epoch change, missing joint, large wrist/shoulder jump, toolbar entry or modal interaction breaks continuity. Reacquisition starts a dot, never a bridge.
- Paint is stored as normalized unmirrored-source-derived presentation points. It remains in memory only. A total of 6,000 marks bounds GPU buffers and retained art; a full page offers undo or a new sheet instead of silently dropping old art.
- Three.js instanced shaded segments and dots render the strokes. The viewport fits the canonical camera aspect without stretching. Preact owns only host navigation; game DOM owns its controls, and their real rectangles drive hover and painting exclusion.
- Temporary tracking loss preserves art. Stop, portrait, camera failure, unmount and confirmed exit discard it and dispose GPU resources. No download, persistence, sound runtime or extra inference model is added.

## Independent development and verification

`npm run dev:draw` runs only this game with pointer-driven synthetic upper-body observations. Hold Shift (or check the raised-hand box) to paint; choose one or two people and simulate missing input. `npm test --workspace @jojixplay/desenhar` runs the pure game suite. Root validation also builds the independent game and tests drawing, loss, clear confirmation, mode selection and real camera entry in Chromium.

Real Galaxy S22/iPhone acceptance of gestures, control reach, heat and two-person occlusion is still required. Synthetic input cannot establish those properties.
