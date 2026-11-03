import { AsciiRenderer } from "../../../Web/src/renderer";
import { World } from "../../../Web/src/world";

const STEP = 1 / 60;
export const WIDTH = 1600;
export const HEIGHT = 1000;
export const FPS = 30;
export const DURATION = 300;
export const BLEND_FRAMES = 24;

// Keep a separate PRNG per canvas so parallel rendering and seeking agree.
function seededRandom() {
  let value = 0x1a5c11;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export class OceanFrames {
  private random = seededRandom();
  private world = new World();
  private renderer: AsciiRenderer;
  frame = 0;

  private withRandom<T>(run: () => T): T {
    const previous = Math.random;
    Math.random = this.random;
    try {
      return run();
    } finally {
      Math.random = previous;
    }
  }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new AsciiRenderer(canvas);
    this.renderer.setFontFamily("Menlo, Monaco, monospace");
    this.renderer.resize(WIDTH, HEIGHT, 1);
    this.withRandom(() => {
      this.world.resize(WIDTH, HEIGHT, this.renderer.cellWidth, this.renderer.cellHeight);
      for (let i = 0; i < 120; i++) this.world.step(STEP);
    });
    this.renderer.render(this.world, STEP);
  }

  draw(target: number) {
    if (target < this.frame) throw new Error("Recreate OceanFrames before seeking backwards.");
    while (this.frame < target) {
      this.withRandom(() => {
        this.world.step(STEP);
        this.world.step(STEP);
      });
      this.renderer.render(this.world, 1 / FPS);
      this.frame++;
    }
  }
}
