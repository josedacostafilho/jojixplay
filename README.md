# JojixPlay

JojixPlay is a greenfield static web application that turns a phone into a private pose controller for a nearby television. Its live skeleton viewer and first game, Draw, keep camera pixels on the phone and send only validated pose landmarks over a direct WebRTC connection.

Start with [`AGENTS.md`](AGENTS.md) and the [`docs/`](docs/README.md) knowledge base. Accepted behavior is defined in the [`skeleton-viewer`](docs/product/skeleton-viewer.md) and [`Draw`](docs/product/draw-game.md) contracts.

## Local development

Requirements: Node.js 24.19.0 and npm 11.17.0.

```sh
npm ci
npm run dev
```

Use `npm run validate` for the complete canonical quality suite. All commands and exact tooling are maintained in [`docs/architecture/stack.md`](docs/architecture/stack.md).

## Try the prototype

1. Run `npm run dev` and open the shown URL on a supported device.
2. Choose **Open on the TV** on the display device.
3. Scan the generated QR with the phone, or choose **Open on the phone** and enter the TV's 20-character pairing key.
4. Connect, then press **Start body tracking**.
5. Place the phone so its front (selfie) camera can see the players' full bodies with clear space above their heads.
6. Raise a hand to claim the TV controls, move it clear once to arm the buttons, then open **Games → Draw** or use the Main Menu actions.
7. In Draw, hold the brush hand still on the white board to engage it; the other hand can dwell-engage the eraser.

Camera access requires HTTPS or localhost. The application requests no audio, retains no session data, and sends only validated pose landmarks over the peer connection.

## Deployment

The committed GitHub Actions workflow validates and deploys `main` to [the live GitHub Pages site](https://josedacostafilho.github.io/jojixplay/). Complete phone/television acceptance remains outstanding; see [`docs/project/status.md`](docs/project/status.md).
