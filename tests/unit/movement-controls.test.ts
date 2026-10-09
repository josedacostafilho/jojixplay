import { afterEach, expect, it, vi } from "vitest";
import { mountMovementControls } from "@jojixplay/game-sdk";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function oneButton() {
  const root = document.createElement("main");
  const button = document.createElement("button");
  root.append(button);
  document.body.append(root);
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: (): Element => button,
  });
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 20, 60, 60));
  const click = vi.fn();
  button.onclick = click;
  const controls = mountMovementControls(root);
  const point = (x: number) => [{ key: "hand", x, y: 40 }];
  return { root, button, click, controls, point };
}

it("does not fire a button that appears under a resting hand, fires once per hold, and isolates modal choices", () => {
  const { root, click, controls, point } = oneButton();
  // The hand is already there when the buttons appear: it must leave first.
  controls.update(point(40), 0);
  controls.update(point(40), 1000);
  expect(click).not.toHaveBeenCalled();
  controls.update(point(10), 1010);
  controls.update(point(40), 1020);
  controls.update(point(40), 1700);
  expect(click).not.toHaveBeenCalled();
  controls.update(point(40), 1820);
  expect(click).toHaveBeenCalledOnce();
  // Staying on the button it just chose does not choose it again.
  controls.update(point(40), 3000);
  controls.update(point(40), 4000);
  expect(click).toHaveBeenCalledOnce();
  const dialog = document.createElement("dialog");
  dialog.open = true;
  root.append(dialog);
  controls.update(point(10), 4010);
  controls.update(point(40), 4020);
  controls.update(point(40), 5020);
  expect(click).toHaveBeenCalledOnce();
  controls.dispose();
  expect(document.querySelector(".movement-pointer")).toBeNull();
});

it("keeps a hold going through a moment of lost tracking and forgets it after a long loss", () => {
  const { button, click, controls, point } = oneButton();
  controls.update(point(10), 0);
  controls.update(point(40), 1000);
  controls.update(point(40), 1300);
  // The camera loses the hand, and with it everyone, for a few frames.
  controls.update([], 1350);
  expect(button.style.getPropertyValue("--dwell")).not.toBe("");
  controls.update(point(40), 1600);
  expect(click).not.toHaveBeenCalled();
  controls.update(point(40), 1800);
  expect(click).toHaveBeenCalledOnce();

  // Gone for longer, the hold is dropped; a fresh one then takes the full time.
  controls.update(point(10), 3000);
  controls.update(point(40), 3010);
  controls.update(point(40), 3400);
  controls.update([], 3900);
  expect(button.style.getPropertyValue("--dwell")).toBe("");
  controls.update(point(40), 4000);
  controls.update(point(40), 4700);
  expect(click).toHaveBeenCalledOnce();
  controls.update(point(40), 4800);
  expect(click).toHaveBeenCalledTimes(2);
  controls.dispose();
});

it("lets a hand raised straight onto a button hold it without first being seen elsewhere", () => {
  const { click, controls, point } = oneButton();
  // The buttons have been there a while; the hand comes into view already on one.
  controls.update([], 0);
  controls.update([], 1000);
  controls.update(point(40), 1010);
  controls.update(point(40), 1700);
  expect(click).not.toHaveBeenCalled();
  controls.update(point(40), 1810);
  expect(click).toHaveBeenCalledOnce();
  controls.dispose();
});

it("gives a player's hand only that player's controls and selects the button drawn on top", () => {
  const root = document.createElement("main");
  const covered = document.createElement("button");
  root.append(covered);
  const row = document.createElement("div");
  row.dataset.player = "1";
  const owned = document.createElement("button");
  row.append(owned);
  root.append(row);
  document.body.append(root);
  let top: Element = owned;
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => top });
  vi.spyOn(covered, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 200, 200));
  vi.spyOn(owned, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 20, 60, 60));
  const click = vi.fn();
  owned.onclick = click;
  covered.onclick = () => {
    throw new Error("A covered button was activated.");
  };
  const controls = mountMovementControls(root);
  const dwell = (player: number, start: number) => {
    controls.update([{ key: "hand", x: 300, y: 40, player }], start);
    controls.update([{ key: "hand", x: 40, y: 40, player }], start + 10);
    controls.update([{ key: "hand", x: 40, y: 40, player }], start + 900);
  };
  dwell(0, 0);
  expect(click).not.toHaveBeenCalled();
  top = document.body;
  dwell(1, 1000);
  expect(click).not.toHaveBeenCalled();
  top = owned;
  dwell(1, 2000);
  expect(click).toHaveBeenCalledOnce();
  controls.dispose();
});

it("honours a button's own hold time and keeps activating a repeating button while held", () => {
  const root = document.createElement("main");
  const slow = document.createElement("button");
  slow.dataset.dwellMs = "2000";
  const turn = document.createElement("button");
  turn.dataset.dwellRepeatMs = "500";
  root.append(slow, turn);
  document.body.append(root);
  let top: Element = slow;
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => top });
  vi.spyOn(slow, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 50, 50));
  vi.spyOn(turn, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 0, 50, 50));
  const slowClick = vi.fn();
  const turnClick = vi.fn();
  slow.onclick = slowClick;
  turn.onclick = turnClick;
  const controls = mountMovementControls(root);
  const at = (x: number, now: number) => controls.update([{ key: "hand", x, y: 25 }], now);
  at(75, 0);
  at(25, 10);
  at(25, 1900);
  expect(slowClick).not.toHaveBeenCalled();
  at(25, 2010);
  expect(slowClick).toHaveBeenCalledOnce();
  top = turn;
  at(75, 3000);
  at(125, 3010);
  at(125, 3810);
  expect(turnClick).toHaveBeenCalledTimes(1);
  at(125, 4200);
  expect(turnClick).toHaveBeenCalledTimes(1);
  at(125, 4310);
  at(125, 4810);
  expect(turnClick).toHaveBeenCalledTimes(3);
  controls.dispose();
});
