import { createReadStream, readFileSync } from "node:fs";
import { cp, stat } from "node:fs/promises";
import path from "node:path";
import preact from "@preact/preset-vite";
import { defineConfig, type Plugin } from "vite";

const deploymentBase = process.env.BASE_PATH ?? "/";
if (!/^\/(?:[A-Za-z0-9._~-]+\/)*$/u.test(deploymentBase)) {
  throw new Error("BASE_PATH must be an absolute URL path with a trailing slash.");
}

// Set only by `npm run dev:lan`, which serves phones on the local network over HTTPS.
const lanCertificate = process.env.JOJIXPLAY_LAN_CERTIFICATE;

const contentTypes: Record<string, string> = {
  ".js": "text/javascript",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
};
const published = (file: string) => path.extname(file) in contentTypes;

/**
 * Publishes unbundled runtime files at fixed, versioned paths in development and builds. A source
 * is one file, or a directory whose publishable files are all served.
 */
function versionedAssets(mounts: Readonly<Record<string, string>>): Plugin {
  let outDir = "dist";
  const sources = Object.entries(mounts).map(([mount, source]) => {
    const only = published(source) ? path.basename(source) : null;
    return { mount, directory: only ? path.dirname(source) : source, only };
  });
  return {
    name: "jojixplay-versioned-assets",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://dev").pathname);
        for (const { mount, directory, only } of sources) {
          const prefix = `${server.config.base}${mount}/`;
          const name = pathname.slice(prefix.length);
          if (!pathname.startsWith(prefix) || name.includes("/") || !published(name)) continue;
          if (only !== null && name !== only) break;
          const file = path.join(directory, name);
          const info = await stat(file).catch(() => null);
          if (!info?.isFile()) break;
          response.setHeader("Content-Type", contentTypes[path.extname(file)] ?? "");
          response.setHeader("Content-Length", info.size);
          createReadStream(file).pipe(response);
          return;
        }
        next();
      });
    },
    async closeBundle() {
      for (const { mount, directory, only } of sources)
        await cp(directory, path.join(outDir, mount), {
          recursive: true,
          filter: (file) =>
            file === directory || (only ? path.basename(file) === only : published(file)),
        });
    },
  };
}

export default defineConfig({
  base: deploymentBase,
  plugins: [
    preact(),
    versionedAssets({
      "mediapipe/tasks-vision-1.0.1/wasm": "node_modules/@mediapipe/tasks-vision/wasm",
      "mediapipe/pose-landmarker-full-float16-1": "assets/models/pose_landmarker_full.task",
      "mediapipe/hand-landmarker-float16-1": "assets/models/hand_landmarker.task",
    }),
  ],
  ...(lanCertificate
    ? {
        server: {
          https: {
            key: readFileSync(path.join(lanCertificate, "key.pem")),
            cert: readFileSync(path.join(lanCertificate, "cert.pem")),
          },
        },
      }
    : {}),
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
