import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const path = "../assets/models/pose_landmarker_full.task";
const expected = (await readFile(new URL(`${path}.sha256`, import.meta.url), "utf8")).trim();
if (!/^[a-f0-9]{64}$/u.test(expected)) throw new Error("Malformed pose model checksum.");
const asset = await readFile(new URL(path, import.meta.url));
if (createHash("sha256").update(asset).digest("hex") !== expected)
  throw new Error("Vendored pose model checksum mismatch.");
process.stdout.write("Vendored pose model checksum verified.\n");
