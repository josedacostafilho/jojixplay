import { afterEach, expect, it, vi } from "vitest";
import { mountMovementControls } from "@jojixplay/game-sdk";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it("requires neutral input and a full fresh dwell, resets on loss and target replacement, and isolates modal choices", () => {
  const root = document.createElement("main");
  const button = document.createElement("button");
  root.append(button);
  document.body.append(root);
  const hit = vi.fn((): Element => button);
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: hit });
  vi.spyOn(button, "getClientRects").mockReturnValue(
    Object.assign([new DOMRect(20, 20, 60, 60)], { item: () => new DOMRect(20, 20, 60, 60) }),
  );
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 20, 60, 60));
  const click = vi.fn();
  button.onclick = click;
  const controls = mountMovementControls(root);
  const point = (x: number) => [{ key: "hand", x, y: 40 }];
  controls.update(point(40), 0);
  controls.update(point(40), 1000);
  expect(click).not.toHaveBeenCalled();
  controls.update(point(10), 1010);
  controls.update(point(40), 1020);
  controls.update(point(40), 1700);
  expect(click).not.toHaveBeenCalled();
  controls.update([], 1710);
  controls.update(point(40), 2000);
  controls.update(point(40), 3000);
  expect(click).not.toHaveBeenCalled();
  controls.update(point(10), 3010);
  controls.update(point(40), 3020);
  controls.update(point(40), 3820);
  expect(click).toHaveBeenCalledOnce();
  controls.update(point(40), 5000);
  controls.update(point(40), 6000);
  expect(click).toHaveBeenCalledOnce();
  const dialog = document.createElement("dialog");
  dialog.open = true;
  root.append(dialog);
  controls.update(point(10), 6010);
  controls.update(point(40), 6020);
  controls.update(point(40), 7020);
  expect(click).toHaveBeenCalledOnce();
  controls.dispose();
  expect(document.querySelector(".movement-pointer")).toBeNull();
});
