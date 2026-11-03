import { AsciiRenderer } from "./renderer";
import { World, type SharkSpec } from "./world";

export interface EngineOptions {
  paused: boolean;
  frameRate: number;
  speed: number;
  pixelRatio: number;
  interaction: boolean;
}

const STEP = 1 / 60;
let pointerRequestID = 0;

export interface PointerInput {
  x: number;
  y: number;
  active: boolean;
  requestID?: number;
}

/** A desktop loop that stops scheduling work when paused or hidden. */
export class OceanEngine {
  private world: World;
  private renderer: AsciiRenderer;
  private options: EngineOptions;
  private raf = 0;
  private timer = 0;
  private last = 0;
  private nextFrameAt = 0;
  private accumulator = 0;
  private disposed = false;
  private frames = 0;
  private nextPointerAt = 0;
  private pendingPointer = 0;
  private requestedPointerAt = 0;
  private pointerSamples = 0;
  private motion = matchMedia("(prefers-reduced-motion: reduce)");
  private resizeObserver: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement, sharks: SharkSpec[] | undefined, options: EngineOptions,
    private requestPointer?: (id: number) => void) {
    this.options = { ...options };
    this.world = new World(sharks);
    this.renderer = new AsciiRenderer(canvas);
    this.renderer.setFontFamily(getComputedStyle(canvas).fontFamily);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.motion.addEventListener("change", this.restart);
    document.addEventListener("visibilitychange", this.restart);
    this.resize();
    // Start with a populated ocean even when macOS requests reduced motion.
    for (let i = 0; i < 120; i++) this.world.step(STEP);
    this.draw(STEP);
    this.restart();
  }

  configure(options: EngineOptions) {
    const resized = options.pixelRatio !== this.options.pixelRatio;
    this.options = { ...options };
    if (resized) this.resize();
    this.restart();
  }

  pointer(input: PointerInput) {
    // A reply from a paused, replaced or disposed engine cannot revive interaction.
    if (input.requestID !== undefined && input.requestID !== this.pendingPointer) return;
    this.pendingPointer = 0;
    if (!this.canRun() || !this.options.interaction) {
      this.world.clearInteraction();
      return;
    }
    this.pointerSamples++;
    const active = input.active === true && Number.isFinite(input.x) && Number.isFinite(input.y)
      && input.x >= 0 && input.x <= 1 && input.y >= 0 && input.y <= 1;
    this.world.pointer.update(input.x * this.world.width, input.y * this.world.height, active, performance.now() / 1000);
  }

  stats() {
    return {
      ...this.options,
      frames: this.frames,
      simulationTime: this.world.time,
      reducedMotion: this.motion.matches,
      hidden: document.hidden,
      sharks: this.world.sharks.length,
      visitors: this.world.visitors.length,
      moment: this.world.moment ? { ...this.world.moment, visitorKind: this.world.visitors[0]?.kind } : null,
      momentsStarted: this.world.momentsStarted,
      momentsCompleted: this.world.momentsCompleted,
      animals: this.world.sharks.map(shark => ({ id: shark.id, kind: shark.kind,
        x: shark.nodes[0], y: shark.nodes[1], heading: shark.heading, speed: shark.speed, burst: shark.burst })),
      fish: this.world.fish.length,
      width: this.canvas.width,
      height: this.canvas.height,
      scheduled: this.raf !== 0 || this.timer !== 0,
      disposed: this.disposed,
      pointerSamples: this.pointerSamples,
      pointer: { active: this.world.pointer.active, x: this.world.pointer.x / this.world.width,
        y: this.world.pointer.y / this.world.height, dwell: this.world.pointer.dwell,
        marks: this.world.pointer.marks.length, curiousShark: this.world.curiosity.sharkId },
    };
  }

  destroy() {
    this.disposed = true;
    this.cancel();
    this.resizeObserver.disconnect();
    this.motion.removeEventListener("change", this.restart);
    document.removeEventListener("visibilitychange", this.restart);
  }

  private cancel() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.raf = this.timer = 0;
    this.last = this.accumulator = this.nextFrameAt = 0;
    this.pendingPointer = this.nextPointerAt = 0;
    this.world.clearInteraction();
  }

  private canRun() {
    return !this.disposed && !this.options.paused && !this.motion.matches && !document.hidden;
  }

  private restart = () => {
    this.cancel();
    if (this.canRun()) this.raf = requestAnimationFrame(this.frame);
    // Clear transient water marks and pointer emphasis before freezing the scene.
    else if (!this.disposed && !document.hidden) this.draw(0);
  };

  private resize = () => {
    if (this.disposed) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const ratio = Math.min(devicePixelRatio || 1, this.options.pixelRatio);
    // ResizeObserver also delivers the initial size after construction. An
    // unchanged notification must not discard input received in that interval.
    if (width === this.world.width && height === this.world.height
      && this.canvas.width === Math.round(width * ratio) && this.canvas.height === Math.round(height * ratio)) return;
    this.renderer.resize(width, height, ratio);
    this.world.resize(width, height, this.renderer.cellWidth, this.renderer.cellHeight);
    this.draw(STEP);
  };

  private draw(dt: number) {
    this.renderer.render(this.world, dt);
    this.frames++;
  }

  private schedule(delay: number) {
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      if (this.canRun()) this.raf = requestAnimationFrame(this.frame);
    }, Math.max(0, delay));
  }

  private frame = () => {
    this.raf = 0;
    if (!this.canRun()) return;
    // rAF's timestamp can precede callback execution by most of a refresh.
    // Schedule against actual start times and a deadline, so a cheap ASCII
    // frame cannot accidentally turn the 30 FPS setting into 45 or 60 FPS.
    const now = performance.now();
    const interval = 1000 / this.options.frameRate;
    if (this.nextFrameAt > now + 0.5) {
      this.schedule(this.nextFrameAt - now - 2);
      return;
    }
    this.nextFrameAt = this.nextFrameAt ? this.nextFrameAt + interval : now + interval;
    if (this.nextFrameAt <= now) this.nextFrameAt = now + interval;
    const elapsed = this.last === 0 ? STEP : Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.options.interaction && this.requestPointer && now >= this.nextPointerAt) {
      if (this.pendingPointer && now - this.requestedPointerAt > 500) {
        this.pendingPointer = 0;
        this.world.clearInteraction();
      }
      if (!this.pendingPointer) {
        this.pendingPointer = ++pointerRequestID;
        this.requestedPointerAt = now;
        this.nextPointerAt = now + 100;
        this.requestPointer(this.pendingPointer);
      }
    }
    const dt = elapsed * this.options.speed;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < 12) {
      this.world.step(STEP, STEP / this.options.speed);
      this.accumulator -= STEP;
      steps++;
    }
    if (steps === 12) this.accumulator = 0;
    this.draw(dt);
    // Use one timeout before the next display tick, instead of waking on every
    // 120 Hz ProMotion refresh just to throw most frames away.
    this.schedule(this.nextFrameAt - performance.now() - 3);
  };
}
