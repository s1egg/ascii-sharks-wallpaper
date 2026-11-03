import { describe, expect, test } from "bun:test";
import { angleDiff, TAU } from "../Web/src/math";
import { writeSwimmingSpine } from "../Web/src/motion";
import { SHAPES } from "../Web/src/shapes";
import { SHARK_NODES, World, type SharkKind } from "../Web/src/world";

function seeded<T>(seed: number, run: () => T): T {
  const original = Math.random;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  try { return run(); } finally { Math.random = original; }
}

function visible(world: World) {
  return world.sharks.some((shark) => {
    for (let k = 0; k < SHARK_NODES; k++) {
      const x = shark.nodes[k * 2], y = shark.nodes[k * 2 + 1];
      if (x >= 0 && x <= world.width && y >= 0 && y <= world.height) return true;
    }
    return false;
  });
}

describe("unhurried, articulated ASCII sharks", () => {
  test("the snout is stable while the caudal fin supplies the stroke", () => seeded(12, () => {
    const world = new World([{ kind: "classic", size: 1 }], 0);
    world.resize(1440, 900, 7, 10);
    const shark = world.sharks[0];
    shark.stroke = 1;
    const out = new Float32Array(SHARK_NODES * 2);
    let shoulder = 0, tail = 0;
    for (let phase = 0; phase < TAU; phase += 0.05) {
      shark.phase = phase;
      writeSwimmingSpine(shark, out);
      expect(out[0]).toBe(shark.nodes[0]);
      expect(out[1]).toBe(shark.nodes[1]);
      shoulder = Math.max(shoulder, Math.hypot(out[8] - shark.nodes[8], out[9] - shark.nodes[9]));
      tail = Math.max(tail, Math.hypot(out[38] - shark.nodes[38], out[39] - shark.nodes[39]));
    }
    expect(shoulder / shark.length).toBeLessThan(0.002);
    expect(tail / shark.length).toBeGreaterThan(0.045);
    expect(tail / shark.length).toBeLessThan(0.055);
  }));

  test("painted joints keep their length through a stroke and glide in every species", () => seeded(81, () => {
    const specs = (Object.keys(SHAPES) as SharkKind[]).map((kind) => ({ kind, size: 1 }));
    const world = new World(specs, 0);
    world.resize(1440, 900, 7, 10);
    const out = new Float32Array(SHARK_NODES * 2);
    for (const shark of world.sharks) {
      const peaks: number[] = [];
      for (const stroke of [0.42, 1]) {
        shark.stroke = stroke;
        let peak = 0;
        for (let phase = 0; phase < TAU; phase += 0.08) {
          shark.phase = phase;
          writeSwimmingSpine(shark, out);
          expect(out[0]).toBe(shark.nodes[0]);
          expect(out[1]).toBe(shark.nodes[1]);
          for (let k = 1; k < SHARK_NODES; k++) {
            const length = Math.hypot(out[k * 2] - out[k * 2 - 2], out[k * 2 + 1] - out[k * 2 - 1]);
            expect(Math.abs(length - shark.length / (SHARK_NODES - 1))).toBeLessThan(0.001);
          }
          peak = Math.max(peak, Math.hypot(out[38] - shark.nodes[38], out[39] - shark.nodes[39]));
        }
        peaks.push(peak);
      }
      expect(peaks[0]).toBeLessThan(peaks[1] * 0.85);
      expect(peaks[0]).toBeGreaterThan(peaks[1] * 0.5);
    }
  }));

  test("three minutes of steering preserve anatomy, finite positions and gentle speed", () => seeded(3107, () => {
    const world = new World();
    world.resize(1440, 900, 7, 10);
    const oldHeading = world.sharks.map((shark) => shark.heading);
    let maxSegmentError = 0, maxSpeedRatio = 0, maxTurn = 0, blank = 0;
    for (let frame = 0; frame < 60 * 180; frame++) {
      world.step(1 / 60);
      world.events.length = 0;
      if (!visible(world)) blank++;
      world.sharks.forEach((shark, index) => {
        maxSpeedRatio = Math.max(maxSpeedRatio, shark.speed / (14 + shark.length * 0.028));
        maxTurn = Math.max(maxTurn, Math.abs(angleDiff(oldHeading[index], shark.heading)) * 60);
        oldHeading[index] = shark.heading;
        if (frame % 60 !== 0) return;
        for (let k = 1; k < SHARK_NODES; k++) {
          const dx = shark.nodes[k * 2] - shark.nodes[(k - 1) * 2];
          const dy = shark.nodes[k * 2 + 1] - shark.nodes[(k - 1) * 2 + 1];
          maxSegmentError = Math.max(maxSegmentError, Math.abs(Math.hypot(dx, dy) - shark.length / (SHARK_NODES - 1)));
        }
      });
    }
    expect(Number.isFinite(maxSegmentError)).toBe(true);
    expect(maxSegmentError).toBeLessThan(0.001);
    expect(maxTurn).toBeLessThan(0.3);
    expect(maxSpeedRatio).toBeLessThan(1.56);
    expect(blank).toBe(0);
    expect(world.fish.every((fish) => Number.isFinite(fish.x + fish.y + fish.vx + fish.vy))).toBe(true);
  }));

  test("solo shark remains in view during a five-minute desktop patrol", () => seeded(734, () => {
    const world = new World([{ kind: "classic", size: 1 }]);
    world.resize(1440, 900, 7, 10);
    let gap = 0, longestGap = 0;
    for (let frame = 0; frame < 60 * 300; frame++) {
      world.step(1 / 60);
      world.events.length = 0;
      gap = visible(world) ? 0 : gap + 1;
      longestGap = Math.max(longestGap, gap);
    }
    expect(longestGap / 60).toBeLessThan(3);
  }));

  test("resize keeps the same animal and its proportions, including a fish-free scene", () => seeded(24, () => {
    const world = new World([{ kind: "mako", size: 1 }], 0);
    world.resize(1440, 900, 7, 10);
    for (let k = 0; k < 90; k++) world.step(1 / 60);
    const shark = world.sharks[0];
    const x = shark.nodes[0] / 1440, y = shark.nodes[1] / 900;
    const heading = shark.heading;
    world.resize(768, 1024, 6, 9);
    expect(world.sharks[0]).toBe(shark);
    expect(shark.nodes[0] / 768).toBeCloseTo(x, 5);
    expect(shark.nodes[1] / 1024).toBeCloseTo(y, 5);
    expect(shark.heading).toBe(heading);
    expect(world.fish.length).toBe(0);
    expect(Math.hypot(shark.nodes[2] - shark.nodes[0], shark.nodes[3] - shark.nodes[1])).toBeCloseTo(shark.length / (SHARK_NODES - 1), 3);
    for (const shape of Object.values(SHAPES)) {
      for (let k = 0; k <= 100; k++) {
        const width = shape.halfWidth(k / 100);
        expect(Number.isFinite(width) && width >= 0).toBe(true);
      }
    }
  }));
});
