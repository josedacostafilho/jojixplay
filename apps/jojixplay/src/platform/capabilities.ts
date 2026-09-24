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
  return [["conexão segura", window.isSecureContext]];
}

function cameraChecks(): Array<[string, boolean]> {
  return [
    ["acesso à câmera", typeof navigator.mediaDevices?.getUserMedia === "function"],
    ["WebAssembly", typeof WebAssembly !== "undefined"],
    ["WebGL 2", hasWebGl2()],
    ["processamento em segundo plano", typeof Worker !== "undefined"],
    ["transferência de imagens", typeof createImageBitmap === "function"],
    ["sincronização da câmera", "requestVideoFrameCallback" in HTMLVideoElement.prototype],
    [
      "orientação da tela",
      typeof window.screen.orientation?.type === "string" &&
        typeof window.screen.orientation?.angle === "number",
    ],
  ];
}

function playfieldChecks(): Array<[string, boolean]> {
  return [
    ["ajuste da cena à tela", typeof ResizeObserver !== "undefined"],
    ["gráficos em segundo plano", typeof OffscreenCanvas !== "undefined"],
  ];
}

export function inspectLocalPlayCapabilities(): CapabilityReport {
  return report([...secureContextChecks(), ...cameraChecks(), ...playfieldChecks()]);
}
