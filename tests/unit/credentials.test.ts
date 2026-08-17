import { describe, expect, it } from "vitest";
import {
  buildPhonePairingUrl,
  createPairingKey,
  deriveSessionCredentials,
  formatPairingKey,
  formatPairingKeyInput,
  type PairingKey,
  parsePairingKey,
  parsePairingKeyFragment,
} from "../../src/session/credentials";

function validKey(input: string): PairingKey {
  const result = parsePairingKey(input);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

describe("session pairing", () => {
  it("creates independent 100-bit Crockford base32 keys", () => {
    const first = createPairingKey();
    const second = createPairingKey();

    expect(first).toMatch(/^[0-9A-HJKMNP-TV-Z]{20}$/);
    expect(formatPairingKey(first)).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
    expect(second).not.toBe(first);
  });

  it("normalizes manual separators, case, and ambiguous characters", () => {
    expect(parsePairingKey("ol23-4567-89ab-cdef-ghjk")).toEqual({
      ok: true,
      value: "0123456789ABCDEFGHJK",
    });
    expect(formatPairingKeyInput("m7pkj3tdw9hxq4fv6r2c")).toBe("M7PK-J3TD-W9HX-Q4FV-6R2C");
  });

  it("round-trips the canonical key through a fragment-only phone URL", () => {
    const pairingKey = validKey("0123456789ABCDEFGHJK");
    const pairingUrl = buildPhonePairingUrl(
      "https://example.test/jojixplay/?mode=tv&debug=yes#old",
      pairingKey,
    );
    const url = new URL(pairingUrl);

    expect(url.pathname).toBe("/jojixplay/");
    expect(url.search).toBe("?mode=phone");
    expect(url.search).not.toContain(pairingKey);
    expect(parsePairingKeyFragment(url.hash)).toEqual({ ok: true, value: pairingKey });
  });

  it("derives stable, domain-separated Trystero credentials", async () => {
    await expect(deriveSessionCredentials(validKey("0123456789ABCDEFGHJK"))).resolves.toEqual({
      room: "Jgt88jBfsU8nOxS7yA5eoA",
      secret: "elXOCr_5QuF89IDpPPDR8bPIrStTui4N",
    });
  });

  it.each(["", "0123-4567-89AB-CDEF", "0123-4567-89AB-CDEF-GHJU", "0123-4567-89AB-CDEF-GHJK-0"])(
    "rejects malformed manual key %s",
    (input) => {
      expect(parsePairingKey(input).ok).toBe(false);
    },
  );

  it.each([
    "",
    "#room=abcdefghijklmnopqrstuv&secret=abcdefghijklmnopqrstuvwxyzABCDEF",
    "#key=0123456789ABCDEFGHJK&extra=no",
    "#key=0123456789ABCDEFGHJK&key=0123456789ABCDEFGHJK",
    "#key=too-short",
  ])("rejects malformed fragment %s", (fragment) => {
    expect(parsePairingKeyFragment(fragment).ok).toBe(false);
  });
});
