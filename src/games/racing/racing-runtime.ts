import Phaser, {
  type Camera,
  type Container,
  type Graphics,
  type Text,
  type TextStyle,
} from "phaser-runtime";
import type { Size } from "../../render/geometry";
import { projectRacingObject, projectRacingRoad } from "./racing-projection";
import type { RacingCarSnapshot, RacingSession, RacingSnapshot } from "./racing-session";

export interface RacingRuntimeOptions {
  parent: HTMLElement;
  session: RacingSession;
  playerCount: 1 | 2;
  onReady: () => void;
  onSnapshot: (snapshot: RacingSnapshot) => void;
  onError: (message: string) => void;
}

interface ViewportLayer {
  slot: "solo" | "left" | "right";
  container: Container;
  graphics: Graphics;
  playerText: Text;
  metricText: Text;
  statusText: Text;
  camera: Camera;
}

const COLORS = {
  skyTop: 0x172554,
  skyBottom: 0xf97316,
  sun: 0xfef3c7,
  terrainLight: 0x2f855a,
  terrainDark: 0x276749,
  roadLight: 0x4b5563,
  roadDark: 0x3f4651,
  shoulderLight: 0xf8fafc,
  shoulderDark: 0xef4444,
  lane: 0xfef3c7,
  soloCar: 0x14b8a6,
  leftCar: 0x22d3ee,
  rightCar: 0xfb7185,
  glass: 0x172033,
  tire: 0x111827,
  tracking: 0x5eead4,
  missing: 0xfbbf24,
  treeTrunk: 0x713f12,
  treeCrown: 0x14532d,
} as const;

const HUD_STYLE: TextStyle = {
  color: "#f8fafc",
  fontFamily: "system-ui, sans-serif",
  fontSize: "20px",
  fontStyle: "bold",
  stroke: "#07101f",
  strokeThickness: 4,
};

const STATUS_STYLE: TextStyle = {
  align: "center",
  color: "#f8fafc",
  fontFamily: "system-ui, sans-serif",
  fontSize: "30px",
  fontStyle: "bold",
  stroke: "#07101f",
  strokeThickness: 6,
};

function colorForCar(car: RacingCarSnapshot): number {
  if (car.slot === "left") {
    return COLORS.leftCar;
  }
  if (car.slot === "right") {
    return COLORS.rightCar;
  }
  return COLORS.soloCar;
}

function formatTime(elapsedMs: number): string {
  const totalCentiseconds = Math.floor(Math.max(0, elapsedMs) / 10);
  const minutes = Math.floor(totalCentiseconds / 6_000);
  const seconds = Math.floor(totalCentiseconds / 100) % 60;
  const centiseconds = totalCentiseconds % 100;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function trapezoid(
  graphics: Graphics,
  color: number,
  nearLeft: number,
  nearRight: number,
  nearY: number,
  farLeft: number,
  farRight: number,
  farY: number,
  alpha = 1,
): void {
  graphics.fillStyle(color, alpha);
  graphics.beginPath();
  graphics.moveTo(nearLeft, nearY);
  graphics.lineTo(nearRight, nearY);
  graphics.lineTo(farRight, farY);
  graphics.lineTo(farLeft, farY);
  graphics.closePath();
  graphics.fillPath();
}

function drawCar(
  graphics: Graphics,
  centerX: number,
  baseY: number,
  width: number,
  color: number,
  steering: number,
  alpha = 1,
): void {
  const height = width * 0.58;
  const lean = steering * width * 0.06;
  const left = centerX - width / 2 + lean;
  const top = baseY - height;
  graphics.fillStyle(0x020617, 0.32 * alpha);
  graphics.fillEllipse(centerX, baseY + height * 0.04, width * 1.12, height * 0.24);
  graphics.fillStyle(COLORS.tire, alpha);
  graphics.fillRoundedRect(left - width * 0.07, top + height * 0.42, width * 0.17, height * 0.5, 5);
  graphics.fillRoundedRect(left + width * 0.9, top + height * 0.42, width * 0.17, height * 0.5, 5);
  graphics.fillStyle(color, alpha);
  graphics.fillRoundedRect(left, top + height * 0.25, width, height * 0.72, width * 0.12);
  graphics.fillTriangle(
    left + width * 0.18,
    top + height * 0.35,
    left + width * 0.34,
    top,
    left + width * 0.66,
    top,
  );
  graphics.fillTriangle(
    left + width * 0.82,
    top + height * 0.35,
    left + width * 0.66,
    top,
    left + width * 0.34,
    top,
  );
  graphics.fillStyle(COLORS.glass, 0.9 * alpha);
  graphics.fillRoundedRect(
    left + width * 0.28,
    top + height * 0.12,
    width * 0.44,
    height * 0.3,
    width * 0.05,
  );
  graphics.fillStyle(0xfef3c7, 0.95 * alpha);
  graphics.fillCircle(left + width * 0.18, top + height * 0.72, width * 0.055);
  graphics.fillCircle(left + width * 0.82, top + height * 0.72, width * 0.055);
}

function drawSteeringGauge(
  graphics: Graphics,
  car: RacingCarSnapshot,
  viewport: Size,
  prominent: boolean,
): void {
  const radius = prominent
    ? Math.min(viewport.width, viewport.height) * 0.105
    : Math.min(viewport.width, viewport.height) * 0.052;
  const outerSide = car.slot === "left" ? radius + 20 : viewport.width - radius - 20;
  const centerX = car.slot === "solo" ? viewport.width - radius - 24 : outerSide;
  const centerY = prominent ? viewport.height * 0.66 : viewport.height - radius - 22;
  const angle = car.steering * 0.48;
  const color = car.trackingAvailable ? COLORS.tracking : COLORS.missing;
  const alpha = prominent ? 0.9 : 0.48;
  graphics.lineStyle(Math.max(3, radius * 0.09), color, alpha);
  graphics.strokeCircle(centerX, centerY, radius);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const handRadius = radius * 0.88;
  const leftX = centerX - cosine * handRadius;
  const leftY = centerY - sine * handRadius;
  const rightX = centerX + cosine * handRadius;
  const rightY = centerY + sine * handRadius;
  graphics.beginPath();
  graphics.moveTo(leftX, leftY);
  graphics.lineTo(rightX, rightY);
  graphics.strokePath();
  graphics.fillStyle(color, alpha);
  graphics.fillCircle(leftX, leftY, Math.max(4, radius * 0.12));
  graphics.fillCircle(rightX, rightY, Math.max(4, radius * 0.12));
  graphics.fillCircle(centerX, centerY, Math.max(3, radius * 0.08));
}

function drawRoadsideTree(graphics: Graphics, x: number, y: number, scale: number): void {
  const height = Math.min(120, Math.max(4, scale * 4.2));
  if (height < 5) {
    return;
  }
  graphics.fillStyle(COLORS.treeTrunk, 0.92);
  graphics.fillRect(x - height * 0.07, y - height * 0.42, height * 0.14, height * 0.42);
  graphics.fillStyle(COLORS.treeCrown, 0.95);
  graphics.fillTriangle(
    x,
    y - height,
    x - height * 0.34,
    y - height * 0.32,
    x + height * 0.34,
    y - height * 0.32,
  );
}

class RacingScene extends Phaser.Scene {
  private layers: ViewportLayer[] = [];
  private lastSnapshotEmitAtMs = Number.NEGATIVE_INFINITY;
  private lastEmittedPhase: RacingSnapshot["phase"] | null = null;

  public constructor(private readonly runtimeOptions: RacingRuntimeOptions) {
    super({ key: "jojixplay-racing" });
  }

  public create(): void {
    if (this.game.renderer.type !== Phaser.CANVAS) {
      this.runtimeOptions.onError("Racing started with an unsupported renderer.");
      return;
    }
    this.createLayers();
    this.resizeLayers(this.game.scale.width, this.game.scale.height);
    this.runtimeOptions.onReady();
  }

  public override update(): void {
    const nowMs = performance.now();
    const snapshot = this.runtimeOptions.session.tick(nowMs);
    this.renderSnapshot(snapshot);
    if (snapshot.phase !== this.lastEmittedPhase || nowMs - this.lastSnapshotEmitAtMs >= 100) {
      this.lastEmittedPhase = snapshot.phase;
      this.lastSnapshotEmitAtMs = nowMs;
      this.runtimeOptions.onSnapshot(snapshot);
    }
  }

  public resizeLayers(width: number, height: number): void {
    if (this.layers.length === 0 || width <= 0 || height <= 0) {
      return;
    }
    const viewportWidth = this.runtimeOptions.playerCount === 2 ? width / 2 : width;
    for (const [index, layer] of this.layers.entries()) {
      layer.camera.setViewport(index * viewportWidth, 0, viewportWidth, height);
      layer.camera.setScroll(0, 0);
      layer.playerText.setPosition(18, 14);
      layer.metricText.setPosition(viewportWidth - 18, 14);
      layer.statusText.setPosition(viewportWidth / 2, height * 0.43);
      layer.statusText.setWordWrapWidth(viewportWidth * 0.82);
    }
  }

  private createLayers(): void {
    const slots =
      this.runtimeOptions.playerCount === 1 ? (["solo"] as const) : (["left", "right"] as const);
    for (const [index, slot] of slots.entries()) {
      const graphics = this.add.graphics();
      const playerText = this.add.text(0, 0, slot === "solo" ? "Solo" : slot, HUD_STYLE);
      const metricText = this.add.text(0, 0, "", { ...HUD_STYLE, align: "right" });
      metricText.setOrigin(1, 0);
      const statusText = this.add.text(0, 0, "", STATUS_STYLE);
      statusText.setOrigin(0.5, 0.5);
      const container = this.add.container(0, 0, [graphics, playerText, metricText, statusText]);
      const camera =
        index === 0 ? this.cameras.main : this.cameras.add(0, 0, 1, 1, false, `${slot}-camera`);
      camera.setBackgroundColor(COLORS.skyTop);
      this.layers.push({ slot, container, graphics, playerText, metricText, statusText, camera });
    }
    for (const layer of this.layers) {
      for (const other of this.layers) {
        if (other !== layer) {
          layer.camera.ignore(other.container);
        }
      }
    }
  }

  private renderSnapshot(snapshot: RacingSnapshot): void {
    const fullWidth = this.game.scale.width;
    const fullHeight = this.game.scale.height;
    const viewport: Size = {
      width: snapshot.playerCount === 2 ? fullWidth / 2 : fullWidth,
      height: fullHeight,
    };
    for (const layer of this.layers) {
      const car = snapshot.cars.find((candidate) => candidate.slot === layer.slot);
      if (car === undefined) {
        continue;
      }
      const opponent = snapshot.cars.find((candidate) => candidate.slot !== layer.slot);
      this.renderViewport(layer, snapshot, car, opponent ?? null, viewport);
    }
  }

  private renderViewport(
    layer: ViewportLayer,
    snapshot: RacingSnapshot,
    car: RacingCarSnapshot,
    opponent: RacingCarSnapshot | null,
    viewport: Size,
  ): void {
    const graphics = layer.graphics;
    graphics.clear();
    const road = projectRacingRoad(car, viewport);
    graphics.fillStyle(COLORS.skyTop, 1);
    graphics.fillRect(0, 0, viewport.width, road.horizonY);
    graphics.fillStyle(COLORS.skyBottom, 0.82);
    graphics.fillRect(0, road.horizonY * 0.56, viewport.width, road.horizonY * 0.44);
    graphics.fillStyle(COLORS.sun, 0.72);
    graphics.fillCircle(viewport.width * 0.76, road.horizonY * 0.54, viewport.height * 0.055);

    for (let index = road.slices.length - 1; index >= 0; index -= 1) {
      const slice = road.slices[index];
      if (slice === undefined) {
        continue;
      }
      const terrain = slice.alternating ? COLORS.terrainLight : COLORS.terrainDark;
      const roadColor = slice.alternating ? COLORS.roadLight : COLORS.roadDark;
      graphics.fillStyle(terrain, 1);
      graphics.fillRect(
        0,
        slice.far.y,
        viewport.width,
        Math.max(0, slice.near.y - slice.far.y + 1),
      );
      const nearShoulder = slice.near.roadHalfWidth * 1.14;
      const farShoulder = slice.far.roadHalfWidth * 1.14;
      trapezoid(
        graphics,
        slice.alternating ? COLORS.shoulderLight : COLORS.shoulderDark,
        slice.near.centerX - nearShoulder,
        slice.near.centerX + nearShoulder,
        slice.near.y,
        slice.far.centerX - farShoulder,
        slice.far.centerX + farShoulder,
        slice.far.y,
      );
      trapezoid(
        graphics,
        roadColor,
        slice.near.centerX - slice.near.roadHalfWidth,
        slice.near.centerX + slice.near.roadHalfWidth,
        slice.near.y,
        slice.far.centerX - slice.far.roadHalfWidth,
        slice.far.centerX + slice.far.roadHalfWidth,
        slice.far.y,
      );
      if (slice.alternating || slice.finish) {
        const laneWidthNear = Math.max(1, slice.near.roadHalfWidth * 0.014);
        const laneWidthFar = Math.max(0.5, slice.far.roadHalfWidth * 0.014);
        for (const lane of [-1 / 3, 1 / 3]) {
          const nearX = slice.near.centerX + slice.near.roadHalfWidth * lane;
          const farX = slice.far.centerX + slice.far.roadHalfWidth * lane;
          trapezoid(
            graphics,
            slice.finish ? 0xffffff : COLORS.lane,
            nearX - laneWidthNear,
            nearX + laneWidthNear,
            slice.near.y,
            farX - laneWidthFar,
            farX + laneWidthFar,
            slice.far.y,
            0.9,
          );
        }
      }
      if (slice.finish) {
        trapezoid(
          graphics,
          0xffffff,
          slice.near.centerX - slice.near.roadHalfWidth,
          slice.near.centerX + slice.near.roadHalfWidth,
          slice.near.y,
          slice.far.centerX - slice.far.roadHalfWidth,
          slice.far.centerX + slice.far.roadHalfWidth,
          slice.far.y,
          0.94,
        );
      }
      if (slice.segmentIndex % 12 === 0) {
        const treeSide = slice.segmentIndex % 24 === 0 ? -1 : 1;
        drawRoadsideTree(
          graphics,
          slice.far.centerX + treeSide * slice.far.roadHalfWidth * 1.55,
          slice.far.y,
          slice.far.scale,
        );
      }
    }

    if (opponent !== null && opponent.distance > car.distance - 5) {
      const projectedOpponent = projectRacingObject(
        car,
        opponent.distance,
        opponent.lateral,
        viewport,
      );
      if (projectedOpponent.visible) {
        drawCar(
          graphics,
          projectedOpponent.x,
          projectedOpponent.y,
          Math.min(viewport.width * 0.16, Math.max(8, projectedOpponent.scale * 1.8)),
          colorForCar(opponent),
          opponent.steering,
          0.9,
        );
      }
    }

    drawCar(
      graphics,
      viewport.width / 2,
      viewport.height * 0.91,
      Math.min(viewport.width * 0.24, viewport.height * 0.24),
      colorForCar(car),
      car.steering,
    );
    const prominentGauge = snapshot.phase === "starting";
    drawSteeringGauge(graphics, car, viewport, prominentGauge);
    graphics.lineStyle(2, 0xf8fafc, 0.24);
    graphics.strokeRect(0, 0, viewport.width, viewport.height);

    layer.playerText.setText(layer.slot === "solo" ? "SOLO" : layer.slot.toUpperCase());
    layer.metricText.setText(
      `${Math.round(car.speed * 3.6)} km/h\n${Math.round(car.progress * 100)}%\n${formatTime(snapshot.elapsedMs)}`,
    );
    if (snapshot.phase === "starting") {
      const count = Math.max(1, Math.ceil(snapshot.startingRemainingMs / 1_000));
      layer.statusText.setText(
        car.trackingAvailable
          ? `Hold the wheel level\n${count}`
          : "Hold both hands\nlike a steering wheel",
      );
      layer.statusText.setVisible(true);
    } else {
      layer.statusText.setVisible(false);
    }
  }
}

export class RacingRuntime {
  private readonly game: import("phaser-runtime").Game;
  private readonly scene: RacingScene;
  private readonly resizeObserver: ResizeObserver;
  private destroyed = false;

  public constructor(private readonly options: RacingRuntimeOptions) {
    const width = Math.max(1, Math.round(options.parent.clientWidth || 1_280));
    const height = Math.max(1, Math.round(options.parent.clientHeight || 720));
    this.scene = new RacingScene(options);
    this.game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: options.parent,
      width,
      height,
      backgroundColor: "#172554",
      banner: false,
      audio: { noAudio: true },
      scene: this.scene,
      render: { antialias: true, pixelArt: false, roundPixels: true },
      scale: { mode: Phaser.Scale.NONE, width, height },
    });
    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (entry === undefined || this.destroyed) {
        return;
      }
      const nextWidth = Math.max(1, Math.round(entry.contentRect.width));
      const nextHeight = Math.max(1, Math.round(entry.contentRect.height));
      this.game.scale.resize(nextWidth, nextHeight);
      this.scene.resizeLayers(nextWidth, nextHeight);
    });
    this.resizeObserver.observe(options.parent);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.resizeObserver.disconnect();
    this.options.session.setSystemPaused(true, performance.now());
    this.game.destroy(true, false);
  }

  private readonly handleVisibilityChange = (): void => {
    this.options.session.setSystemPaused(document.hidden, performance.now());
  };
}
