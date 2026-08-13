import { readFile } from "node:fs/promises";

const repositoryRoot = new URL("../", import.meta.url);
const expectedNode = (await readFile(new URL(".node-version", repositoryRoot), "utf8")).trim();
const packageJson = JSON.parse(await readFile(new URL("package.json", repositoryRoot), "utf8"));
const packageManager = packageJson.packageManager;

if (typeof packageManager !== "string" || !packageManager.startsWith("npm@")) {
  throw new Error("package.json must declare the canonical npm release.");
}

const expectedNpm = packageManager.slice("npm@".length);
const actualNpm = process.env.npm_config_user_agent?.match(/^npm\/([^ ]+)/)?.[1];

if (process.versions.node !== expectedNode) {
  throw new Error(`Expected Node.js ${expectedNode}, received ${process.versions.node}.`);
}
if (actualNpm !== expectedNpm) {
  throw new Error(`Expected npm ${expectedNpm}, received ${actualNpm ?? "an unknown release"}.`);
}

console.log(`Toolchain verified: Node.js ${expectedNode}, npm ${expectedNpm}.`);
