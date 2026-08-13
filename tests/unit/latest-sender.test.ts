import { describe, expect, it, vi } from "vitest";
import { LatestOnlySender } from "../../src/transport/latest-sender";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("LatestOnlySender", () => {
  it("keeps only the newest packet while a send is in flight", async () => {
    const first = deferred();
    const sent: number[] = [];
    const send = vi.fn((value: number) => {
      sent.push(value);
      return value === 1 ? first.promise : Promise.resolve();
    });
    const onError = vi.fn();
    const sender = new LatestOnlySender(send, onError);

    sender.push(1);
    sender.push(2);
    sender.push(3);
    expect(sent).toEqual([1]);

    first.resolve();
    await vi.waitFor(() => expect(sent).toEqual([1, 3]));
    expect(onError).not.toHaveBeenCalled();
  });

  it("drops pending work after disposal", async () => {
    const first = deferred();
    const send = vi.fn(() => first.promise);
    const sender = new LatestOnlySender(send, vi.fn());

    sender.push(1);
    sender.push(2);
    sender.dispose();
    first.resolve();
    await first.promise;
    await Promise.resolve();

    expect(send).toHaveBeenCalledTimes(1);
  });
});
