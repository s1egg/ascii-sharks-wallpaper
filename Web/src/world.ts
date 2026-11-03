/**
 * A quiet ocean for a desktop painting: fish schools and slowly cruising sharks.
 *
 * Fish: Reynolds boids (separation / alignment / cohesion) in Couzin-style
 * zones, with a blind spot behind each fish. Alarm spreads from fish to fish
 * through the school (a "wave of agitation"), so a whole school bolts even
 * when only its edge can see the shark. Fleeing fish break sideways around the
 * shark's path, which gives the fountain effect seen in real bait balls.
 *
 * Sharks: Reynolds steering (wander + pursuit + separation) on a
 * follow-the-leader spine. Hunger builds over time and drops when they eat.
 * They prefer fish in sparse spots, since dense schools confuse predators,
 * so stragglers get picked off. Eaten fish come back later as new schools
 * swimming in from the edges, which keeps the population steady.
 */
import { angleDiff, clamp, current, hash3, rand, randInt, smoothstep, TAU } from "./math";
import { pickSpecies, SPECIES } from "./species";
import { WaterInteraction } from "./interaction";

export const SHARK_NODES = 20;

export type SharkKind = "classic" | "hammerhead" | "zebra" | "tiger" | "greathammer" | "mako" | "thresher" | "nurse";

/** Which sharks to put in the water; size is relative to the biggest. */
export type SharkSpec = { kind: SharkKind; size: number };

// Four depths, with enough open water between silhouettes.
const DEFAULT_SHARKS: SharkSpec[] = [
  { kind: "classic", size: 1 },
  { kind: "classic", size: 0.7 },
  { kind: "classic", size: 0.84 },
  { kind: "classic", size: 0.77 },
];

export interface Fish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  species: number;
  /** Small, persistent groups do not merge just because they share a species. */
  school: number;
  /** 0 calm → 1 panicking. Spreads to neighbours. */
  alarm: number;
  alive: boolean;
  respawnAt: number;
  /** Tail-beat phase. */
  phase: number;
  /** Smoothed angular velocity (rad/s); hard turns flash silver. */
  turn: number;
  /** 0.55 far → 1 near. */
  depth: number;
  /** Rotation sense shared by a school when it mills into a bait ball. */
  millDir: 1 | -1;
}

export interface Shark {
  id: number;
  kind: SharkKind;
  length: number;
  /** Spine positions, snout first: [x0, y0, x1, y1, ...]. */
  nodes: Float32Array;
  heading: number;
  speed: number;
  /** Tail-beat phase; drives the body wave in the renderer. */
  phase: number;
  /** Slowly varying propulsion: a full stroke eases into a quieter glide. */
  stroke: number;
  /** Smoothed angular velocity (rad/s); the shark banks its fins into turns. */
  turn: number;
  hunger: number;
  wander: number;
  orbitDir: 1 | -1;
  orbitRadius: number;
  target: Fish | null;
  retargetAt: number;
  /** 0 far / dim → 1 near / bright. */
  depth: number;
  patrolDirection: 1 | -1;
  patrolLane: number;
  burst: number;
  burstStartedAt: number;
  nextBurstAt: number;
}

export type OceanMoment =
  | { kind: "crossing"; startedAt: number; school: number; direction: 1 | -1; lane: number; crossed: boolean }
  | { kind: "visitor"; startedAt: number; direction: 1 | -1; lane: number; duration: number; opacity: number };

export interface WorldEvent {
  kind: "eat" | "splash";
  x: number;
  y: number;
}

const FISH_SEPARATION_K = 420;
const FISH_ALIGN_K = 1.4;
const FISH_COHESION_K = 1;
const FISH_FLEE_K = 1100;
const BLIND_COS = -0.6; // ~127° either side of the heading is visible

export class World {
  width = 0;
  height = 0;
  time = 0;
  fish: Fish[] = [];
  sharks: Shark[] = [];
  visitors: Shark[] = [];
  moment: OceanMoment | null = null;
  momentsStarted = 0;
  momentsCompleted = 0;
  events: WorldEvent[] = [];
  pointer = new WaterInteraction();
  curiosity = { sharkId: null as number | null, x: 0, y: 0, age: 0, weight: 0 };

  /** Fish neighbourhood radius; the spatial hash bucket size matches it. */
  private perception = 60;
  /** Per-species personal space in px (x, y). */
  private sepX: number[] = [];
  private sepY: number[] = [];
  private foreignSep = 40;
  private bucketCols = 0;
  private bucketRows = 0;
  private bucketHead = new Int32Array(0);
  private bucketCount = new Uint16Array(0);
  private bucketNext = new Int32Array(0);
  private lastSpawn = 0;
  private nextSchool = 1;
  private nextMomentAt = Infinity;
  private nextMomentKind: OceanMoment["kind"] = "crossing";
  private nextVisitorID = 1000;
  private tmp = { x: 0, y: 0 };

  /** fishCount overrides the area-based population (the sidebar wants a single small school). */
  constructor(
    private sharkSpecs: SharkSpec[] = DEFAULT_SHARKS,
    private fishCount?: number,
  ) {}

  resize(width: number, height: number, cellW: number, cellH: number) {
    this.clearInteraction();
    const first = this.width === 0;
    const previousWidth = this.width;
    const previousHeight = this.height;
    this.width = width;
    this.height = height;
    // Keep the original spatial-hash units while drawing in continuous coordinates.
    this.sepX = SPECIES.map((sp) => sp.spacing[0] * cellW);
    this.sepY = SPECIES.map((sp) => sp.spacing[1] * cellH);
    this.perception = Math.max(cellH * 3, cellW * 5.5);
    this.foreignSep = cellW * 4.5;

    if (first) {
      this.seed();
      return;
    }
    const scaleX = width / previousWidth;
    const scaleY = height / previousHeight;
    const lengthScale = clamp(Math.min(width, height) * 0.41, 140, 460)
      / clamp(Math.min(previousWidth, previousHeight) * 0.41, 140, 460);
    for (const f of this.fish) {
      f.x = clamp(f.x * scaleX, 0, width);
      f.y = clamp(f.y * scaleY, 0, height);
    }
    for (const shark of [...this.sharks, ...this.visitors]) {
      const oldHeadX = shark.nodes[0];
      const oldHeadY = shark.nodes[1];
      for (let k = 0; k < SHARK_NODES; k++) {
        shark.nodes[k * 2] = oldHeadX * scaleX + (shark.nodes[k * 2] - oldHeadX) * lengthScale;
        shark.nodes[k * 2 + 1] = oldHeadY * scaleY + (shark.nodes[k * 2 + 1] - oldHeadY) * lengthScale;
      }
      shark.length *= lengthScale;
      shark.orbitRadius *= Math.min(width, height) / Math.min(previousWidth, previousHeight);
    }
    if (this.moment?.kind === "visitor" && this.visitors[0]) {
      const visitor = this.visitors[0];
      const remaining = this.moment.direction > 0 ? width + visitor.length * 1.4 - visitor.nodes[0]
        : visitor.nodes[0] + visitor.length * 1.4;
      this.moment.duration = this.time - this.moment.startedAt + Math.max(6, remaining / clamp(width / 38, 24, 52) + 6);
    }
  }

  seed() {
    const { width: W, height: H } = this;
    const minSide = Math.min(W, H);
    const baseLength = clamp(minSide * 0.41, 140, 460);
    const sharkCount = this.sharkSpecs.length;
    // A loose diagonal composition, not four equally spaced points on a wheel.
    const composition = [
      [0.7, 0.43, -0.52], [0.3, 0.24, -0.24],
      [0.25, 0.68, -2.65], [0.83, 0.76, 0.4],
    ];

    this.sharks = [];
    for (let i = 0; i < sharkCount; i++) {
      const { kind, size } = this.sharkSpecs[i];
      const length = baseLength * size;
      const orbitRadius = minSide * rand(0.27, 0.38);
      const a = (i / sharkCount) * TAU - 0.4 + rand(-0.16, 0.16);
      const orbitDir: 1 | -1 = i % 2 === 0 ? 1 : -1;
      const placement = sharkCount === 1 ? [0.61, 0.45, -0.4] : composition[i];
      const x = placement ? W * (placement[0] + rand(-0.018, 0.018)) : W / 2 + Math.cos(a) * orbitRadius;
      const y = placement ? H * (placement[1] + rand(-0.018, 0.018)) : H / 2 + Math.sin(a) * orbitRadius;
      let heading = placement ? placement[2] + rand(-0.08, 0.08) : a + orbitDir * Math.PI / 2;
      if (kind === "hammerhead" || kind === "greathammer") heading = Math.cos(heading) >= 0 ? -0.04 : Math.PI + 0.04;
      const nodes = new Float32Array(SHARK_NODES * 2);
      const seg = length / (SHARK_NODES - 1);
      for (let n = 0; n < SHARK_NODES; n++) {
        nodes[n * 2] = x - Math.cos(heading) * seg * n;
        nodes[n * 2 + 1] = y - Math.sin(heading) * seg * n;
      }
      this.sharks.push({
        id: i + 1,
        kind,
        length,
        nodes,
        heading,
        speed: 14 + length * 0.028,
        phase: rand(0, TAU),
        stroke: 0.82,
        turn: 0,
        hunger: rand(0.12, 0.45),
        wander: 0,
        orbitDir,
        orbitRadius,
        target: null,
        retargetAt: 0,
        depth: size,
        patrolDirection: Math.cos(heading) >= 0 ? 1 : -1,
        patrolLane: clamp(y / H, 0.28, 0.72),
        burst: 0,
        burstStartedAt: -Infinity,
        nextBurstAt: kind === "mako" ? 14 + hash3(i + 1, 37, 19) * 14 : Infinity,
      });
    }
    // Smaller (farther) sharks draw first so the big one swims over them.
    this.sharks.sort((a, b) => a.length - b.length);

    const total = this.fishCount ?? clamp(Math.round((W * H) / 24000), 24, 64);
    this.fish = [];
    const centers: { x: number; y: number }[] = [];
    while (this.fish.length < total) {
      const species = pickSpecies();
      const sp = SPECIES[species];
      const size = Math.min(randInt(sp.schoolSize[0], sp.schoolSize[1]), total - this.fish.length);
      const millDir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const school = this.nextSchool++;
      const depth = rand(0.58, 0.94);
      // Spread a few loose groups around open water instead of stacking random clumps.
      let cx = 0, cy = 0, bestClearance = -Infinity;
      for (let attempt = 0; attempt < 12; attempt++) {
        const x = rand(W * 0.1, W * 0.9), y = rand(H * 0.12, H * 0.88);
        const central = ((x - W / 2) / (W * 0.23)) ** 2 + ((y - H / 2) / (H * 0.18)) ** 2;
        const clearance = Math.min(Math.min(W, H) * 0.2,
          ...centers.map(center => Math.hypot(x - center.x, y - center.y))) - (central < 1 ? 150 : 0);
        if (clearance > bestClearance) { cx = x; cy = y; bestClearance = clearance; }
        if (clearance >= Math.min(W, H) * 0.2) break;
      }
      centers.push({ x: cx, y: cy });
      // Mostly level headings: fish cruise sideways far more than up or down.
      const dir = (Math.random() < 0.5 ? 0 : Math.PI) + rand(-0.5, 0.5);
      for (let k = 0; k < size; k++) {
        const along = ((k - (size - 1) / 2) * 1.35 + rand(-0.2, 0.2)) * this.sepX[species];
        const across = rand(-0.9, 0.9) * this.sepY[species];
        this.fish.push({
          x: cx + Math.cos(dir) * along - Math.sin(dir) * across,
          y: cy + Math.sin(dir) * along + Math.cos(dir) * across,
          vx: Math.cos(dir) * sp.cruise,
          vy: Math.sin(dir) * sp.cruise,
          species,
          school,
          alarm: 0,
          alive: true,
          respawnAt: 0,
          phase: rand(0, TAU),
          turn: 0,
          depth: clamp(depth + rand(-0.035, 0.035), 0.55, 1),
          millDir,
        });
      }
    }
    this.bucketNext = new Int32Array(this.fish.length);
    this.visitors = [];
    this.moment = null;
    this.momentsStarted = this.momentsCompleted = 0;
    this.nextMomentKind = "crossing";
    this.nextMomentAt = this.fishCount === undefined && this.sharks.length
      ? this.time + 55 + hash3(Math.round(W), Math.round(H), sharkCount) * 30 : Infinity;
  }

  splash(x: number, y: number) {
    this.events.push({ kind: "splash", x, y });
    const r = 240;
    for (const f of this.fish) {
      if (!f.alive) continue;
      const dx = f.x - x;
      const dy = f.y - y;
      const d = Math.hypot(dx, dy);
      if (d > r || d < 1e-3) continue;
      // Flash expansion: everybody nearby bolts straight out.
      const k = (1 - d / r) * 260;
      f.vx += (dx / d) * k;
      f.vy += (dy / d) * k;
      f.alarm = 1;
    }
  }

  clearInteraction() {
    this.pointer.clear();
    this.curiosity.sharkId = null;
    this.curiosity.weight = this.curiosity.age = 0;
  }

  private stepInteraction(dt: number) {
    const pointer = this.pointer, visit = this.curiosity;
    pointer.step(dt);
    // Water marks belong to an encounter with a live fish, not to the cursor.
    // Swept hits catch fast passes between native samples without trailing into empty water.
    for (const sweep of pointer.takeSweeps()) {
      const dx = sweep.x - sweep.fromX, dy = sweep.y - sweep.fromY;
      const length2 = dx * dx + dy * dy;
      let first = Infinity;
      for (const fish of this.fish) {
        if (!fish.alive) continue;
        const t = clamp(((fish.x - sweep.fromX) * dx + (fish.y - sweep.fromY) * dy) / length2, 0, 1);
        const x = sweep.fromX + dx * t, y = sweep.fromY + dy * t;
        if ((fish.x - x) ** 2 + (fish.y - y) ** 2 <= 28 ** 2 && t < first) first = t;
      }
      if (first !== Infinity) pointer.contact(sweep.fromX + dx * first, sweep.fromY + dy * first, sweep);
    }
    const interested = pointer.active && pointer.dwell >= 0.6;
    if (interested && !pointer.visited && visit.sharkId === null) {
      let nearest: Shark | undefined;
      let distance = Infinity;
      for (const shark of this.sharks) {
        const dx = pointer.x - shark.nodes[0], dy = pointer.y - shark.nodes[1];
        const d = Math.hypot(dx, dy);
        // A passing animal can notice a nearby point without an abrupt U-turn.
        const ahead = (dx * Math.cos(shark.heading) + dy * Math.sin(shark.heading)) / Math.max(1, d);
        if (d < Math.min(540, shark.length * 1.8) && d < distance
          && (ahead > -0.25 || d < shark.length * 0.5)) {
          nearest = shark;
          distance = d;
        }
      }
      if (nearest) {
        visit.sharkId = nearest.id;
        visit.x = pointer.x;
        visit.y = pointer.y;
        visit.age = 0;
        pointer.visited = true;
      }
    }
    if (visit.sharkId !== null) {
      visit.age += dt;
      // A parked cursor earns one short visit, not an endless orbit.
      const desired = interested && pointer.visited && visit.age < 12 ? 1 : 0;
      visit.weight += (desired - visit.weight) * (1 - Math.exp(-dt * (desired ? 4.5 : 2.8)));
      if (!desired && visit.weight < 0.01) {
        visit.sharkId = null;
        visit.weight = 0;
      }
    }
  }

  step(dt: number, interactionDt = dt) {
    this.time += dt;
    this.stepInteraction(interactionDt);
    this.stepMoments(dt);
    this.rebuildHash();
    this.stepFish(dt);
    this.stepSharks(dt);
    this.respawn();
  }

  private rebuildHash() {
    const size = this.perception;
    const pad = 2;
    this.bucketCols = Math.ceil(this.width / size) + pad * 2;
    this.bucketRows = Math.ceil(this.height / size) + pad * 2;
    const n = this.bucketCols * this.bucketRows;
    if (this.bucketHead.length !== n) {
      this.bucketHead = new Int32Array(n);
      this.bucketCount = new Uint16Array(n);
    }
    this.bucketHead.fill(-1);
    this.bucketCount.fill(0);
    if (this.bucketNext.length !== this.fish.length) {
      this.bucketNext = new Int32Array(this.fish.length);
    }
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i];
      if (!f.alive) continue;
      const b = this.bucketOf(f.x, f.y);
      this.bucketNext[i] = this.bucketHead[b];
      this.bucketHead[b] = i;
      this.bucketCount[b]++;
    }
  }

  private bucketOf(x: number, y: number) {
    const size = this.perception;
    const c = clamp(Math.floor(x / size) + 2, 0, this.bucketCols - 1);
    const r = clamp(Math.floor(y / size) + 2, 0, this.bucketRows - 1);
    return r * this.bucketCols + c;
  }

  private stepFish(dt: number) {
    const { fish, sharks, pointer, width: W, height: H, time } = this;
    const R = this.perception;
    const R2 = R * R;
    const foreignSep = this.foreignSep;
    const size = this.perception;
    const cols = this.bucketCols;
    const rows = this.bucketRows;
    const head = this.bucketHead;
    const next = this.bucketNext;
    const cur = this.tmp;
    const calmDecay = Math.exp(-dt * 0.7);
    const contagion = Math.min(1, dt * 6);
    const crossing = this.moment?.kind === "crossing" ? this.moment : null;

    for (let i = 0; i < fish.length; i++) {
      const f = fish[i];
      if (!f.alive) continue;
      const sp = SPECIES[f.species];
      const passing = crossing?.school === f.school;
      // Alarmed fish want more room: the school flashes apart around a
      // shark and closes back up once the threat fades.
      const spread = 1 + 1.8 * f.alarm;
      const sepX = this.sepX[f.species] * spread;
      const sepY = this.sepY[f.species] * spread;

      const speed = Math.hypot(f.vx, f.vy) || 1;
      const hx = f.vx / speed;
      const hy = f.vy / speed;

      let ax = 0;
      let ay = 0;
      let sx = 0;
      let sy = 0;
      let avx = 0;
      let avy = 0;
      let cx = 0;
      let cy = 0;
      let n = 0;
      let neighbourAlarm = 0;

      const bc = clamp(Math.floor(f.x / size) + 2, 0, cols - 1);
      const br = clamp(Math.floor(f.y / size) + 2, 0, rows - 1);
      for (let r = Math.max(0, br - 1); r <= Math.min(rows - 1, br + 1); r++) {
        for (let c = Math.max(0, bc - 1); c <= Math.min(cols - 1, bc + 1); c++) {
          let j = head[r * cols + c];
          while (j !== -1) {
            if (j !== i) {
              const o = fish[j];
              const dx = o.x - f.x;
              const dy = o.y - f.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < R2 && d2 > 1e-6) {
                const d = Math.sqrt(d2);
                // Blind zone directly behind the fish.
                if ((dx * hx + dy * hy) / d > BLIND_COS) {
                  // Elliptical personal space: wide along x, tight along y.
                  const qx = dx / sepX;
                  const qy = dy / sepY;
                  const q2 = qx * qx + qy * qy;
                  if (q2 < 1) {
                    const q = Math.sqrt(q2) || 1e-3;
                    const k = (1 - q) / q;
                    sx -= qx * k;
                    sy -= qy * k;
                  }
                  if (o.school === f.school) {
                    avx += o.vx;
                    avy += o.vy;
                    cx += dx;
                    cy += dy;
                    n++;
                  } else if (d < foreignSep) {
                    // Separate groups keep space, even within the same species.
                    const k = ((1 - d / foreignSep) / d) * 0.6;
                    sx -= dx * k;
                    sy -= dy * k;
                  }
                  if (o.alarm > neighbourAlarm) neighbourAlarm = o.alarm;
                }
              }
            }
            j = next[j];
          }
        }
      }

      ax += sx * FISH_SEPARATION_K;
      ay += sy * FISH_SEPARATION_K;
      if (n > 0) {
        const alignK = FISH_ALIGN_K * sp.align;
        const cohesionK = FISH_COHESION_K * sp.cohesion * (1 - 0.8 * f.alarm);
        ax += (avx / n - f.vx) * alignK + (cx / n) * cohesionK;
        ay += (avy / n - f.vy) * alignK + (cy / n) * cohesionK;
        if (sp.mill > 0) {
          // Circle the local centre: the school spins into a bait ball.
          const cl = Math.hypot(cx, cy) || 1;
          ax += (-cy / cl) * f.millDir * sp.mill * (1 - f.alarm);
          ay += (cx / cl) * f.millDir * sp.mill * (1 - f.alarm);
        }
      }

      // Predators. Distance is measured to the nearest point along the front
      // half of the shark, so fish also give the flanks a wide berth.
      let fear = 0;
      for (const sh of sharks) {
        const fearR = sh.length * 0.6 + 60;
        let best = Infinity;
        let bx = 0;
        let by = 0;
        for (let k = 0; k <= 12; k += 3) {
          const nx = sh.nodes[k * 2];
          const ny = sh.nodes[k * 2 + 1];
          const d2 = (f.x - nx) ** 2 + (f.y - ny) ** 2;
          if (d2 < best) {
            best = d2;
            bx = nx;
            by = ny;
          }
        }
        const d = Math.sqrt(best);
        if (d >= fearR || d < 1e-3) continue;
        let w = 1 - d / fearR;
        w *= w;
        const awayX = (f.x - bx) / d;
        const awayY = (f.y - by) / d;
        // Fountain effect: break to whichever side of the shark's path you're on.
        const shx = Math.cos(sh.heading);
        const shy = Math.sin(sh.heading);
        const side = shx * (f.y - sh.nodes[1]) - shy * (f.x - sh.nodes[0]) >= 0 ? 1 : -1;
        ax += (awayX * 0.7 - shy * side * 0.9) * FISH_FLEE_K * w;
        ay += (awayY * 0.7 + shx * side * 0.9) * FISH_FLEE_K * w;
        fear = Math.max(fear, Math.sqrt(w));
      }

      if (pointer.influence > 0.005) {
        const pr = 100 + pointer.influence * 140;
        const dx = f.x - pointer.x;
        const dy = f.y - pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < pr && d > 1e-3) {
          const w = (1 - d / pr) ** 1.6;
          ax += (dx / d) * FISH_FLEE_K * w * pointer.influence * 1.1;
          ay += (dy / d) * FISH_FLEE_K * w * pointer.influence * 1.1;
          fear = Math.max(fear, Math.sqrt(w) * pointer.influence * 0.85);
        }
      }

      // Alarm: direct threat sets it, neighbours pass it along (slightly
      // weaker each hop), and it fades on its own.
      let alarm = Math.max(f.alarm * calmDecay, fear);
      const relayed = neighbourAlarm * 0.86;
      if (relayed > alarm) alarm += (relayed - alarm) * contagion;
      f.alarm = alarm;

      // Soft walls.
      const m = 36;
      if (f.x < m) ax += (m - f.x) * 7;
      else if (f.x > W - m) ax -= (f.x - (W - m)) * 7;
      if (f.y < m) ay += (m - f.y) * 7;
      else if (f.y > H - m) ay -= (f.y - (H - m)) * 7;

      // Ambient current and a little individual restlessness.
      if (passing && crossing) {
        const tx = (crossing.crossed ? (crossing.direction > 0 ? 0.9 : 0.1) : 0.5) * W - f.x;
        const ty = crossing.lane * H - f.y;
        const distance = Math.hypot(tx, ty) || 1;
        const calm = 1 - f.alarm * 0.85;
        ax += (tx / distance * sp.cruise * 1.15 - f.vx) * 0.9 * calm;
        ay += (ty / distance * sp.cruise * 1.15 - f.vy) * 1.3 * calm;
      }
      current(f.x, f.y, time, cur);
      ax += cur.x * 0.5 + (Math.random() - 0.5) * sp.jitter;
      ay += cur.y * 0.5 + (Math.random() - 0.5) * sp.jitter;
      // Swim level, except when bolting from danger.
      ay -= f.vy * sp.verticalDrag * (1 - 0.7 * f.alarm) * (passing ? 0.35 : 1);

      // Relax toward a preferred speed that rises with panic.
      const preferred = sp.cruise * (1 + 1.3 * f.alarm);
      ax += (preferred - speed) * hx * 1.6;
      ay += (preferred - speed) * hy * 1.6;

      const before = Math.atan2(f.vy, f.vx);
      f.vx += ax * dt;
      f.vy += ay * dt;
      const maxSpeed = sp.maxSpeed * (1 + 1.8 * f.alarm);
      const s = Math.hypot(f.vx, f.vy);
      if (s > maxSpeed) {
        f.vx *= maxSpeed / s;
        f.vy *= maxSpeed / s;
      } else if (s < sp.minSpeed && s > 1e-3) {
        f.vx *= sp.minSpeed / s;
        f.vy *= sp.minSpeed / s;
      }
      f.turn += (angleDiff(before, Math.atan2(f.vy, f.vx)) / dt - f.turn) * Math.min(1, dt * 8);
      f.phase += dt * (7 + Math.hypot(f.vx, f.vy) * 0.12);
      f.x = clamp(f.x + f.vx * dt, -60, W + 60);
      f.y = clamp(f.y + f.vy * dt, -60, H + 60);
    }
  }

  private stepSharks(dt: number) {
    const { sharks, width: W, height: H, time } = this;
    const minSide = Math.min(W, H);
    const cxW = W / 2;
    const cyW = H / 2;

    for (const sh of sharks) {
      const L = sh.length;
      const nodes = sh.nodes;
      const hx = nodes[0];
      const hy = nodes[1];
      const patrolling = sh.kind === "hammerhead" || sh.kind === "greathammer";
      const longTail = sh.kind === "thresher";

      sh.hunger = Math.min(1, sh.hunger + dt * 0.012);

      // Momentum.
      let dx = Math.cos(sh.heading);
      let dy = Math.sin(sh.heading);

      // Continuous currents, not frame-by-frame jitter: one unhurried brush gesture.
      sh.wander = Math.sin(time * 0.085 + sh.id * 2.4) * 0.48
        + Math.sin(time * 0.037 + sh.id) * 0.24;
      dx += Math.cos(sh.heading + sh.wander) * 0.5;
      dy += Math.sin(sh.heading + sh.wander) * 0.5;

      // Hunt.
      if (time >= sh.retargetAt) {
        sh.target = this.findPrey(sh);
        sh.retargetAt = time + 1.2;
      }
      const t = sh.target;
      const curiosity = this.curiosity.sharkId === sh.id ? this.curiosity.weight : 0;
      if (sh.kind === "mako" && time >= sh.nextBurstAt) {
        const aheadX = hx + Math.cos(sh.heading) * (14 + L * 0.028) * 7;
        const aheadY = hy + Math.sin(sh.heading) * (14 + L * 0.028) * 7;
        const clear = Math.min(hx, W - hx, hy, H - hy) > L * 0.45
          && aheadX > 60 && aheadX < W - 60 && aheadY > 60 && aheadY < H - 60;
        if (clear && this.curiosity.sharkId === null && !this.moment) {
          sh.burstStartedAt = time;
          sh.nextBurstAt = time + 34 + hash3(sh.id, Math.floor(time), 71) * 24;
        } else sh.nextBurstAt = time + 2;
      }
      const burstAge = time - sh.burstStartedAt;
      sh.burst = burstAge >= 0 && burstAge < 3 ? Math.sin(burstAge / 3 * Math.PI) ** 2 : 0;
      let hunting = false;
      let closing = 0;
      if (t && t.alive && sh.hunger > 0.5) {
        // Pursuit: aim at where the fish is about to be.
        const tx = t.x + t.vx * 0.35 - hx;
        const ty = t.y + t.vy * 0.35 - hy;
        const d = Math.hypot(tx, ty) || 1;
        const w = (0.65 + sh.hunger * 1.1) * (1 - curiosity);
        dx += (tx / d) * w;
        dy += (ty / d) * w;
        hunting = curiosity < 0.3;
        closing = clamp(1 - d / (L * 0.9), 0, 1);
      } else {
        // A broad circuit holds the open centre of the composition.
        const rx = (hx - cxW) / (W / minSide);
        const ry = hy - cyW;
        const r = Math.hypot(rx, ry) || 1;
        const radius = sh.orbitRadius * (1 + 0.15 * Math.sin(time * 0.05 + sh.id));
        const radial = clamp((radius - r) / radius, -1, 1);
        const orbitWeight = patrolling ? 0.18 : 0.55;
        dx += ((-ry / r) * sh.orbitDir + (rx / r) * radial * 0.9) * orbitWeight;
        dy += ((rx / r) * sh.orbitDir + (ry / r) * radial * 0.9) * orbitWeight;
      }

      if (patrolling) {
        const margin = Math.max(L * 0.6, W * 0.14);
        if (hx > W - margin) sh.patrolDirection = -1;
        else if (hx < margin) sh.patrolDirection = 1;
        const lane = H * (sh.patrolLane + Math.sin(time * 0.025 + sh.id) * 0.045);
        const weight = (1 - curiosity) * (hunting ? 0.35 : 1);
        dx += sh.patrolDirection * 2.4 * weight;
        dy += clamp((lane - hy) / (H * 0.14), -1, 1) * 1.25 * weight;
      }

      let curiousApproach = 0;
      if (curiosity > 0) {
        const tx = this.curiosity.x - hx, ty = this.curiosity.y - hy;
        const d = Math.hypot(tx, ty) || 1;
        const radius = Math.max(65, L * 0.3);
        curiousApproach = curiosity * smoothstep(radius * 0.85, radius * 2.8, d);
        const approach = clamp((d - radius) / radius, -0.8, 1);
        const tangent = 1 - smoothstep(radius, radius * 3, d);
        dx += (tx / d * approach - ty / d * sh.orbitDir * tangent) * 2.8 * curiosity;
        dy += (ty / d * approach + tx / d * sh.orbitDir * tangent) * 2.8 * curiosity;
      }

      // Give other sharks room.
      for (const other of sharks) {
        if (other === sh) continue;
        for (let k = 0; k < SHARK_NODES; k += 4) {
          const ox = hx - other.nodes[k * 2];
          const oy = hy - other.nodes[k * 2 + 1];
          const d = Math.hypot(ox, oy);
          const range = (L + other.length) * 0.45;
          if (d < range && d > 1e-3) {
            const w = (1 - d / range) * 3;
            dx += (ox / d) * w;
            dy += (oy / d) * w;
          }
        }
      }

      // Leave breathing room in the centre, like unpainted paper in a handscroll.
      const ex = (hx - cxW) / (W * 0.22);
      const ey = (hy - cyW) / (H * 0.14);
      const e2 = ex * ex + ey * ey;
      if (e2 < 1) {
        const e = Math.sqrt(e2) || 1e-3;
        const w = (1 - e) * (hunting ? 0.15 : 0.5);
        dx += (ex / e) * w;
        dy += (ey / e) * w;
      }

      // Anticipate the edge. Wide turns need room before the head reaches it.
      const lookX = hx + Math.cos(sh.heading) * L * 1.2;
      const lookY = hy + Math.sin(sh.heading) * L * 1.2;
      const over = Math.max(-lookX, lookX - W, -lookY, lookY - H, -hx, hx - W, -hy, hy - H);
      const edgeAttention = smoothstep(-L * 0.16, L * 0.3, over);
      if (over > -L * 0.16) {
        const w = clamp((over + L * 0.16) / (L * 0.42), 0, 1) * 6;
        const toX = cxW - hx;
        const toY = cyW - hy;
        const d = Math.hypot(toX, toY) || 1;
        dx += (toX / d) * w;
        dy += (toY / d) * w;
      }

      const desired = Math.atan2(dy, dx);
      // Sharks can't pivot on the spot: the turning circle grows with speed.
      // Tighten smoothly near an edge so a long turn at a corner stays in view.
      const ordinaryRadius = (longTail ? 1.05 : 0.75) - curiosity * 0.35;
      const boundaryRadius = (longTail ? 1.05 : 0.75) - edgeAttention * (longTail ? 0.7 : 0.4);
      const turnRadius = Math.min(hunting ? Math.min(ordinaryRadius, 0.65) : ordinaryRadius, boundaryRadius);
      const turnLimit = longTail ? 0.13 + edgeAttention * 0.09 + curiosity * 0.1 : hunting ? 0.3 : 0.2 + curiosity * 0.18;
      const agility = Math.min(turnLimit, sh.speed / (L * turnRadius));
      const desiredTurn = clamp(angleDiff(sh.heading, desired) * (0.65 + curiosity * 0.75), -agility, agility);
      sh.turn += (desiredTurn - sh.turn) * (1 - Math.exp(-dt * ((longTail ? 1 : 1.8) + curiosity * 2.2)));
      sh.heading += sh.turn * dt;

      const cruise = (14 + L * 0.028) * (longTail ? 0.86 : 1);
      // Each animal has its own long stroke/glide phrase, without stopping or
      // synchronising the school. Momentum outlasts the stronger tail strokes.
      const phrase = Math.sin(time * ((longTail ? 0.115 : 0.16) + sh.id * 0.009) + sh.id * 2.4);
      const targetStroke = hunting ? 0.96 : Math.max(0.42 + smoothstep(-0.65, 0.8, phrase) * 0.54, curiousApproach * 0.96, sh.burst);
      sh.stroke += (targetStroke - sh.stroke) * (1 - Math.exp(-dt * (0.8 + curiosity * 1.2)));
      const breath = 1 + 0.025 * Math.sin(time * 0.19 + sh.id * 1.7);
      // Notice promptly, close the gap, then ease back down beside the pointer.
      const usualSpeed = (hunting ? 1.12 + closing * 0.22 : 0.88 + sh.stroke * 0.12) * (1 + curiousApproach * 0.7);
      const targetSpeed = cruise * breath * Math.max(usualSpeed, 0.9 + sh.burst * 0.9);
      sh.speed += (targetSpeed - sh.speed) * (1 - Math.exp(-dt * (0.48 + curiosity * 1.2 + sh.burst * 1.5)));
      const cadence = sh.kind === "mako" ? 1.08 : longTail ? 0.74 : sh.kind === "zebra" ? 0.88 : 1;
      sh.phase += dt * (0.92 + sh.speed / 58) * (0.76 + sh.stroke * 0.24) * cadence;

      this.advanceShark(sh, dt);

      // Feed.
      if (sh.hunger > 0.15) {
        const mouthR = L * 0.05 + 8;
        const mx = nodes[0];
        const my = nodes[1];
        for (const f of this.fish) {
          if (!f.alive) continue;
          if ((f.x - mx) ** 2 + (f.y - my) ** 2 < mouthR * mouthR) {
            f.alive = false;
            f.respawnAt = time + rand(3, 8);
            sh.hunger = Math.max(0, sh.hunger - 0.16);
            this.events.push({ kind: "eat", x: f.x, y: f.y });
          }
        }
      }
    }
  }

  private advanceShark(shark: Shark, dt: number) {
    const nodes = shark.nodes;
    nodes[0] += Math.cos(shark.heading) * shark.speed * dt;
    nodes[1] += Math.sin(shark.heading) * shark.speed * dt;
    const segment = shark.length / (SHARK_NODES - 1);
    let previousAngle = shark.heading + Math.PI;
    for (let k = 1; k < SHARK_NODES; k++) {
      const maxBend = 0.075 + k / (SHARK_NODES - 1) * 0.065;
      const px = nodes[(k - 1) * 2], py = nodes[(k - 1) * 2 + 1];
      let angle = Math.atan2(nodes[k * 2 + 1] - py, nodes[k * 2] - px);
      angle = previousAngle + clamp(angleDiff(previousAngle, angle), -maxBend, maxBend);
      nodes[k * 2] = px + Math.cos(angle) * segment;
      nodes[k * 2 + 1] = py + Math.sin(angle) * segment;
      previousAngle = angle;
    }
  }

  private finishMoment() {
    this.moment = null;
    this.visitors = [];
    this.momentsCompleted++;
    this.nextMomentAt = this.time + rand(90, 150);
  }

  private stepMoments(dt: number) {
    const { width: W, height: H, time } = this;
    if (!this.moment && time >= this.nextMomentAt) {
      if (this.curiosity.sharkId !== null || this.pointer.speed > 35 || this.sharks.some(shark => shark.burst > 0.05)) {
        this.nextMomentAt = time + 8;
        return;
      }
      if (this.nextMomentKind === "crossing") {
        const schools = new Map<number, { count: number; x: number; y: number }>();
        for (const fish of this.fish) {
          if (!fish.alive) continue;
          const group = schools.get(fish.school) ?? { count: 0, x: 0, y: 0 };
          group.count++; group.x += fish.x; group.y += fish.y;
          schools.set(fish.school, group);
        }
        let choice: { school: number; x: number } | null = null, best = -Infinity;
        for (const [school, group] of schools) {
          if (group.count < 3 || group.count > 7) continue;
          const x = group.x / group.count, y = group.y / group.count;
          const score = Math.abs(x - W / 2) / W - Math.abs(y - H / 2) / H * 0.2;
          if (score > best) { best = score; choice = { school, x }; }
        }
        if (!choice) { this.nextMomentAt = time + 15; return; }
        this.moment = { kind: "crossing", startedAt: time, school: choice.school,
          direction: choice.x < W / 2 ? 1 : -1, lane: rand(0.44, 0.56), crossed: false };
        this.nextMomentKind = "visitor";
      } else {
        const kinds: SharkKind[] = ["thresher", "nurse", "zebra", "greathammer"];
        const absent = kinds.filter(kind => !this.sharks.some(shark => shark.kind === kind));
        const pool = absent.length ? absent : kinds;
        const kind = pool[randInt(0, pool.length - 1)];
        const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
        const lane = Math.random() < 0.5 ? rand(0.2, 0.32) : rand(0.68, 0.8);
        const length = clamp(Math.min(W, H) * 0.41, 140, 460) * 0.56;
        const speed = clamp(W / 38, 24, 52), heading = direction > 0 ? 0 : Math.PI;
        const x = direction > 0 ? -length : W + length, y = H * lane;
        const nodes = new Float32Array(SHARK_NODES * 2);
        for (let k = 0; k < SHARK_NODES; k++) {
          nodes[k * 2] = x - direction * k * length / (SHARK_NODES - 1);
          nodes[k * 2 + 1] = y;
        }
        this.visitors = [{ id: this.nextVisitorID++, kind, length, nodes, heading, speed, phase: rand(0, TAU),
          stroke: 0.55, turn: 0, hunger: 0, wander: 0, orbitDir: direction, orbitRadius: 0, target: null,
          retargetAt: Infinity, depth: 0.52, patrolDirection: direction, patrolLane: lane,
          burst: 0, burstStartedAt: -Infinity, nextBurstAt: Infinity }];
        this.moment = { kind: "visitor", startedAt: time, direction, lane,
          duration: (W + length * 2.4) / speed + 6, opacity: 0 };
        this.nextMomentKind = "crossing";
      }
      this.momentsStarted++;
    }

    const moment = this.moment;
    if (!moment) return;
    const age = time - moment.startedAt;
    if (moment.kind === "crossing") {
      const group = this.fish.filter(fish => fish.alive && fish.school === moment.school);
      if (group.length < 2 || age > 70) { this.finishMoment(); return; }
      const x = group.reduce((sum, fish) => sum + fish.x, 0) / group.length;
      const y = group.reduce((sum, fish) => sum + fish.y, 0) / group.length;
      if (Math.hypot(x - W / 2, y - H * moment.lane) < Math.max(80, this.perception * 2)) moment.crossed = true;
      if (moment.crossed && (moment.direction > 0 ? x > W * 0.82 : x < W * 0.18)) this.finishMoment();
    } else {
      const shark = this.visitors[0];
      if (!shark || age >= moment.duration) { this.finishMoment(); return; }
      const opacity = smoothstep(0, 4, age) * (1 - smoothstep(moment.duration - 6, moment.duration, age)) * 0.65;
      moment.opacity += (opacity - moment.opacity) * (1 - Math.exp(-dt * 3));
      const lane = H * (moment.lane + Math.sin(age / moment.duration * TAU) * 0.025);
      const desired = Math.atan2((lane - shark.nodes[1]) * 0.015, moment.direction);
      const turn = clamp(angleDiff(shark.heading, desired) * 0.65, -0.1, 0.1);
      shark.turn += (turn - shark.turn) * (1 - Math.exp(-dt));
      shark.heading += shark.turn * dt;
      shark.speed += (clamp(W / 38, 24, 52) - shark.speed) * (1 - Math.exp(-dt * 0.8));
      shark.phase += dt * (shark.kind === "thresher" ? 1 : 1.35);
      this.advanceShark(shark, dt);
    }
  }

  /**
   * Pick prey in the shark's forward cone, preferring close fish in sparse
   * buckets (stragglers) over fish buried in a dense school.
   */
  private findPrey(sh: Shark): Fish | null {
    const range = sh.length * 0.9 + 160;
    const hx = sh.nodes[0];
    const hy = sh.nodes[1];
    const fx = Math.cos(sh.heading);
    const fy = Math.sin(sh.heading);
    let best: Fish | null = null;
    let bestScore = Infinity;
    let currentScore = Infinity;

    for (const f of this.fish) {
      if (!f.alive) continue;
      if (f.x < 0 || f.x > this.width || f.y < 0 || f.y > this.height) continue;
      const dx = f.x - hx;
      const dy = f.y - hy;
      const d = Math.hypot(dx, dy);
      if (d > range || d < 1e-3) continue;
      const cos = (dx * fx + dy * fy) / d;
      if (cos < 0.2) continue;
      const crowd = this.bucketCount[this.bucketOf(f.x, f.y)];
      const score = d * (1 + (1 - cos) * 0.8) * (1 + crowd * 0.07);
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
      if (f === sh.target) currentScore = score;
    }
    // Stick with the current target unless something is clearly better.
    if (sh.target && currentScore < bestScore * 1.3) return sh.target;
    return best;
  }

  private respawn() {
    const { time, width: W, height: H } = this;
    const due: Fish[] = [];
    for (const f of this.fish) if (!f.alive && f.respawnAt <= time) due.push(f);
    if (due.length === 0) return;
    if (due.length < 6 && time - this.lastSpawn < 9) return;
    this.lastSpawn = time;

    // A new school swims in from a random edge.
    const side = randInt(0, 3);
    const along = rand(0.15, 0.85);
    const x = side === 0 ? -20 : side === 1 ? W + 20 : along * W;
    const y = side === 2 ? -20 : side === 3 ? H + 20 : along * H;
    const inward = Math.atan2(H / 2 - y, W / 2 - x) + rand(-0.5, 0.5);
    const species = pickSpecies();
    const sp = SPECIES[species];
    const millDir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const school = this.nextSchool++;
    const depth = rand(0.58, 0.94);
    const arriving = due.slice(0, sp.schoolSize[1]);
    for (const [index, f] of arriving.entries()) {
      f.alive = true;
      f.species = species;
      f.school = school;
      f.depth = clamp(depth + rand(-0.035, 0.035), 0.55, 1);
      f.alarm = 0;
      f.turn = 0;
      f.millDir = millDir;
      const along = (index - (arriving.length - 1) / 2) * this.sepX[species] * 1.35;
      const across = rand(-0.9, 0.9) * this.sepY[species];
      f.x = x + Math.cos(inward) * along - Math.sin(inward) * across;
      f.y = y + Math.sin(inward) * along + Math.cos(inward) * across;
      f.vx = Math.cos(inward) * sp.cruise * 1.4;
      f.vy = Math.sin(inward) * sp.cruise * 1.4;
    }
  }
}

