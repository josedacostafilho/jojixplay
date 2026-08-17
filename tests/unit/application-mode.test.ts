import { describe, expect, it } from "vitest";
import { applicationModeUrl, parseApplicationMode } from "../../src/platform/application-mode";

describe("application mode routing", () => {
  it.each([
    ["", null],
    ["?mode=tv", "tv"],
    ["?mode=phone", "phone"],
    ["?mode=local", "local"],
  ] as const)("parses %s as the one current mode", (search, expected) => {
    expect(parseApplicationMode(search)).toEqual({ ok: true, value: expected });
  });

  it.each([
    "?role=tv",
    "?role=phone",
    "?mode=phone&mode=phone",
    "?mode=local&debug=true",
    "?mode=unknown",
    "?mode=LOCAL",
  ])("rejects malformed, obsolete, or unknown query %s", (search) => {
    expect(parseApplicationMode(search).ok).toBe(false);
  });

  it("builds one canonical mode URL and removes prior query and fragment state", () => {
    window.history.replaceState(null, "", "/jojixplay/?role=tv#key=secret");

    expect(new URL(applicationModeUrl("local"))).toMatchObject({
      pathname: "/jojixplay/",
      search: "?mode=local",
      hash: "",
    });
    expect(new URL(applicationModeUrl(null))).toMatchObject({
      pathname: "/jojixplay/",
      search: "",
      hash: "",
    });
  });
});
