# JojixPlay

Movement-controlled games running entirely on your landscape phone. Mirror the phone screen using your device settings or a cable to play on a larger display. The television runs no app.

## Play

1. Open the website on your phone and rotate to landscape.
2. Start screen mirroring if wanted, then prop up the phone with its front camera facing your full body.
3. Press **Start playing**. Raise a hand, move it clear of the controls, and select Games: Draw, Bubbles, or Racing.
4. Press **Stop** when finished. Rotating to portrait also stops the run.

Camera pixels and landmarks stay on-device. No account, pairing, preview, or microphone is used. Camera access requires HTTPS or localhost. Native landscape lock, fullscreen, and wake lock depend on browser support; portrait play is always blocked.

## Development

Use Node.js 24.19.0 and npm 11.17.0:

```sh
npm ci
npm run dev
npm run validate
```

Read [AGENTS.md](AGENTS.md), [Documentation](docs/README.md), and [Stack](docs/architecture/stack.md). GitHub Actions deploys validated `main` to [GitHub Pages](https://josedacostafilho.github.io/jojixplay/). Real-device acceptance remains outstanding; see [Project status](docs/project/status.md).
