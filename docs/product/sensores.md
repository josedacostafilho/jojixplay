---
status: Active
last_verified: 2026-10-09
---

# Sensores

The owner's bench for looking at what the phone senses, with no game rules in the way. It is on the menu shelf beside the games so it can be opened on the real phone and television, and it is not meant for children. It may be removed or hidden later. One person for now.

## What it shows

Whatever the host is sensing, drawn over the whole screen exactly where the mirrored camera image shows it:

- **Corpo**: every sensed joint as a dot and the bones between joints that are both present. A missing joint removes only its own bones.
- **Mãos**: both hands, 21 points and every finger each, with **Esquerda** or **Direita** under the wrist.
- **Silhueta**: everyone in view as one shape. With the camera image showing, the shape is a yellow tint over the person. With **Ver fundo**, only the person's own live camera pixels show, on the plain background. The silhouette is the pose model's own mask, so the joints are drawn with it.
- **Corpo + silhueta**: a disabled placeholder. Nothing is built behind it.

Green is the person's own left, red their own right, white the middle. A swapped side or a mirrored figure is therefore visible at a glance. The bench interprets nothing: no gestures, no presses beyond its own buttons.

The line at the bottom right gives what was found (people, hands, or the share of the image the silhouette covers), how many readings arrived in the last second and the average delay from camera capture to arrival. Games ignore a reading older than 250 ms; the bench keeps drawing a slower one and adds **atrasada** to the line, because slowness is one of the things it is for. It says **Trocando o sensor…** while the host swaps models and **Sem leitura** when no reading has arrived for a second.

## Controls

The modes are a column on the left edge; **Ver fundo** / **Ver câmera** and **Voltar** are in the top right corner. **Ver fundo** hides the camera image and keeps the figure on a plain background. In **Silhueta** there is no fingertip, so a button is held by covering at least a quarter of it with the silhouette. Otherwise every button works by touch, keyboard, or by holding an index fingertip on it: the pose model's index joint (or the wrist when it is missing) in **Corpo**, the hand model's index tip in **Mãos**. **Voltar** takes a two-second hold and asks no confirmation. The usual hand circle appears only over a button, so it does not cover the fingertip being inspected.

Leaving returns the host to body sensing for the menu.

## Standalone studio

`npm run dev:sense` runs the bench without a camera: a synthetic person, or two synthetic hands, with the right hand following the pointer.
