export class LocalImmersiveSession {
  private active = false;
  private wakeLock: WakeLockSentinel | null = null;
  private wakeLockAcquisition: Promise<void> | null = null;
  private ownsFullscreen = false;

  public start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.requestFullscreen();
    this.requestWakeLock();
  }

  public async stop(): Promise<void> {
    this.active = false;
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    await this.wakeLockAcquisition;
    await this.releaseWakeLock();
    if (this.ownsFullscreen && document.fullscreenElement !== null) {
      try {
        await document.exitFullscreen();
      } catch {
        // Fullscreen is optional; cleanup still continues when the browser rejects exit.
      }
    }
    this.ownsFullscreen = false;
  }

  private readonly handleVisibilityChange = () => {
    if (!this.active) {
      return;
    }
    if (document.visibilityState === "visible") {
      this.requestWakeLock();
    } else {
      void this.releaseWakeLock();
    }
  };

  private requestFullscreen(): void {
    const requestFullscreen = document.documentElement.requestFullscreen;
    if (document.fullscreenElement !== null || typeof requestFullscreen !== "function") {
      return;
    }
    try {
      void Promise.resolve(
        requestFullscreen.call(document.documentElement, { navigationUI: "hide" }),
      ).then(
        () => {
          if (this.active) {
            this.ownsFullscreen = true;
          } else if (document.fullscreenElement !== null) {
            void document.exitFullscreen().catch(() => undefined);
          }
        },
        () => undefined,
      );
    } catch {
      // Fullscreen is optional and must never block local camera startup.
    }
  }

  private requestWakeLock(): void {
    if (
      !this.active ||
      document.visibilityState !== "visible" ||
      this.wakeLock !== null ||
      this.wakeLockAcquisition !== null ||
      !("wakeLock" in navigator)
    ) {
      return;
    }
    const acquisition = this.acquireWakeLock();
    this.wakeLockAcquisition = acquisition;
    void acquisition.finally(() => {
      if (this.wakeLockAcquisition === acquisition) {
        this.wakeLockAcquisition = null;
      }
    });
  }

  private async acquireWakeLock(): Promise<void> {
    try {
      const wakeLock = await navigator.wakeLock.request("screen");
      if (!this.active || document.visibilityState !== "visible") {
        await wakeLock.release();
        return;
      }
      this.wakeLock = wakeLock;
      wakeLock.addEventListener(
        "release",
        () => {
          if (this.wakeLock === wakeLock) {
            this.wakeLock = null;
          }
        },
        { once: true },
      );
    } catch {
      // Screen Wake Lock is an optional enhancement and can be policy-rejected.
    }
  }

  private async releaseWakeLock(): Promise<void> {
    const wakeLock = this.wakeLock;
    this.wakeLock = null;
    if (wakeLock === null || wakeLock.released) {
      return;
    }
    try {
      await wakeLock.release();
    } catch {
      // A best-effort wake lock may already have been revoked by the browser.
    }
  }
}
