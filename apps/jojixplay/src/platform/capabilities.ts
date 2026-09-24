export interface CapabilityReport {
  supported: boolean;
  missing: string[];
}

function hasWebGl2(): boolean {
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return context !== null;
  } catch {
    return false;
  }
}

function report(checks: Array<[string, boolean]>): CapabilityReport {
  const missing = checks.filter(([, supported]) => !supported).map(([name]) => name);
  return { supported: missing.length === 0, missing };
}

function secureContextChecks(): Array<[string, boolean]> {
  return [["a secure browsing context", window.isSecureContext]];
}

function cameraChecks(): Array<[string, boolean]> {
  return [
    ["camera access", typeof navigator.mediaDevices?.getUserMedia === "function"],
    ["WebAssembly", typeof WebAssembly !== "undefined"],
    ["WebGL 2", hasWebGl2()],
    ["module workers", typeof Worker !== "undefined"],
    ["ImageBitmap transfer", typeof createImageBitmap === "function"],
    ["video-frame callbacks", "requestVideoFrameCallback" in HTMLVideoElement.prototype],
    [
      "screen orientation",
      typeof window.screen.orientation?.type === "string" &&
        typeof window.screen.orientation?.angle === "number",
    ],
  ];
}

function playfieldChecks(): Array<[string, boolean]> {
  return [
    ["responsive scene sizing", typeof ResizeObserver !== "undefined"],
    ["worker GPU canvas", typeof OffscreenCanvas !== "undefined"],
  ];
}

export function inspectLocalPlayCapabilities(): CapabilityReport {
  return report([...secureContextChecks(), ...cameraChecks(), ...playfieldChecks()]);
}
