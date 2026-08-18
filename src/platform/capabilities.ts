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

function secureContextChecks(): Array<[string, boolean]> {
  return [["a secure browsing context", window.isSecureContext]];
}

function peerChecks(): Array<[string, boolean]> {
  return [
    [
      "Web Crypto",
      typeof globalThis.crypto?.getRandomValues === "function" &&
        globalThis.crypto.subtle !== undefined,
    ],
    ["WebSockets", typeof WebSocket !== "undefined"],
    ["WebRTC DataChannels", typeof RTCPeerConnection !== "undefined"],
  ];
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
  const context = document.createElement("canvas").getContext("2d");
  return [
    ["Canvas 2D", context !== null],
    ["responsive canvas sizing", typeof ResizeObserver !== "undefined"],
  ];
}

function audioChecks(): Array<[string, boolean]> {
  return [
    [
      "Web Audio",
      typeof AudioContext === "function" &&
        typeof AudioContext.prototype.createGain === "function" &&
        typeof AudioContext.prototype.createOscillator === "function" &&
        typeof AudioContext.prototype.createStereoPanner === "function",
    ],
  ];
}

export function inspectPhoneControllerCapabilities(): CapabilityReport {
  return report([
    ...secureContextChecks(),
    ...peerChecks(),
    ...cameraChecks(),
    ...playfieldChecks(),
  ]);
}

export function inspectLocalPlayCapabilities(): CapabilityReport {
  return report([
    ...secureContextChecks(),
    ...cameraChecks(),
    ...playfieldChecks(),
    ...audioChecks(),
  ]);
}

export function inspectTvDisplayCapabilities(): CapabilityReport {
  return report([
    ...secureContextChecks(),
    ...peerChecks(),
    ...playfieldChecks(),
    ...audioChecks(),
  ]);
}
