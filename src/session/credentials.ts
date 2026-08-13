export interface SessionCredentials {
  room: string;
  secret: string;
}

export type SessionCredentialsResult =
  | { ok: true; value: SessionCredentials }
  | { ok: false; error: string };

const ROOM_BYTES = 16;
const SECRET_BYTES = 24;
const ROOM_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{32}$/;

function randomBase64Url(byteLength: number): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function createSessionCredentials(): SessionCredentials {
  return {
    room: randomBase64Url(ROOM_BYTES),
    secret: randomBase64Url(SECRET_BYTES),
  };
}

export function parseSessionFragment(fragment: string): SessionCredentialsResult {
  const normalized = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const params = new URLSearchParams(normalized);
  const keys = [...params.keys()];

  if (
    keys.length !== 2 ||
    keys.some((key) => key !== "room" && key !== "secret") ||
    params.getAll("room").length !== 1 ||
    params.getAll("secret").length !== 1
  ) {
    return { ok: false, error: "This pairing link is incomplete or malformed." };
  }

  const room = params.get("room");
  const secret = params.get("secret");
  if (
    room === null ||
    secret === null ||
    !ROOM_PATTERN.test(room) ||
    !SECRET_PATTERN.test(secret)
  ) {
    return { ok: false, error: "This pairing link is not valid." };
  }

  return { ok: true, value: { room, secret } };
}

export function buildPhonePairingUrl(pageUrl: string, credentials: SessionCredentials): string {
  const url = new URL(pageUrl);
  url.search = "";
  url.searchParams.set("role", "phone");
  url.hash = new URLSearchParams({
    room: credentials.room,
    secret: credentials.secret,
  }).toString();
  return url.toString();
}
