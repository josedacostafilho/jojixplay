import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

for (const path of [
  "../assets/models/pose_landmarker_full.task",
  "../packages/movement-view/assets/hand.glb",
]) {
  const expected = (await readFile(new URL(`${path}.sha256`, import.meta.url), "utf8")).trim();
  if (!/^[a-f0-9]{64}$/u.test(expected)) throw new Error(`Malformed asset checksum: ${path}`);
  const asset = await readFile(new URL(path, import.meta.url));
  if (createHash("sha256").update(asset).digest("hex") !== expected)
    throw new Error(`Vendored asset checksum mismatch: ${path}`);
}
process.stdout.write("Vendored pose and hand asset checksums verified.\n");
