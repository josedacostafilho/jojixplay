export interface SessionCredentials {
  room: string;
  secret: string;
}

declare const pairingKeyBrand: unique symbol;
export type PairingKey = string & { readonly [pairingKeyBrand]: true };

export type PairingKeyResult = { ok: true; value: PairingKey } | { ok: false; error: string };

const PAIRING_KEY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PAIRING_KEY_LENGTH = 20;
const PAIRING_KEY_GROUP_LENGTH = 4;
const PAIRING_KEY_PATTERN = /^[0-9A-HJKMNP-TV-Z]{20}$/;
const DERIVATION_CONTEXT = "gg.jojixplay.skeleton:pairing";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function compactPairingKey(input: string): string {
  return input.toUpperCase().replaceAll("O", "0").replace(/[IL]/gu, "1").replace(/[\s-]/gu, "");
}

function groupPairingKey(input: string): string {
  const groups: string[] = [];
  for (let index = 0; index < input.length; index += PAIRING_KEY_GROUP_LENGTH) {
    groups.push(input.slice(index, index + PAIRING_KEY_GROUP_LENGTH));
  }
  return groups.join("-");
}

export function createPairingKey(): PairingKey {
  const randomValues = globalThis.crypto.getRandomValues(new Uint8Array(PAIRING_KEY_LENGTH));
  let key = "";
  for (const value of randomValues) {
    key += PAIRING_KEY_ALPHABET[value & 31];
  }
  return key as PairingKey;
}

export function parsePairingKey(input: string): PairingKeyResult {
  const key = compactPairingKey(input);
  if (!PAIRING_KEY_PATTERN.test(key)) {
    return {
      ok: false,
      error: "Enter the 20-character pairing key shown on your TV.",
    };
  }
  return { ok: true, value: key as PairingKey };
}

export function formatPairingKey(key: PairingKey): string {
  return groupPairingKey(key);
}

export function formatPairingKeyInput(input: string): string {
  const compact = compactPairingKey(input);
  if (compact.length > PAIRING_KEY_LENGTH || !PAIRING_KEY_PATTERN.test(compact.padEnd(20, "0"))) {
    return input.toUpperCase().slice(0, 24);
  }
  return groupPairingKey(compact);
}

export function parsePairingKeyFragment(fragment: string): PairingKeyResult {
  const normalized = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const params = new URLSearchParams(normalized);
  const keys = [...params.keys()];

  if (keys.length !== 1 || keys[0] !== "key" || params.getAll("key").length !== 1) {
    return { ok: false, error: "This pairing link is incomplete or malformed." };
  }

  const key = params.get("key");
  return key === null
    ? { ok: false, error: "This pairing link is not valid." }
    : parsePairingKey(key);
}

export function buildPhonePairingUrl(pageUrl: string, pairingKey: PairingKey): string {
  const url = new URL(pageUrl);
  url.search = "";
  url.searchParams.set("mode", "phone");
  url.hash = new URLSearchParams({ key: pairingKey }).toString();
  return url.toString();
}

export async function deriveSessionCredentials(
  pairingKey: PairingKey,
): Promise<SessionCredentials> {
  const encoder = new TextEncoder();
  const [roomHash, secretHash] = await Promise.all([
    globalThis.crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${DERIVATION_CONTEXT}:room:${pairingKey}`),
    ),
    globalThis.crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${DERIVATION_CONTEXT}:secret:${pairingKey}`),
    ),
  ]);

  return {
    room: bytesToBase64Url(new Uint8Array(roomHash).slice(0, 16)),
    secret: bytesToBase64Url(new Uint8Array(secretHash).slice(0, 24)),
  };
}
