import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

for (const name of ["pose_landmarker_full", "hand_landmarker"]) {
  const path = `../assets/models/${name}.task`;
  const expected = (await readFile(new URL(`${path}.sha256`, import.meta.url), "utf8")).trim();
  if (!/^[a-f0-9]{64}$/u.test(expected)) throw new Error(`Malformed ${name} model checksum.`);
  const asset = await readFile(new URL(path, import.meta.url));
  if (createHash("sha256").update(asset).digest("hex") !== expected)
    throw new Error(`Vendored ${name} model checksum mismatch.`);
  process.stdout.write(`Vendored ${name} model checksum verified.\n`);
}
