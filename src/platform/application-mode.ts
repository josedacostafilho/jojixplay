export type ApplicationMode = "tv" | "phone" | "local";

export type ApplicationModeResult =
  | { ok: true; value: ApplicationMode | null }
  | { ok: false; error: string };

function isApplicationMode(value: string): value is ApplicationMode {
  return value === "tv" || value === "phone" || value === "local";
}

export function parseApplicationMode(search: string): ApplicationModeResult {
  const params = new URLSearchParams(search);
  const keys = [...params.keys()];
  if (keys.length === 0) {
    return { ok: true, value: null };
  }
  if (keys.length !== 1 || keys[0] !== "mode" || params.getAll("mode").length !== 1) {
    return { ok: false, error: "This application link is malformed or no longer supported." };
  }
  const mode = params.get("mode");
  if (mode === null || !isApplicationMode(mode)) {
    return { ok: false, error: "This application mode is not recognized." };
  }
  return { ok: true, value: mode };
}

export function applicationModeUrl(mode: ApplicationMode | null): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  if (mode !== null) {
    url.searchParams.set("mode", mode);
  }
  return url.toString();
}
