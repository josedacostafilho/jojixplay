# JojixPlay

JojixPlay is a greenfield static web application that turns a phone into a private body controller. It can pair a phone with a television browser over direct WebRTC, or run the complete mirrored playfield locally through **Play on this phone** for standalone use or operating-system screen mirroring. Draw, Bubbles, and Racing all use the same game implementations in both topologies.

Start with [`AGENTS.md`](AGENTS.md) and the [`docs/`](docs/README.md) knowledge base. The paired flow is defined in [Phone-to-television](docs/product/skeleton-viewer.md), while the direct flow is defined in [Play on this phone](docs/product/local-play.md).

## Local development

Requirements: Node.js 24.19.0 and npm 11.17.0.

```sh
npm ci
npm run dev
```

Use `npm run validate` for the complete canonical quality suite. All commands and exact tooling are maintained in [`docs/architecture/stack.md`](docs/architecture/stack.md).

## Try the paired prototype

1. Run `npm run dev` and open the shown URL on a supported device.
2. Choose **Open on the TV** on the display device.
3. Scan the generated QR with the phone, or choose **Open on the phone** and enter the TV's 20-character pairing key.
4. Connect, then press **Start body tracking**.
5. Place the phone so its front (selfie) camera can see the players' full bodies with clear space above their heads.
6. Raise a hand to claim the TV controls, move it clear once to arm the buttons, then open **Games** and choose Draw, Bubbles, or Racing.

## Play on one phone

1. Choose **Play on this phone**.
2. Prop up the phone so its front camera can see the players' full bodies.
3. Optionally start operating-system screen mirroring or connect a wired display.
4. Press **Start local play** and use the same mirrored body controls and games directly. Local play shows no raw camera preview.
5. Press **Stop** when finished to release the camera and local play resources.

Camera access requires HTTPS or localhost. The application requests no audio and retains no session data. Paired mode sends only validated pose landmarks over the peer connection; local mode creates no peer connection and keeps its camera capture source hidden.

## Deployment

The committed GitHub Actions workflow validates and deploys `main` to [the live GitHub Pages site](https://josedacostafilho.github.io/jojixplay/). Complete phone/television acceptance remains outstanding; see [`docs/project/status.md`](docs/project/status.md).
