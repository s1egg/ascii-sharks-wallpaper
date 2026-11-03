import { clamp } from "./math";

export interface WaterMark {
  x: number;
  y: number;
  heading: number;
  age: number;
  strength: number;
}

interface PointerSweep {
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  speed: number;
  time: number;
}

/** Pointer feedback uses real elapsed time, independently of the swim-speed setting. */
export class WaterInteraction {
  x = 0;
  y = 0;
  active = false;
  speed = 0;
  influence = 0;
  dwell = 0;
  visited = false;
  marks: WaterMark[] = [];
  private anchorX = 0;
  private anchorY = 0;
  private sampleAt = 0;
  private markAt = -Infinity;
  private markX = 0;
  private markY = 0;
  private sweeps: PointerSweep[] = [];

  update(x: number, y: number, active: boolean, now: number) {
    if (!active || !Number.isFinite(x + y + now)) {
      this.active = false;
      this.dwell = 0;
      this.visited = false;
      this.speed = 0;
      this.sweeps.length = 0;
      return;
    }
    const dx = x - this.x, dy = y - this.y;
    const elapsed = now - this.sampleAt;
    if (!this.active || elapsed > 0.5 || elapsed <= 0) {
      this.anchorX = this.markX = x;
      this.anchorY = this.markY = y;
      this.dwell = 0;
      this.visited = false;
      this.speed = 0;
      this.markAt = -Infinity;
      this.sweeps.length = 0;
    } else {
      const speed = Math.min(1400, Math.hypot(dx, dy) / Math.max(0.016, elapsed));
      this.speed += (speed - this.speed) * 0.65;
      if (Math.hypot(x - this.anchorX, y - this.anchorY) > 18) {
        this.anchorX = x;
        this.anchorY = y;
        this.dwell = 0;
        this.visited = false;
      }
      if (Math.hypot(dx, dy) > 0.5 && speed > 10) {
        this.sweeps.push({ fromX: this.x, fromY: this.y, x, y, speed, time: now });
        // Retain actual segments rather than bridging curved paths with a chord.
        if (this.sweeps.length > 8) this.sweeps.shift();
      }
    }
    this.x = x;
    this.y = y;
    this.active = true;
    this.sampleAt = now;
  }

  takeSweeps() {
    const sweeps = this.sweeps;
    this.sweeps = [];
    return sweeps;
  }

  contact(x: number, y: number, sweep: PointerSweep) {
    if (sweep.time - this.markAt < 0.18
      || (sweep.time - this.markAt < 0.6 && Math.hypot(x - this.markX, y - this.markY) < 16)) return;
    this.marks.push({ x, y, heading: Math.atan2(sweep.y - sweep.fromY, sweep.x - sweep.fromX),
      age: 0, strength: clamp(sweep.speed / 500, 0.45, 1) });
    if (this.marks.length > 5) this.marks.shift();
    this.markAt = sweep.time;
    this.markX = x;
    this.markY = y;
  }

  step(dt: number) {
    this.speed *= Math.exp(-dt * 5);
    const desired = this.active ? 0.2 + clamp(this.speed / 420, 0, 1) * 0.8 : 0;
    this.influence += (desired - this.influence) * (1 - Math.exp(-dt * 16));
    if (this.active && this.speed < 35) this.dwell += dt;
    else this.dwell = 0;
    if (this.marks.length) {
      for (const mark of this.marks) mark.age += dt;
      this.marks = this.marks.filter((mark) => mark.age < 2.2);
    }
  }

  clear() {
    this.active = false;
    this.speed = this.influence = this.dwell = 0;
    this.visited = false;
    this.marks.length = 0;
    this.sweeps.length = 0;
  }
}
