export class LatestOnlySender<T> {
  private inFlight = false;
  private pending: T | undefined;
  private disposed = false;

  public constructor(
    private readonly send: (value: T) => Promise<void>,
    private readonly onError: (error: unknown) => void,
  ) {}

  public push(value: T): void {
    if (this.disposed) {
      return;
    }
    if (this.inFlight) {
      this.pending = value;
      return;
    }
    this.run(value);
  }

  public dispose(): void {
    this.disposed = true;
    this.pending = undefined;
  }

  private run(value: T): void {
    this.inFlight = true;
    void this.send(value)
      .catch((error: unknown) => {
        if (!this.disposed) {
          this.onError(error);
        }
      })
      .finally(() => {
        this.inFlight = false;
        if (this.disposed || this.pending === undefined) {
          return;
        }
        const next = this.pending;
        this.pending = undefined;
        this.run(next);
      });
  }
}
