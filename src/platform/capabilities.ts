export interface CapabilityReport {
  supported: boolean;
  missing: string[];
}

function hasWebGl2(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

function report(checks: Array<[string, boolean]>): CapabilityReport {
  const missing = checks.filter(([, supported]) => !supported).map(([name]) => name);
  return { supported: missing.length === 0, missing };
}

function sharedChecks(): Array<[string, boolean]> {
  return [
    ["a secure browsing context", window.isSecureContext],
    [
      "Web Crypto",
      typeof globalThis.crypto?.getRandomValues === "function" &&
        globalThis.crypto.subtle !== undefined,
    ],
    ["WebSockets", typeof WebSocket !== "undefined"],
    ["WebRTC DataChannels", typeof RTCPeerConnection !== "undefined"],
  ];
}

export function inspectPhoneCapabilities(): CapabilityReport {
  return report([
    ...sharedChecks(),
    ["camera access", typeof navigator.mediaDevices?.getUserMedia === "function"],
    ["WebAssembly", typeof WebAssembly !== "undefined"],
    ["WebGL 2", hasWebGl2()],
    ["module workers", typeof Worker !== "undefined"],
    ["ImageBitmap transfer", typeof createImageBitmap === "function"],
    ["video-frame callbacks", "requestVideoFrameCallback" in HTMLVideoElement.prototype],
  ]);
}

export function inspectTvCapabilities(): CapabilityReport {
  const context = document.createElement("canvas").getContext("2d");
  return report([
    ...sharedChecks(),
    ["Canvas 2D", context !== null],
    ["responsive canvas sizing", typeof ResizeObserver !== "undefined"],
  ]);
}
