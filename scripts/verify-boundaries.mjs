import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", "dist"].includes(entry.name)) continue;
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(name)));
    else if (/\.[cm]?tsx?$/u.test(name)) result.push(name);
  }
  return result;
}
const manifests = new Map();
for (const root of ["apps", "packages", "games"]) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT" && root === "games") continue;
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(root, entry.name);
    manifests.set(
      directory,
      JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")),
    );
  }
}
for (const [directory, manifest] of manifests) {
  for (const file of await files(directory)) {
    const source = await readFile(file, "utf8");
    // Static module syntax only: computed imports and require bypass workspace contracts.
    if (/\b(?:require\s*\(|import\s*\(\s*[^"'\s])/u.test(source))
      throw new Error(`${file}: computed imports and require are forbidden`);
    const imports = source.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']/gu);
    for (const [, specifier] of imports) {
      if (specifier.startsWith(".")) {
        const target = path.resolve(path.dirname(file), specifier);
        if (!target.startsWith(path.resolve(directory) + path.sep))
          throw new Error(`${file}: import escapes its workspace: ${specifier}`);
      } else {
        const dependency = specifier.startsWith("@")
          ? specifier.split("/").slice(0, 2).join("/")
          : specifier.split("/")[0];
        if (
          !manifest.dependencies?.[dependency] &&
          !(
            (file.includes("/tests/") || file.endsWith(".config.ts")) &&
            manifest.devDependencies?.[dependency]
          )
        )
          throw new Error(`${file}: undeclared dependency ${dependency}`);
        if (dependency.startsWith("@jojixplay/")) {
          const target = [...manifests].find(([, value]) => value.name === dependency)?.[0];
          if (
            !target ||
            target.startsWith("apps/") ||
            (target.startsWith("games/") && !directory.startsWith("apps/")) ||
            dependency !== specifier
          )
            throw new Error(`${file}: forbidden workspace dependency ${specifier}`);
        }
      }
    }
  }
}
console.log("Workspace imports use declared public boundaries.");
