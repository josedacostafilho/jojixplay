# JojixPlay

JojixPlay is a greenfield static web application that turns a phone into a private pose controller for a nearby television. The first vertical slice is a live skeleton viewer; camera pixels remain on the phone and only validated pose landmarks travel over a direct WebRTC connection.

Start with [`AGENTS.md`](AGENTS.md) and the [`docs/`](docs/README.md) knowledge base. The accepted behavior is defined in [`docs/product/skeleton-viewer.md`](docs/product/skeleton-viewer.md).

## Local development

Requirements: Node.js 22.22.0 and npm 11.

```sh
npm ci
npm run dev
```

Use `npm run validate` for the complete canonical quality suite. All commands and exact tooling are maintained in [`docs/architecture/stack.md`](docs/architecture/stack.md).

## Try the prototype

1. Run `npm run dev` and open the shown URL on a supported device.
2. Choose **Open on the TV** on the display device.
3. Scan the generated QR with the phone, open the link, and press **Start body tracking**.
4. Place the phone so its camera can see the players' full bodies.

Camera access requires HTTPS or localhost. The application requests no audio, retains no session data, and sends only validated pose landmarks over the peer connection.

## Deployment

The committed GitHub Actions workflow validates and deploys `main` to a GitHub Pages project site. After connecting the repository remote, select **GitHub Actions** as the Pages source in repository settings. Deployment and real phone/television acceptance have not been performed from this workspace; see [`docs/project/status.md`](docs/project/status.md).
