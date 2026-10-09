import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocalPlayPage } from "../../apps/jojixplay/src/pages/local-play-page";
import { BodyFrameChannel } from "../../apps/jojixplay/src/pose/body-frame-source";
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
  GameView: ({
    players,
    game,
    onExit,
    onFailed,
  }: {
    players: 1 | 2;
    game: string;
    onExit: () => void;
    onFailed: () => void;
  }) => (
    <div data-testid={game === "desenhar" ? "drawing" : "racing"}>
      {players} pessoas
      <button type="button" onClick={onExit}>
        game exit
      </button>
      <button type="button" onClick={onFailed}>
        game failure
      </button>
    </div>
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
    frames: new BodyFrameChannel(),
    normalization: null,
    poseLimit: 1,
    errorMessage: null,
    videoRef: { current: null },
    start: mocks.start.mockResolvedValue(undefined),
    stop: mocks.stop,
    setPoseLimit: mocks.setPoseLimit.mockResolvedValue(undefined),
  };
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, "elementFromPoint");
  vi.useRealTimers();
});
it("requires touch to start, states the camera privacy and cleans up on unmount", async () => {
  const view = render(<LocalPlayPage />);
  expect(mocks.start).not.toHaveBeenCalled();
  expect(screen.getByText(/Nada é gravado nem enviado/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ligar a câmera" }));
  await act(async () => {});
  expect(mocks.start).toHaveBeenCalledOnce();
  view.unmount();

  expect(mocks.immersiveStop).toHaveBeenCalled();
});
it("reports a rejected player-mode change and retains the applied setting", async () => {
  camera = { ...camera, state: "tracking" };
  mocks.setPoseLimit.mockRejectedValue(new Error("Camera stopped"));
  render(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Jogar Desenhar" }));
  fireEvent.click(screen.getByRole("button", { name: "2 pessoas" }));
  await act(async () => {});
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível preparar as pessoas");
  expect(screen.getByRole("button", { name: "2 pessoas" })).toBeEnabled();
});

it("cancels startup and releases the camera and immersive state", () => {
  const view = render(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Ligar a câmera" }));
  camera = { ...camera, state: "starting" };
  view.rerender(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(mocks.immersiveStop).toHaveBeenCalled();
});

it("releases immersive state when the camera fails", () => {
  const view = render(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Ligar a câmera" }));
  expect(mocks.immersiveStop).not.toHaveBeenCalled();
  camera = { ...camera, state: "error", errorMessage: "O acesso à câmera foi negado." };
  view.rerender(<LocalPlayPage />);
  expect(mocks.immersiveStop).toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("O acesso à câmera foi negado.");
});

it("returns to the menu when a game exits, and reports a game that cannot open", async () => {
  camera = { ...camera, state: "tracking" };
  render(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Próximo jogo" }));
  fireEvent.click(screen.getByRole("button", { name: "Jogar Corrida dos Blocos" }));
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "game exit" }));
  expect(screen.queryByTestId("racing")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Próximo jogo" }));
  fireEvent.click(screen.getByRole("button", { name: "Jogar Corrida dos Blocos" }));
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "game failure" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir Corrida dos Blocos");
  expect(screen.getByRole("button", { name: /^Jogar / })).toBeEnabled();
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
  fireEvent.click(screen.getByRole("button", { name: "Jogar Desenhar" }));
  fireEvent.click(screen.getByRole("button", { name: "2 pessoas" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Jogar Desenhar" }));
  fireEvent.click(screen.getByRole("button", { name: "1 pessoa" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Próximo jogo" }));
  fireEvent.click(screen.getByRole("button", { name: "Jogar Corrida dos Blocos" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Próximo jogo" }));
  fireEvent.click(screen.getByRole("button", { name: "Jogar Corrida dos Blocos" }));
  camera = { ...camera, state: "error" };
  view.rerender(<LocalPlayPage />);
  await act(async () => {
    apply();
  });
  camera = { ...camera, state: "tracking", poseLimit: 1 };
  view.rerender(<LocalPlayPage />);
  expect(screen.queryByTestId("racing")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Jogar / })).toBeVisible();
});
