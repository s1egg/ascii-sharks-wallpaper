import { describe, expect, test } from "bun:test";
import { angleDiff, TAU } from "../Web/src/math";
import { writeSwimmingSpine } from "../Web/src/motion";
import { SHAPES } from "../Web/src/shapes";
import { WaterInteraction } from "../Web/src/interaction";
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

describe("recognizable animals and occasional ocean moments", () => {
  test("hammerheads patrol horizontally and threshers turn and beat their tails more slowly", () => {
    function observe(kind: SharkKind) {
      return seeded(37, () => {
        const world = new World([{ kind, size: 0.8 }], 0);
        world.resize(1440, 900, 7, 10);
        const shark = world.sharks[0], phase = shark.phase;
        let horizontal = 0, vertical = 0, turning = 0, samples = 0;
        for (let frame = 0; frame < 60 * 180; frame++) {
          world.step(1 / 60);
          horizontal += Math.abs(Math.cos(shark.heading));
          vertical += Math.abs(Math.sin(shark.heading));
          if (Math.min(shark.nodes[0], 1440 - shark.nodes[0], shark.nodes[1], 900 - shark.nodes[1]) > shark.length * 0.7) {
            turning += Math.abs(shark.turn); samples++;
          }
        }
        return { horizontal: horizontal / vertical, turn: turning / samples, phase: shark.phase - phase, samples };
      });
    }
    const classic = observe("classic"), hammerhead = observe("hammerhead"), thresher = observe("thresher");
    expect(hammerhead.horizontal).toBeGreaterThan(classic.horizontal * 1.1);
    expect(hammerhead.horizontal).toBeGreaterThan(1.65);
    expect(hammerhead.turn).toBeLessThan(classic.turn * 0.6);
    expect(thresher.samples).toBeGreaterThan(1000);
    expect(thresher.turn).toBeLessThan(classic.turn * 0.8);
    expect(thresher.phase).toBeLessThan(classic.phase * 0.85);
  });

  test("a mako makes short separated bursts and returns to its cruising pace", () => seeded(37, () => {
    const world = new World([{ kind: "mako", size: 0.8 }], 0);
    world.resize(1440, 900, 7, 10);
    const shark = world.sharks[0], cruise = 14 + shark.length * 0.028;
    let previousStart = -Infinity, peak = 0, activeTime = 0, distance = 0, longestDistance = 0, recoveries = 0;
    const starts: number[] = [];
    for (let frame = 0; frame < 60 * 180; frame++) {
      world.step(1 / 60);
      peak = Math.max(peak, shark.speed / cruise);
      if (shark.burstStartedAt !== previousStart) { starts.push(world.time); previousStart = shark.burstStartedAt; }
      if (shark.burst > 0.01) { activeTime += 1 / 60; distance += shark.speed / 60; }
      else { longestDistance = Math.max(longestDistance, distance); distance = 0; }
      const age = world.time - shark.burstStartedAt;
      if (age > 10 && age < 10.02) { expect(shark.speed / cruise).toBeLessThan(1.1); recoveries++; }
    }
    expect(starts.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThan(33);
    expect(activeTime).toBeLessThan(18);
    expect(longestDistance).toBeLessThan(150);
    expect(peak).toBeGreaterThan(1.4);
    expect(peak).toBeLessThan(1.9);
    expect(recoveries).toBeGreaterThan(1);
  }));

  test("rare moments cross the open water, remain bounded, and leave quiet gaps", () => seeded(71, () => {
    const world = new World();
    world.resize(1440, 900, 7, 10);
    const residents = [...world.sharks], fishCount = world.fish.length;
    let previousStarted = 0, previousCompleted = 0, lastFinish = -Infinity, crossed = false, jointError = 0;
    const kinds = new Set<string>();
    for (let frame = 0; frame < 60 * 900; frame++) {
      world.step(1 / 60); world.events.length = 0;
      if (world.momentsStarted !== previousStarted) {
        if (previousStarted === 0) expect(world.time).toBeGreaterThanOrEqual(55);
        else expect(world.time - lastFinish).toBeGreaterThanOrEqual(90);
        kinds.add(world.moment!.kind);
        previousStarted = world.momentsStarted;
      }
      if (world.momentsCompleted !== previousCompleted) { lastFinish = world.time; previousCompleted = world.momentsCompleted; }
      if (world.moment?.kind === "crossing" && world.moment.crossed) crossed = true;
      expect(world.visitors.length).toBeLessThanOrEqual(1);
      for (const visitor of world.visitors) {
        expect(residents.some(shark => shark.kind === visitor.kind)).toBe(false);
        expect(Number.isFinite(visitor.nodes[0] + visitor.nodes[1])).toBe(true);
        if (world.moment?.kind === "visitor") expect(world.moment.opacity).toBeLessThanOrEqual(0.65);
        for (let k = 1; k < SHARK_NODES; k++) {
          jointError = Math.max(jointError, Math.abs(Math.hypot(visitor.nodes[k * 2] - visitor.nodes[k * 2 - 2],
            visitor.nodes[k * 2 + 1] - visitor.nodes[k * 2 - 1]) - visitor.length / (SHARK_NODES - 1)));
        }
      }
    }
    expect(kinds).toEqual(new Set(["crossing", "visitor"]));
    expect(crossed).toBe(true);
    expect(world.momentsCompleted).toBeGreaterThanOrEqual(4);
    expect(world.momentsStarted).toBeLessThanOrEqual(7);
    expect(world.fish.length).toBe(fishCount);
    expect(world.sharks).toEqual(residents);
    expect(jointError).toBeLessThan(0.001);
  }));

  test("a distant visitor survives resizing and finishes without becoming a resident", () => seeded(71, () => {
    const world = new World();
    world.resize(1440, 900, 7, 10);
    for (let frame = 0; frame < 60 * 400; frame++) {
      world.step(1 / 60); world.events.length = 0;
      if (world.moment?.kind === "visitor" && world.time - world.moment.startedAt > 10) break;
    }
    expect(world.moment?.kind).toBe("visitor");
    const visitor = world.visitors[0], x = visitor.nodes[0] / 1440, y = visitor.nodes[1] / 900;
    world.resize(768, 1024, 6, 9);
    expect(world.visitors[0]).toBe(visitor);
    expect(visitor.nodes[0] / 768).toBeCloseTo(x, 5);
    expect(visitor.nodes[1] / 1024).toBeCloseTo(y, 5);
    for (let frame = 0; frame < 60 * 120 && world.moment; frame++) world.step(1 / 60);
    expect(world.moment).toBeNull();
    expect(world.visitors).toHaveLength(0);
    expect(world.sharks).toHaveLength(4);
  }));

  test("active pointer play postpones background moments until the water is quiet", () => seeded(71, () => {
    const world = new World();
    world.resize(1440, 900, 7, 10);
    for (let frame = 0; frame < 60 * 110; frame++) {
      const now = frame / 60;
      world.pointer.update(720 + Math.sin(now) * 250, 450 + Math.cos(now) * 100, true, now);
      world.step(1 / 60); world.events.length = 0;
    }
    expect(world.momentsStarted).toBe(0);
    world.pointer.update(0, 0, false, 110);
    for (let frame = 0; frame < 60 * 12; frame++) world.step(1 / 60);
    expect(world.momentsStarted).toBe(1);
  }));
});

describe("quiet pointer interaction", () => {
  test("small schools stay bounded when eaten fish return", () => seeded(1124, () => {
    const world = new World();
    world.resize(1440, 900, 7, 10);
    expect(world.fish.length).toBeGreaterThanOrEqual(24);
    expect(world.fish.length).toBeLessThanOrEqual(64);
    const originalSchools = new Set(world.fish.map(fish => fish.school));
    for (const fish of world.fish.slice(0, 16)) { fish.alive = false; fish.respawnAt = 0; }
    let returned = false;
    for (let frame = 0; frame < 60 * 45; frame++) {
      world.step(1 / 60);
      world.events.length = 0;
      if (frame % 60) continue;
      const sizes = new Map<number, number>();
      for (const fish of world.fish) {
        if (!fish.alive) continue;
        sizes.set(fish.school, (sizes.get(fish.school) ?? 0) + 1);
        returned ||= !originalSchools.has(fish.school);
      }
      expect(Math.max(...sizes.values())).toBeLessThanOrEqual(7);
    }
    expect(returned).toBe(true);
  }));

  test("separate schools of the same species keep more space than schoolmates", () => {
    function distance(sameSchool: boolean) {
      return seeded(4, () => {
        const world = new World([], 2);
        world.resize(1440, 900, 7, 10);
        world.fish.forEach((fish, index) => Object.assign(fish,
          { x: 680 + index * 30, y: 450, vx: 22, vy: 0, species: 0, school: sameSchool ? 1 : index + 1 }));
        for (let frame = 0; frame < 60; frame++) world.step(1 / 60);
        const [a, b] = world.fish;
        return Math.hypot(a.x - b.x, a.y - b.y);
      });
    }
    expect(distance(false)).toBeGreaterThan(distance(true) + 3);
  });

  test("entry and movement through empty water never create ripples", () => {
    const pointer = new WaterInteraction();
    pointer.update(900, 600, true, 10);
    pointer.step(1 / 60);
    expect(pointer.speed).toBe(0);
    expect(pointer.marks).toHaveLength(0);
    for (let i = 1; i <= 30; i++) {
      pointer.update(900 + i * 20, 600, true, 10 + i / 10);
      pointer.step(0.1);
      expect(pointer.marks).toHaveLength(0);
    }
    pointer.update(0, 0, false, 14);
    for (let i = 0; i < 150; i++) pointer.step(1 / 60);
    expect(pointer.influence).toBeLessThan(0.001);
    expect(pointer.marks).toHaveLength(0);
    expect(pointer.dwell).toBe(0);
    pointer.update(Number.NaN, 10, true, 20);
    expect(pointer.active).toBe(false);
  });

  test("only live-fish contact creates a ripple, even on a fast pass", () => {
    for (const [alive, y, expected] of [[true, 450, 1], [false, 450, 0], [true, 550, 0]] as const) seeded(9, () => {
      const world = new World([], 1);
      world.resize(1440, 900, 7, 10);
      Object.assign(world.fish[0], { x: 700, y, alive, respawnAt: Infinity });
      world.pointer.update(100, 450, true, 1);
      world.pointer.update(900, 450, true, 1.1);
      world.step(1 / 60);
      expect(world.pointer.marks).toHaveLength(expected);
      if (expected) {
        expect(world.pointer.marks[0].x).toBeCloseTo(700, 5);
        expect(world.pointer.marks[0].y).toBeCloseTo(450, 5);
        // A later encounter at the same location must still give feedback.
        Object.assign(world.fish[0], { x: 700, y: 450 });
        world.pointer.update(900, 450, true, 1.5);
        world.pointer.update(500, 450, true, 1.9);
        world.step(1 / 60);
        expect(world.pointer.marks).toHaveLength(2);
      }
      // Consumed movement cannot keep spawning ripples under a stationary cursor.
      for (let i = 0; i < 150; i++) world.step(1 / 60);
      expect(world.pointer.marks).toHaveLength(0);
    });
  });

  test("repeated school contacts stay bounded and stop on departure", () => seeded(10, () => {
    const world = new World([], 1);
    world.resize(1440, 900, 7, 10);
    world.pointer.update(100, 450, true, 1);
    for (let i = 1; i <= 30; i++) {
      const x = 100 + i * 20;
      Object.assign(world.fish[0], { x, y: 450, vx: 0, vy: 0 });
      world.pointer.update(x, 450, true, 1 + i / 10);
      for (let step = 0; step < 6; step++) world.step(1 / 60);
      expect(world.pointer.marks.length).toBeLessThanOrEqual(5);
    }
    expect(world.pointer.marks.length).toBeGreaterThan(0);
    world.pointer.update(1000, 100, true, 4.1);
    world.step(1 / 60);
    const existing = [...world.pointer.marks];
    for (let i = 1; i <= 10; i++) {
      world.pointer.update(1000 + i * 10, 100, true, 4.1 + i / 10);
      for (let step = 0; step < 6; step++) world.step(1 / 60);
    }
    expect(world.pointer.marks.every(mark => existing.includes(mark))).toBe(true);
    world.clearInteraction();
    expect(world.pointer.marks).toHaveLength(0);
  }));

  test("fast passes part fish more than slow passes, while distant fish are unaffected", () => {
    function pass(distance: number, near: boolean) {
      return seeded(59, () => {
        const world = new World([], 1);
        world.resize(1440, 900, 7, 10);
        const fish = world.fish[0];
        Object.assign(fish, { x: 720, y: 450, vx: 0, vy: -20, alarm: 0 });
        const x = near ? 690 : 200;
        world.pointer.update(x - distance, 450, true, 1);
        world.pointer.update(x, 450, true, 1.1);
        for (let i = 0; i < 12; i++) world.step(1 / 60);
        return fish.vx;
      });
    }
    expect(pass(70, true)).toBeGreaterThan(pass(3, true) + 5);
    expect(pass(70, false)).toBeCloseTo(pass(3, false), 8);
  });

  test("a brief hover invites one nearby passing shark, then releases it", () => seeded(61, () => {
    const world = new World([{ kind: "classic", size: 1 }, { kind: "mako", size: 0.7 }], 0);
    world.resize(1440, 900, 7, 10);
    const nearest = world.sharks[0];
    for (let i = 0; i < world.sharks.length; i++) {
      const shark = world.sharks[i];
      shark.heading = 0;
      for (let k = 0; k < SHARK_NODES; k++) {
        shark.nodes[k * 2] = (i === 0 ? 600 : 250) - k * shark.length / (SHARK_NODES - 1);
        shark.nodes[k * 2 + 1] = 450;
      }
    }
    world.pointer.update(820, 450, true, 1);
    for (let i = 0; i < 27; i++) world.step(1 / 60);
    expect(world.curiosity.sharkId).toBeNull();
    for (let i = 0; i < 20; i++) world.step(1 / 60);
    expect(world.curiosity.sharkId).toBe(nearest.id);
    expect(world.curiosity.weight).toBeGreaterThan(0);
    const startX = nearest.nodes[0];
    for (let i = 0; i < 180; i++) world.step(1 / 60);
    expect(nearest.nodes[0]).toBeGreaterThan(startX);
    // Moving away interrupts the visit without changing anatomy or teleporting.
    world.pointer.update(1100, 700, true, 6);
    const weight = world.curiosity.weight;
    world.step(1 / 60);
    expect(world.curiosity.weight).toBeLessThan(weight);
    world.pointer.update(0, 0, false, 6.1);
    for (let i = 0; i < 150; i++) world.step(1 / 60);
    expect(world.curiosity.sharkId).toBeNull();
    expect(Number.isFinite(nearest.nodes[0])).toBe(true);
  }));

  test("a parked cursor gets one visit, not repeated attraction", () => seeded(21, () => {
    const world = new World([{ kind: "classic", size: 1 }], 0);
    world.resize(1440, 900, 7, 10);
    const shark = world.sharks[0];
    world.pointer.update(shark.nodes[0] + Math.cos(shark.heading) * 100,
      shark.nodes[1] + Math.sin(shark.heading) * 100, true, 0);
    for (let i = 0; i < 60 * 3; i++) world.step(1 / 60);
    expect(world.curiosity.sharkId).toBe(shark.id);
    for (let i = 0; i < 60 * 35; i++) world.step(1 / 60);
    expect(world.pointer.visited).toBe(true);
    expect(world.curiosity.sharkId).toBeNull();
    world.clearInteraction();
    expect(world.pointer.active).toBe(false);
    expect(world.pointer.visited).toBe(false);
    expect(world.curiosity.weight).toBe(0);
  }));

  test("hover timing is independent of the selected swim speed", () => {
    for (const speed of [0.5, 1, 1.5]) seeded(34, () => {
      const world = new World([{ kind: "classic", size: 1 }], 0);
      world.resize(1440, 900, 7, 10);
      const shark = world.sharks[0];
      world.pointer.update(shark.nodes[0] + Math.cos(shark.heading) * 100,
        shark.nodes[1] + Math.sin(shark.heading) * 100, true, 0);
      for (let i = 0; i < 48 * speed; i++) world.step(1 / 60, 1 / 60 / speed);
      expect(world.pointer.dwell).toBeCloseTo(0.8, 8);
      expect(world.curiosity.sharkId).toBe(shark.id);
      world.resize(768, 1024, 7, 10);
      expect(world.pointer.active).toBe(false);
    });
  });

  test("curiosity closes the gap faster while preserving anatomy and bounded motion", () => {
    function approach(interactive: boolean) {
      return seeded(19, () => {
        const world = new World([{ kind: "classic", size: 1 }], 0);
        world.resize(1440, 900, 7, 10);
        const shark = world.sharks[0];
        shark.heading = 0;
        for (let k = 0; k < SHARK_NODES; k++) {
          shark.nodes[k * 2] = 600 - k * shark.length / (SHARK_NODES - 1);
          shark.nodes[k * 2 + 1] = 450;
        }
        if (interactive) world.pointer.update(950, 450, true, 0);
        let maxSpeed = 0, maxTurn = 0, maxSegmentError = 0;
        for (let frame = 0; frame < 240; frame++) {
          world.step(1 / 60);
          maxSpeed = Math.max(maxSpeed, shark.speed / (14 + shark.length * 0.028));
          maxTurn = Math.max(maxTurn, Math.abs(shark.turn));
          for (let k = 1; k < SHARK_NODES; k++) {
            const segment = Math.hypot(shark.nodes[k * 2] - shark.nodes[k * 2 - 2], shark.nodes[k * 2 + 1] - shark.nodes[k * 2 - 1]);
            maxSegmentError = Math.max(maxSegmentError, Math.abs(segment - shark.length / (SHARK_NODES - 1)));
          }
        }
        return { distance: Math.hypot(950 - shark.nodes[0], 450 - shark.nodes[1]), maxSpeed, maxTurn, maxSegmentError };
      });
    }
    const normal = approach(false), curious = approach(true);
    expect(curious.distance).toBeLessThan(normal.distance - 25);
    expect(curious.maxSpeed).toBeGreaterThan(1.35);
    expect(curious.maxSpeed).toBeLessThan(1.75);
    expect(curious.maxTurn).toBeLessThanOrEqual(0.38);
    expect(curious.maxSegmentError).toBeLessThan(0.001);
  });
});
