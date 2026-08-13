import { describe, expect, it } from "vitest";
import {
  buildPhonePairingUrl,
  createSessionCredentials,
  parseSessionFragment,
} from "../../src/session/credentials";

describe("session credentials", () => {
  it("creates independent high-entropy URL-safe values", () => {
    const first = createSessionCredentials();
    const second = createSessionCredentials();

    expect(first.room).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(first.secret).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(second).not.toEqual(first);
  });

  it("round-trips credentials through a fragment-only phone URL", () => {
    const credentials = {
      room: "abcdefghijklmnopqrstuv",
      secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
    };
    const pairingUrl = buildPhonePairingUrl(
      "https://example.test/jojixplay/?role=tv&debug=yes#old",
      credentials,
    );
    const url = new URL(pairingUrl);

    expect(url.pathname).toBe("/jojixplay/");
    expect(url.search).toBe("?role=phone");
    expect(url.search).not.toContain(credentials.secret);
    expect(parseSessionFragment(url.hash)).toEqual({ ok: true, value: credentials });
  });

  it.each([
    "",
    "#room=abcdefghijklmnopqrstuv",
    "#room=abcdefghijklmnopqrstuv&secret=abcdefghijklmnopqrstuvwxyzABCDEF&extra=no",
    "#room=abcdefghijklmnopqrstuv&room=abcdefghijklmnopqrstuv&secret=abcdefghijklmnopqrstuvwxyzABCDEF",
    "#room=too-short&secret=abcdefghijklmnopqrstuvwxyzABCDEF",
    "#room=abcdefghijklmnopqrstuv&secret=contains%20spaces0000000000000000",
  ])("rejects malformed fragment %s", (fragment) => {
    expect(parseSessionFragment(fragment).ok).toBe(false);
  });
});
