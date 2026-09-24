# JojixPlay

A landscape, phone-powered playroom for children aged 4–7 and their grown-ups. Use external phone screen mirroring for a television. The TV runs no application.

The platform currently offers a movement check. Old games are retired; new games, including the first new Draw, await the owner's design decisions.

Rotate the phone, tap **Let’s get ready**, and wave. Shoulders and hands can be tracked without visible feet. Camera pixels stay hidden and on-device. The Full GPU model's real-phone accuracy and performance still require acceptance testing.

Use Node 24.19.0 and npm 11.17.0:

```sh
npm ci
npm run dev
npm run dev:game
npm run validate
```

The second development command opens the independent synthetic input lab. See [architecture](docs/architecture/overview.md), [stack](docs/architecture/stack.md) and [status](docs/project/status.md). Validated `main` deploys through GitHub Actions to GitHub Pages.
