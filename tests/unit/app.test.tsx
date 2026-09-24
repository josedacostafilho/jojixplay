import { act, cleanup, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useEffect } from "preact/hooks";
import { App } from "../../src/app";

const lifecycle = vi.hoisted(() => ({ mount: vi.fn(), stop: vi.fn() }));
vi.mock("../../src/pages/local-play-page", () => ({
  LocalPlayPage: () => {
    useEffect(() => {
      lifecycle.mount();
      return lifecycle.stop;
    }, []);
    return <button type="button">Start playing</button>;
  },
}));
let landscape: boolean;
let query: EventTarget;
let orientation: EventTarget & { type: string };
beforeEach(() => {
  lifecycle.mount.mockClear();
  lifecycle.stop.mockClear();
  landscape = false;
  query = new EventTarget();
  orientation = Object.assign(new EventTarget(), { type: "portrait-primary" });
  vi.stubGlobal("screen", { orientation });
  vi.stubGlobal("matchMedia", () => Object.assign(query, { matches: landscape }));
  history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("mounts play only in landscape and stops it immediately on portrait rotation", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Rotate your phone" })).toBeInTheDocument();
  expect(lifecycle.mount).not.toHaveBeenCalled();
  act(() => {
    landscape = true;
    orientation.type = "landscape-primary";
    orientation.dispatchEvent(new Event("change"));
  });
  expect(screen.getByRole("button", { name: "Start playing" })).toBeInTheDocument();
  expect(lifecycle.mount).toHaveBeenCalledOnce();
  act(() => {
    landscape = false;
    orientation.type = "portrait-primary";
    query.dispatchEvent(new Event("change"));
  });
  expect(lifecycle.stop).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Start playing" })).not.toBeInTheDocument();
});

it.each(["?mode=tv", "?mode=phone", "?mode=local", "#key=removed"])(
  "rejects obsolete link %s",
  (suffix) => {
    history.replaceState(null, "", `/${suffix}`);
    render(<App />);
    expect(screen.getByRole("alert")).toHaveTextContent("This link is invalid");
    expect(lifecycle.mount).not.toHaveBeenCalled();
  },
);
