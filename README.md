# JojixPlay

A landscape, phone-powered playroom for children aged 4–7 and their grown-ups. Use external phone screen mirroring for a television. The TV runs no application.

All product UI is Brazilian Portuguese. After the movement check, open **Desenhar sozinho** or **Desenhar em dupla** to paint with your hands. Old games remain retired.

Rotate the phone, tap **Vamos começar**, and wave. Shoulders and hands can be tracked without visible feet. The main game menu overlays an edge-to-edge mirrored camera and authored 3D hands; video stays on-device. The Full GPU model's real-phone accuracy and performance still require acceptance testing.

Use Node 24.19.0 and npm 11.17.0:

```sh
npm ci
npm run dev
npm run dev:game
npm run dev:draw
npm run validate
```

The independent input lab and Desenhar studio run separately from the application. In the drawing studio, move the pointer and hold Shift to simulate painting. See [architecture](docs/architecture/overview.md), [stack](docs/architecture/stack.md) and [status](docs/project/status.md). Validated `main` deploys through GitHub Actions to GitHub Pages.
