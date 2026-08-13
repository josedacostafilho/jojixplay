import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const modelUrl = new URL("../assets/models/pose_landmarker_lite.task", import.meta.url);
const checksumUrl = new URL("../assets/models/pose_landmarker_lite.task.sha256", import.meta.url);
const expectedChecksum = (await readFile(checksumUrl, "utf8")).trim();

if (!/^[a-f0-9]{64}$/u.test(expectedChecksum)) {
  throw new Error("The vendored pose-model checksum file is malformed.");
}

const model = await readFile(modelUrl);
const actualChecksum = createHash("sha256").update(model).digest("hex");
if (actualChecksum !== expectedChecksum) {
  throw new Error("The vendored pose model does not match its approved checksum.");
}

process.stdout.write("Vendored pose-model checksum verified.\n");
