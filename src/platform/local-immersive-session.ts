export class LocalImmersiveSession {
  private active = false;
  private wakeLock: WakeLockSentinel | null = null;
  private wakeLockAcquisition: Promise<void> | null = null;
  private ownsFullscreen = false;
  private ownsOrientation = false;
  private immersiveAcquisition: Promise<void> | null = null;

  public start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.immersiveAcquisition = this.enterFullscreen();
    this.requestWakeLock();
  }

  public async stop(): Promise<void> {
    this.active = false;
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    await this.immersiveAcquisition;
    if (this.ownsOrientation) {
      window.screen.orientation.unlock();
      this.ownsOrientation = false;
    }
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

  private async enterFullscreen(): Promise<void> {
    try {
      if (
        document.fullscreenElement === null &&
        typeof document.documentElement.requestFullscreen === "function"
      ) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        this.ownsFullscreen = true;
      }
    } catch {
      // Browser policy may deny fullscreen; the landscape gate remains mandatory.
    }
    if (!this.active) return;
    const orientation = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: "landscape") => Promise<void>;
    };
    try {
      if (typeof orientation?.lock === "function") {
        await orientation.lock("landscape");
        this.ownsOrientation = true;
      }
    } catch {
      // Native locking is optional. Portrait always unmounts and stops play.
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
