declare module "phaser-runtime" {
  export interface TextStyle {
    align?: string;
    color?: string;
    fontFamily?: string;
    fontSize?: string;
    fontStyle?: string;
    stroke?: string;
    strokeThickness?: number;
  }

  export interface GameObject {}

  export class Graphics implements GameObject {
    clear(): this;
    fillStyle(color: number, alpha?: number): this;
    lineStyle(lineWidth: number, color: number, alpha?: number): this;
    beginPath(): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    closePath(): this;
    fillPath(): this;
    strokePath(): this;
    fillRect(x: number, y: number, width: number, height: number): this;
    strokeRect(x: number, y: number, width: number, height: number): this;
    fillRoundedRect(x: number, y: number, width: number, height: number, radius?: number): this;
    fillCircle(x: number, y: number, radius: number): this;
    strokeCircle(x: number, y: number, radius: number): this;
    fillEllipse(x: number, y: number, width: number, height: number): this;
    fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): this;
  }

  export class Text implements GameObject {
    setOrigin(x?: number, y?: number): this;
    setPosition(x: number, y: number): this;
    setText(value: string): this;
    setVisible(value: boolean): this;
    setWordWrapWidth(width: number): this;
  }

  export class Container implements GameObject {}

  export class Camera {
    setBackgroundColor(color: number): this;
    setViewport(x: number, y: number, width: number, height: number): this;
    setScroll(x: number, y: number): this;
    ignore(entry: GameObject): this;
  }

  export interface CameraManager {
    main: Camera;
    add(
      x: number,
      y: number,
      width: number,
      height: number,
      makeMain?: boolean,
      name?: string,
    ): Camera;
  }

  export interface GameObjectFactory {
    graphics(): Graphics;
    text(x: number, y: number, value: string, style?: TextStyle): Text;
    container(x: number, y: number, children?: GameObject[]): Container;
  }

  export interface ScaleManager {
    width: number;
    height: number;
    resize(width: number, height: number): void;
  }

  export interface GameRenderer {
    type: number;
  }

  export interface GameConfig {
    type: number;
    parent: HTMLElement;
    width: number;
    height: number;
    backgroundColor: string;
    banner: boolean;
    audio: { noAudio: boolean };
    scene: Scene;
    render: { antialias: boolean; pixelArt: boolean; roundPixels: boolean };
    scale: { mode: number; width: number; height: number };
  }

  export class Game {
    constructor(config: GameConfig);
    renderer: GameRenderer;
    scale: ScaleManager;
    destroy(removeCanvas: boolean, noReturn?: boolean): void;
  }

  export class Scene {
    constructor(config?: { key: string });
    game: Game;
    add: GameObjectFactory;
    cameras: CameraManager;
    update(time: number, delta: number): void;
  }

  const Phaser: {
    CANVAS: number;
    Game: typeof Game;
    Scene: typeof Scene;
    Scale: { NONE: number };
  };

  export default Phaser;
}
