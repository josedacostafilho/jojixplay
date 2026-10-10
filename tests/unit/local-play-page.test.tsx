import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { lensNames } from "../../apps/jojixplay/src/components/lens-step";
import { LocalPlayPage } from "../../apps/jojixplay/src/pages/local-play-page";
import { FrameChannel } from "../../apps/jojixplay/src/pose/frame-source";
import type { CameraPoseLifecycle } from "../../apps/jojixplay/src/pose/use-camera-pose";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  immersiveStop: vi.fn(),
  setPoseLimit: vi.fn(),
  setSensing: vi.fn(),
  setLens: vi.fn(),
}));
let camera: CameraPoseLifecycle;
/** Mounts the page and, when the camera is already on, takes the adult's last touch step. */
function open() {
  const view = render(<LocalPlayPage />);
  const done = screen.queryByRole("button", { name: "Começar" });
  if (done) fireEvent.click(done);
  return view;
}
vi.mock("../../apps/jojixplay/src/pose/use-camera-pose", () => ({ useCameraPose: () => camera }));
vi.mock("../../apps/jojixplay/src/components/game-view", () => ({
  GameView: ({
    players,
    game,
    onExit,
    onFailed,
    onSense,
    onShowCamera,
  }: {
    players: 1 | 2;
    game: string;
    onExit: () => void;
    onFailed: () => void;
    onSense: (sensing: "hands") => Promise<void>;
    onShowCamera: (visible: boolean) => void;
  }) => (
    <div data-testid={game === "desenhar" ? "drawing" : "racing"}>
      {players} pessoas
      <button type="button" onClick={onExit}>
        game exit
      </button>
      <button type="button" onClick={onFailed}>
        game failure
      </button>
      <button type="button" onClick={() => void onSense("hands")}>
        game senses hands
      </button>
      <button type="button" onClick={() => onShowCamera(true)}>
        game shows camera
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
    frames: new FrameChannel(),
    normalization: null,
    poseLimit: 1,
    errorMessage: null,
    videoRef: { current: null },
    start: mocks.start.mockResolvedValue(undefined),
    stop: mocks.stop,
    setPoseLimit: mocks.setPoseLimit.mockResolvedValue(undefined),
    setSensing: mocks.setSensing.mockResolvedValue(undefined),
    lenses: [
      { id: "a", label: "camera 1, facing front" },
      { id: "b", label: "camera 2, facing back" },
      { id: "c", label: "camera 0, facing back" },
    ],
    lensId: "a",
    setLens: mocks.setLens.mockReset().mockResolvedValue(undefined),
  };
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, "elementFromPoint");
  vi.useRealTimers();
});
it("requires touch to start, states the camera privacy and cleans up on unmount", async () => {
  const view = open();
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
  open();
  fireEvent.click(screen.getByRole("button", { name: "Jogar Desenhar" }));
  fireEvent.click(screen.getByRole("button", { name: "2 pessoas" }));
  await act(async () => {});
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível preparar as pessoas");
  expect(screen.getByRole("button", { name: "2 pessoas" })).toBeEnabled();
});

it("cancels startup and releases the camera and immersive state", () => {
  const view = open();
  fireEvent.click(screen.getByRole("button", { name: "Ligar a câmera" }));
  camera = { ...camera, state: "starting" };
  view.rerender(<LocalPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(mocks.immersiveStop).toHaveBeenCalled();
});

it("releases immersive state when the camera fails", () => {
  const view = open();
  fireEvent.click(screen.getByRole("button", { name: "Ligar a câmera" }));
  expect(mocks.immersiveStop).not.toHaveBeenCalled();
  camera = { ...camera, state: "error", errorMessage: "O acesso à câmera foi negado." };
  view.rerender(<LocalPlayPage />);
  expect(mocks.immersiveStop).toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("O acesso à câmera foi negado.");
});

it("returns to the menu when a game exits, and reports a game that cannot open", async () => {
  camera = { ...camera, state: "tracking" };
  open();
  fireEvent.click(screen.getByRole("button", { name: "Próximo jogo" }));
  fireEvent.click(screen.getByRole("button", { name: "Jogar Corrida dos Blocos" }));
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "game exit" }));
  expect(screen.queryByTestId("racing")).not.toBeInTheDocument();
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Próximo jogo" }));
  fireEvent.click(screen.getByRole("button", { name: "Jogar Corrida dos Blocos" }));
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "game failure" }));
  await act(async () => {});
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir Corrida dos Blocos");
  expect(screen.getByRole("button", { name: "Jogar Desenhar" })).toBeEnabled();
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
  const view = open();
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
  open();
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
  const view = open();
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
  const view = open();
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
  // A new session begins with the adult's touch step again.
  fireEvent.click(screen.getByRole("button", { name: "Começar" }));
  expect(screen.getByRole("button", { name: "Jogar Desenhar" })).toBeVisible();
});

it("gives a game the sensing and camera image it asks for, and the menu its bodies back", async () => {
  camera = { ...camera, state: "tracking" };
  let restore: () => void = () => {};
  const view = open();
  const backdrop = () => view.container.querySelector(".camera-backdrop--visible");
  fireEvent.click(screen.getByRole("button", { name: "Próximo jogo" }));
  fireEvent.click(screen.getByRole("button", { name: "Jogar Corrida dos Blocos" }));
  await act(async () => {});

  fireEvent.click(screen.getByRole("button", { name: "game senses hands" }));
  expect(mocks.setSensing).toHaveBeenLastCalledWith("hands");
  camera = {
    ...camera,
    normalization: {
      source: { width: 1280, height: 720 },
      rotation: 0,
      frame: { width: 1280, height: 720, layout: "landscape", epoch: 0 },
      screen: { type: "landscape-primary", layout: "landscape", angle: 0 },
    },
  };
  view.rerender(<LocalPlayPage />);
  expect(backdrop()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "game shows camera" }));
  expect(backdrop()).not.toBeNull();

  mocks.setSensing.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        restore = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "game exit" }));
  expect(mocks.setSensing).toHaveBeenLastCalledWith("body");
  // No game opens until the menu is sensing bodies again.
  expect(screen.getByRole("button", { name: "Jogar Desenhar" })).toBeDisabled();
  await act(async () => {
    restore();
  });
  expect(screen.getByRole("button", { name: "Jogar Desenhar" })).toBeEnabled();
});

it("ends the session the moment the page is hidden, and only then", () => {
  camera = { ...camera, state: "tracking" };
  open();
  const visibility = vi.spyOn(document, "visibilityState", "get");

  visibility.mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(mocks.stop).not.toHaveBeenCalled();

  visibility.mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(mocks.immersiveStop).toHaveBeenCalled();
});

it("lets the adult try each camera by touch before the menu appears, and says when one will not open", async () => {
  camera = { ...camera, state: "tracking" };
  render(<LocalPlayPage />);
  // Nothing is operated by movement until the adult is done.
  expect(screen.queryByRole("button", { name: "Jogar Desenhar" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Frente 1" })).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: "Trás 1" }));
  expect(mocks.setLens).toHaveBeenCalledWith({ id: "b", label: "camera 2, facing back" });
  await act(async () => {});

  mocks.setLens.mockRejectedValueOnce(new Error("refused"));
  fireEvent.click(screen.getByRole("button", { name: "Trás 2" }));
  await act(async () => {});
  expect(screen.getByRole("alert")).toHaveTextContent("Essa câmera não pôde ser aberta");

  fireEvent.click(screen.getByRole("button", { name: "Começar" }));
  expect(screen.getByRole("button", { name: "Jogar Desenhar" })).toBeEnabled();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("names cameras by side and order, since phones do not say how wide each one sees", () => {
  const named = (labels: string[]) =>
    lensNames(labels.map((label, id) => ({ id: `${id}`, label })));
  expect(
    named([
      "camera 1, facing front",
      "camera 3, facing front",
      "camera 2, facing back",
      "camera 0, facing back",
    ]),
  ).toEqual(["Frente 1", "Frente 2", "Trás 1", "Trás 2"]);
  expect(named(["Back Ultra Wide Camera", "FaceTime HD", ""])).toEqual([
    "Trás 1",
    "Câmera 1",
    "Câmera 2",
  ]);
});
