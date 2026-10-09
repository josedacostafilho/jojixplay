// Serves the development app over HTTPS on the local network, so a phone on the same Wi-Fi gets
// the secure context that camera access requires. The certificate is self-signed and local only:
// the phone shows one warning to accept. Never used by builds or deployment.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";

const directory = path.resolve("node_modules/.cache/jojixplay/lan");
const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address)
  .sort();
if (addresses.length === 0) throw new Error("No local network address found. Connect to Wi-Fi.");

const names = ["DNS:localhost", "IP:127.0.0.1", ...addresses.map((address) => `IP:${address}`)];
const subject = names.join(",");
const record = path.join(directory, "names.txt");
// A certificate is only valid for the addresses it names; reissue when the network changes.
if (!existsSync(record) || readFileSync(record, "utf8") !== subject) {
  mkdirSync(directory, { recursive: true });
  try {
    execFileSync(
      "openssl",
      [
        ...["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30"],
        ...["-keyout", path.join(directory, "key.pem"), "-out", path.join(directory, "cert.pem")],
        ...["-subj", "/CN=JojixPlay local development", "-addext", `subjectAltName=${subject}`],
      ],
      { stdio: "ignore" },
    );
  } catch {
    throw new Error("Could not create a local certificate. Install openssl and try again.");
  }
  writeFileSync(record, subject);
}

console.log("\nOn the phone (same Wi-Fi), open one of these and accept the certificate warning:");
for (const address of addresses) console.log(`  https://${address}:5173/`);
console.log("");

const vite = spawn("vite", ["--host", "0.0.0.0", "--port", "5173", "--strictPort"], {
  stdio: "inherit",
  env: { ...process.env, JOJIXPLAY_LAN_CERTIFICATE: directory },
});
vite.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => vite.kill(signal));
