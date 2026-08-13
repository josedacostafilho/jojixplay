import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app";
import { LandingPage } from "../../src/pages/landing-page";
import { TvDisplay } from "../../src/pages/tv-display";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("entry pages", () => {
  it("offers television and phone roles", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: "Turn a phone and TV into a motion playground." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open on the TV/ })).toHaveAttribute(
      "href",
      expect.stringContaining("role=tv"),
    );
    expect(screen.getByRole("link", { name: /Open on the phone/ })).toHaveAttribute(
      "href",
      expect.stringContaining("role=phone"),
    );
  });

  it("rejects a phone route without credentials before requesting capabilities", () => {
    window.history.replaceState(null, "", "/?role=phone");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Open the link from your TV." }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start body tracking/ })).not.toBeInTheDocument();
  });

  it("blocks an unsupported television before generating session credentials", () => {
    vi.stubGlobal("isSecureContext", false);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<TvDisplay />);

    expect(
      screen.getByRole("heading", { name: "This television cannot run the prototype." }),
    ).toBeInTheDocument();
    expect(screen.getByText("a secure browsing context")).toBeInTheDocument();
  });
});
