import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const deploymentBase = process.env.BASE_PATH ?? "/";
if (!/^\/(?:[A-Za-z0-9._~-]+\/)*$/u.test(deploymentBase)) {
  throw new Error("BASE_PATH must be an absolute URL path with a trailing slash.");
}

export default defineConfig({
  base: deploymentBase,
  plugins: [
    preact(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/@mediapipe/tasks-vision/wasm/*",
          dest: "mediapipe/tasks-vision-1.0.1/wasm",
          rename: { stripBase: true },
        },
        {
          src: "assets/models/pose_landmarker_lite.task",
          dest: "mediapipe/pose-landmarker-lite-float16-1",
          rename: { stripBase: true },
        },
      ],
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
