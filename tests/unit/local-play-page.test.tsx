import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocalPlayPage } from "../../apps/jojixplay/src/pages/local-play-page";
import type { CameraPoseLifecycle } from "../../apps/jojixplay/src/pose/use-camera-pose";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  immersiveStop: vi.fn(),
  setPoseLimit: vi.fn(),
}));
let camera: CameraPoseLifecycle;
vi.mock("../../apps/jojixplay/src/pose/use-camera-pose", () => ({ useCameraPose: () => camera }));
vi.mock("../../apps/jojixplay/src/components/game-view", () => ({
  GameView: ({ players, game }: { players: 1 | 2; game: string }) => (
    <div data-testid={game === "desenhar" ? "drawing" : "racing"}>{players} pessoas</div>
  ),
}));
vi.mock("../../apps/jojixplay/src/platform/capabilities", () => ({
  inspectLocalPlayCapabilities: () => ({ supported: true, missing: [] }),
}));
vi.mock("../../apps/jojixplay/src/platform/local-immersive-session", () => ({
  LocalImmersiveSession: class {
    start() {}
    stop() {
      mocks.immersiveStop();
      return Promise.resolve();
    }
  },
}));
beforeEach(() => {
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => null });
  camera = {
    state: "idle",
    packet: null,
    normalization: null,
    poseLimit: 1,
    errorMessage: null,
    videoRef: { current: null },
    start: mocks.start.mockResolvedValue(true),
    stop: mocks.stop,
    setPoseLimit: mocks.setPoseLimit.mockResolvedValue(undefined),
  };
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, "elementFromPoint");
  vi.useRealTimers();
});
it("requires touch to start, shows adult instructions and cleans up on unmount", async () => {
  const view = render(<LocalPlayPage />);
  expect(mocks.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Para os adultos" }));
  expect(screen.getByText(/Sua câmera aparece nos menus/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Vamos começar" }));
  await act(async () => {});
  expect(mocks.start).toHaveBeenCalledOnce();
  view.unmount();

  expect(mocks.immersiveStop).toHaveBeenCalled();
});
it("clears a fresh upper-body frame by capture age, without requiring hips", () => {
  vi.useFakeTimers();
  const now = performance.now();
  camera = {
    ...camera,
    state: "tracking",
    packet: {
      sequence: 1,
      capturedAtMs: now,
      frame: { width: 1280, height: 720, layout: "landscape", epoch: 0 },
      poses: [
        {
          landmarks: Array.from({ length: 33 }, (_, i) => ({
            x: 0.4,
            y: 0.3,
            z: 0,
            visibility: i === 15 ? 1 : 0,
          })),
        },
      ],
    },
  };
  render(<LocalPlayPage />);
  expect(screen.getByRole("status")).toHaveTextContent("Achamos você!");
  act(() => {
    vi.advanceTimersByTime(251);
  });
  expect(screen.getByRole("status")).toHaveTextContent("Mostre as mãos para o celular");
});
it("reports a rejected player-mode change and retains the applied setting", async () => {
  camera = { ...camera, state: "tracking" };
  mocks.setPoseLimit.mockRejectedValue(new Error("Camera stopped"));
  render(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Desenhar · 1 ou 2 pessoas" }));
  fireEvent.click(screen.getByRole("button", { name: "Desenhar em dupla" }));
  await act(async () => {});
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível preparar as pessoas");
  expect(screen.getByRole("button", { name: "Desenhar em dupla" })).toBeEnabled();
});

it("cancels startup without letting its late result stop a newer run", async () => {
  let finish: (started: boolean) => void = () => {
    throw new Error("Startup was not called");
  };
  mocks.start.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Vamos começar" }));
  camera = { ...camera, state: "starting" };
  view.rerender(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar abertura da câmera" }));
  expect(mocks.stop).toHaveBeenCalledOnce();
  camera = { ...camera, state: "idle" };
  view.rerender(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Vamos começar" }));
  await act(async () => {});
  const stops = mocks.immersiveStop.mock.calls.length;
  await act(async () => {
    finish(false);
  });
  expect(mocks.immersiveStop).toHaveBeenCalledTimes(stops);
});

it("enters solo directly and waits for two-person inference before opening a duo game", async () => {
  camera = { ...camera, state: "tracking" };
  let apply: () => void = () => {};
  mocks.setPoseLimit.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        apply = resolve;
      }),
  );
  const view = render(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Desenhar · 1 ou 2 pessoas" }));
  fireEvent.click(screen.getByRole("button", { name: "Desenhar em dupla" }));
  expect(mocks.setPoseLimit).toHaveBeenCalledWith(2);
  expect(screen.queryByTestId("drawing")).not.toBeInTheDocument();
  camera = { ...camera, poseLimit: 2 };
  await act(async () => {
    apply();
  });
  view.rerender(<LocalPlayPage />);
  expect(screen.getByTestId("drawing")).toHaveTextContent("2 pessoas");
  view.unmount();
  camera = { ...camera, poseLimit: 1 };
  render(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Desenhar · 1 ou 2 pessoas" }));
  fireEvent.click(screen.getByRole("button", { name: "Desenhar sozinho" }));
  await act(async () => {});
  expect(screen.getByTestId("drawing")).toHaveTextContent("1 pessoas");
});

it("waits for single-person inference before mounting Corrida after duo play", async () => {
  camera = { ...camera, state: "tracking", poseLimit: 2 };
  let apply: () => void = () => {};
  mocks.setPoseLimit.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        apply = resolve;
      }),
  );
  const view = render(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Corrida dos Blocos · 1 pessoa" }));
  expect(mocks.setPoseLimit).toHaveBeenCalledWith(1);
  expect(screen.queryByTestId("racing")).not.toBeInTheDocument();
  camera = { ...camera, poseLimit: 1 };
  await act(async () => {
    apply();
  });
  view.rerender(<LocalPlayPage />);
  expect(screen.getByTestId("racing")).toHaveTextContent("1 pessoas");
  camera = { ...camera, state: "error" };
  view.rerender(<LocalPlayPage />);
  await act(async () => {});
  expect(screen.queryByTestId("racing")).not.toBeInTheDocument();
});
it("does not mount a pending race after capture fails", async () => {
  camera = { ...camera, state: "tracking", poseLimit: 2 };
  let apply: () => void = () => {};
  mocks.setPoseLimit.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        apply = resolve;
      }),
  );
  const view = render(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Corrida dos Blocos · 1 pessoa" }));
  camera = { ...camera, state: "error" };
  view.rerender(<LocalPlayPage />);
  await act(async () => {
    apply();
  });
  camera = { ...camera, state: "tracking", poseLimit: 1 };
  view.rerender(<LocalPlayPage />);
  expect(screen.queryByTestId("racing")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Corrida dos Blocos · 1 pessoa" })).toBeVisible();
});
