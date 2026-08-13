import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app";
import { LandingPage } from "../../src/pages/landing-page";
import { PhonePairingPage } from "../../src/pages/phone-pairing-page";
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

  it("offers manual pairing when a phone route has no QR credential", () => {
    window.history.replaceState(null, "", "/?role=phone");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Enter the key from your TV." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "TV pairing key" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start body tracking/ })).not.toBeInTheDocument();
  });

  it("normalizes and submits a manually entered pairing key", () => {
    const onPair = vi.fn();
    render(<PhonePairingPage initialError={null} onPair={onPair} />);

    fireEvent.input(screen.getByRole("textbox", { name: "TV pairing key" }), {
      target: { value: "m7pkj3tdw9hxq4fv6r2c" },
    });
    expect(screen.getByRole("textbox", { name: "TV pairing key" })).toHaveValue(
      "M7PK-J3TD-W9HX-Q4FV-6R2C",
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect to TV" }));

    expect(onPair).toHaveBeenCalledWith("M7PKJ3TDW9HXQ4FV6R2C");
  });

  it("keeps a malformed QR fragment on the manual recovery path", () => {
    window.history.replaceState(null, "", "/?role=phone#key=too-short");
    render(<App />);

    expect(screen.getByRole("textbox", { name: "TV pairing key" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter the 20-character pairing key shown on your TV.",
    );
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
