/**
 * ASCII ink, adapted from stackedlol/ascii-sharks.
 * Every animal and wake is made of glyphs. The unpainted background is the water.
 * A sampled articulated spine keeps the original ASCII geometry; continuous
 * coverage and cached glyphs give it soft edges without flashing or solid tiles.
 */
import { clamp, hash3, smoothstep } from "./math";
import { SHAPES } from "./shapes";
import { writeSwimmingSpine } from "./motion";
import { SHARK_NODES, type Shark, type World } from "./world";

const GLYPHS = ".,:;itx%SX8#@o'-/\\~";
const RAMP = ".,:;itx%SX8#@";
const BODY = 1, FIN = 2, RIDGE = 3, EYE = 4, MARK = 5;
type Wake = { x: number; y: number; vx: number; vy: number; born: number; alpha: number; glyph: string };
type Palette = { paper: string; ink: string; mist: string; clay: string; light: string };

export class AsciiRenderer {
  private ctx: CanvasRenderingContext2D;
  private bg = document.createElement("canvas");
  private atlas = document.createElement("canvas");
  private dpr = 1;
  private width = 0;
  private height = 0;
  private cw = 6;
  private ch = 9;
  private cols = 0;
  private rows = 0;
  private fontFamily = "Menlo, Monaco, monospace";
  private glyphW = 1;
  private glyphH = 1;
  private palette: Palette;

  private alpha = new Float32Array(0);
  private target = new Float32Array(0);
  private glyph = new Uint8Array(0);
  private targetGlyph = new Uint8Array(0);
  private previousGlyph = new Uint8Array(0);
  private glyphBlend = new Float32Array(0);
  private occupied = new Uint8Array(0);
  private fresh = true;
  private spine = new Float32Array(SHARK_NODES * 2);
  private arc = new Float32Array(SHARK_NODES);
  private segmentLength = new Float32Array(SHARK_NODES - 1);
  private segmentInvLength2 = new Float32Array(SHARK_NODES - 1);
  private arcTotal = 1;
  private shape = SHAPES.classic;
  private sharkId = 0;
  private finLeft = 0;
  private finRight = 0;
  private hitFlag = BODY;
  private hitShade = 0;
  private hitCoverage = 0;
  private wakes: Wake[] = [];
  private wakeAt = new Map<number, number>();

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    const style = getComputedStyle(canvas);
    const color = (name: string) => style.getPropertyValue(`--water-${name}`).trim();
    this.palette = { paper: color("paper"), ink: color("ink"), mist: color("mist"), clay: color("clay"), light: color("light") };
  }

  get cellWidth() { return this.cw; }
  get cellHeight() { return this.ch; }

  setFontFamily(family: string) {
    if (family) this.fontFamily = family;
  }

  resize(width: number, height: number, dpr: number) {
    const geometryChanged = width !== this.width || height !== this.height;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.cw = clamp(Math.round(width / 210), 6, 9);
    this.ch = Math.round(this.cw * 1.45);
    this.cols = Math.ceil(width / this.cw);
    this.rows = Math.ceil(height / this.ch);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;
    const count = this.cols * this.rows;
    if (geometryChanged || this.alpha.length !== count) {
      this.alpha = new Float32Array(count);
      this.target = new Float32Array(count);
      this.glyph = new Uint8Array(count);
      this.targetGlyph = new Uint8Array(count);
      this.previousGlyph = new Uint8Array(count);
      this.glyphBlend = new Float32Array(count).fill(1);
      this.occupied = new Uint8Array(count);
      this.wakes.length = 0;
      this.wakeAt.clear();
      this.fresh = true;
    }
    this.paintBackground();
    this.paintAtlas();
  }

  private paintBackground() {
    const g = this.bg.getContext("2d")!;
    const { width: W, height: H, dpr } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { paper, ink, mist, clay, light } = this.palette;
    g.fillStyle = paper;
    g.fillRect(0, 0, W, H);
    // Uneven warm paper, with a shallow celadon wash gathered off-centre.
    // All pigment and fibres are baked once on resize, never animated noise.
    const wash = (x: number, y: number, rx: number, ry: number, color: string, opacity: number) => {
      g.save();
      g.translate(W * x, H * y);
      g.scale(W * rx, H * ry);
      const gradient = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.42, `${color}a0`);
      gradient.addColorStop(1, `${color}00`);
      g.globalAlpha = opacity;
      g.fillStyle = gradient;
      g.fillRect(-1, -1, 2, 2);
      g.restore();
    };
    wash(0.04, 0.08, 0.86, 0.9, clay, 0.11);
    wash(0.94, 0.87, 0.88, 1.04, mist, 0.24);
    wash(0.4, 0.3, 0.74, 0.82, light, 0.48);
    g.fillStyle = ink;
    for (let i = 0; i < Math.round(W * H / 100); i++) {
      const x = hash3(i, 5, 11) * W;
      const y = hash3(i, 9, 14) * H;
      g.globalAlpha = 0.022 + hash3(i, 17, 3) * 0.035;
      g.fillRect(x, y, hash3(i, 4, 8) > 0.96 ? 1.8 : 0.5, 0.45);
    }
    g.globalAlpha = 1;
  }

  private paintAtlas() {
    const { dpr, cw, ch } = this;
    this.glyphW = Math.ceil(cw * dpr);
    this.glyphH = Math.ceil(ch * dpr);
    this.atlas.width = this.glyphW * GLYPHS.length;
    this.atlas.height = this.glyphH;
    const g = this.atlas.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.font = `500 ${ch * 0.94}px ${this.fontFamily}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = this.palette.ink;
    for (let i = 0; i < GLYPHS.length; i++) {
      g.fillText(GLYPHS[i], (i + 0.5) * this.glyphW / dpr, this.glyphH / dpr * 0.52);
    }
  }

  private drawGlyph(index: number, x: number, y: number, opacity: number) {
    if (opacity < 0.008 || index < 0) return;
    const { ctx, glyphW, glyphH, cw, ch } = this;
    ctx.globalAlpha = opacity;
    ctx.drawImage(this.atlas, index * glyphW, 0, glyphW, glyphH, x - cw / 2, y - ch / 2, cw, ch);
  }

  render(world: World, dt: number) {
    if (!this.cols) return;
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.target.fill(0);
    this.occupied.fill(0);
    if (world.moment?.kind === "visitor") {
      for (const visitor of world.visitors) this.rasterizeShark(visitor, world.time, world.moment.opacity, false);
    }
    for (const shark of world.sharks) this.rasterizeShark(shark, world.time);
    this.drawWaterMarks(world);
    this.drawWakes(world);
    this.drawFish(world);
    this.drawSharks(dt);
    ctx.globalAlpha = 1;
    this.fresh = false;
    world.events.length = 0;
  }

  private prepareSpine(shark: Shark) {
    writeSwimmingSpine(shark, this.spine);
    this.arc[0] = 0;
    for (let k = 0; k < SHARK_NODES - 1; k++) {
      const dx = this.spine[(k + 1) * 2] - this.spine[k * 2];
      const dy = this.spine[(k + 1) * 2 + 1] - this.spine[k * 2 + 1];
      const length2 = Math.max(0.0001, dx * dx + dy * dy);
      const length = Math.sqrt(length2);
      this.segmentLength[k] = length;
      this.segmentInvLength2[k] = 1 / length2;
      this.arc[k + 1] = this.arc[k] + length;
    }
    this.arcTotal = this.arc[SHARK_NODES - 1];
    this.shape = SHAPES[shark.kind];
    this.sharkId = shark.id;
    const bank = clamp(shark.turn * 1.1, -0.16, 0.16);
    const flex = 1 + (1 - shark.stroke) * 0.045 + 0.008 * Math.sin(shark.phase * 0.5);
    const reach = this.shape.pectoral[3] * shark.length * flex;
    this.finLeft = reach * (1 + bank);
    this.finRight = reach * (1 - bank);
  }

  /** Signed inside-distance for a swept, slightly concave fin. */
  private finDistance(s: number, a: number, L: number, lead: number, trail: number, tip: number, reach: number, falcate: boolean) {
    const r = clamp(a / reach, 0, 1);
    const front = lead + (tip - lead) * Math.pow(r, 0.86);
    const back = trail + (tip - trail) * Math.pow(r, falcate ? 1.7 : 0.65);
    return Math.min((s - front) * L * 0.65, (back - s) * L * 0.65, reach - a);
  }

  /** Original nearest-spine sampling, now with continuous ink coverage at the edge. */
  private sampleShark(px: number, py: number, L: number) {
    const { spine, arc, shape } = this;
    let best = Infinity, bestSegment = 0, bestU = 0, rawU = 0;
    for (let k = 0; k < SHARK_NODES - 1; k++) {
      const ax = spine[k * 2], ay = spine[k * 2 + 1];
      const dx = spine[(k + 1) * 2] - ax, dy = spine[(k + 1) * 2 + 1] - ay;
      const projection = ((px - ax) * dx + (py - ay) * dy) * this.segmentInvLength2[k];
      const u = clamp(projection, 0, 1);
      const qx = ax + dx * u, qy = ay + dy * u;
      const distance2 = (px - qx) ** 2 + (py - qy) ** 2;
      if (distance2 < best) {
        best = distance2;
        bestSegment = k;
        bestU = u;
        rawU = projection;
      }
    }
    const i = bestSegment * 2;
    const dx = spine[i + 2] - spine[i], dy = spine[i + 3] - spine[i + 1];
    const side = dx * (py - spine[i + 1]) - dy * (px - spine[i]) >= 0 ? 1 : -1;
    const a = Math.sqrt(best);
    const s = (arc[bestSegment] + bestU * this.segmentLength[bestSegment]) / this.arcTotal;
    const edge = this.cw * 0.82;
    if (bestSegment === 0 && rawU < -edge / this.segmentLength[0]) return false;
    if (bestSegment === SHARK_NODES - 2 && rawU > 1 + edge / this.segmentLength[bestSegment]) return false;
    const v = a * side;
    let halfWidth = shape.halfWidth(s) * L;
    // A caudal peduncle joins the fork; there is no spurious third tail lobe.
    if (shape.caudal > 0) halfWidth *= 1 - smoothstep(0.89, 0.947, s);
    let inside = halfWidth - a;
    if (shape.caudal > 0 && s > 0.947) inside = -L;
    const across = clamp(a / (halfWidth || 1), 0, 1);
    // A loaded central brush and a diluted flank, rather than a metallic highlight.
    let ink = 0.3 + 0.5 * Math.pow(1 - across, 0.7) + side * across * 0.085;
    ink += Math.sin(s * 19 + this.sharkId) * Math.sin(v / L * 32 + s * 13) * 0.065;
    let flag = BODY;
    const head = shape.head;
    if (head) {
      const r = a / (head.span * L);
      const front = head.sweep * r * r + head.notch * Math.max(0, 1 - r / 0.16);
      const back = front + head.depth * (1 - 0.2 * r ** 4);
      const headInside = Math.min((s - front) * L, (back - s) * L, (1 - r) * head.span * L);
      if (headInside > inside) {
        inside = headInside;
        ink = 0.62 - r * 0.16;
        if (r > 0.86 && s > front + head.depth * 0.23 && s < front + head.depth * 0.57) {
          flag = EYE;
          ink = 0.95;
        }
      }
    }
    if (inside > 0 && flag === BODY) {
      if (s > shape.dorsal[0] && s < shape.dorsal[1] && across < 0.22) {
        ink = 0.87;
        flag = RIDGE;
      } else if (s > shape.secondDorsal[0] && s < shape.secondDorsal[1] && across < 0.24) {
        ink = 0.72;
      } else if (shape.eye && s > shape.eye[0] && s < shape.eye[1] && across > 0.72 && across < 0.93) {
        flag = EYE;
        ink = 0.93;
      } else if (s > shape.gills[0] && s < shape.gills[1] && across > 0.62) {
        const slit = ((s - shape.gills[0]) / (shape.gills[1] - shape.gills[0]) * 5) % 1;
        if (slit < 0.32) ink += 0.21;
      } else if (this.marked(s, v, L, across)) {
        flag = MARK;
        ink += 0.23;
      }
    }
    const finReach = side > 0 ? this.finRight : this.finLeft;
    const [p0, p1, p2] = shape.pectoral;
    const pectoral = this.finDistance(s, a, L, p0, p1, p2, finReach, shape.falcate);
    const [v0, v1, v2, vr] = shape.pelvic;
    const pelvic = this.finDistance(s, a, L, v0, v1, v2, vr * L, shape.falcate);
    let caudal = -L;
    if (shape.caudal > 0) {
      const reach = L * shape.caudal * (side > 0 ? 0.8 : 1.12);
      caudal = this.finDistance(s, a, L, 0.86, 0.945, 1, reach, true);
    }
    const fin = Math.max(pectoral, pelvic, caudal);
    if (fin > inside) {
      inside = fin;
      flag = FIN;
      ink = 0.42 + 0.14 * (1 - clamp(a / finReach, 0, 1));
      if (caudal === fin) ink += 0.1;
      if (this.marked(s, v, L, 0)) ink += 0.12;
    }
    this.hitCoverage = smoothstep(-edge, edge, inside);
    this.hitFlag = flag;
    this.hitShade = clamp(ink, 0, 1);
    return this.hitCoverage > 0.012;
  }

  private marked(s: number, v: number, L: number, across: number) {
    if (this.shape === SHAPES.tiger) {
      if (s < 0.24 || s > 0.87 || across > 0.85) return false;
      const bar = Math.sin(s * Math.PI * 18 + 0.35 * Math.sin(v / L * 25 + s * 5));
      return bar > 0.38 + 0.3 * smoothstep(0.7, 0.9, s);
    }
    if (this.shape === SHAPES.zebra) {
      if (s < 0.07) return false;
      const gu = s / 0.06, gv = v / (L * 0.045);
      const cu = Math.floor(gu), cv = Math.floor(gv);
      const jx = hash3(cu, cv, this.sharkId) * 0.5 + 0.25;
      const jy = hash3(cu, cv, this.sharkId + 11) * 0.5 + 0.25;
      return (gu - cu - jx) ** 2 + (gv - cv - jy) ** 2 < 0.08;
    }
    return false;
  }

  private rasterizeShark(shark: Shark, time: number, presence = 1, foreground = true) {
    if (presence < 0.008) return;
    this.prepareSpine(shark);
    const { spine, cw, ch, cols, rows } = this;
    const L = shark.length;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let k = 0; k < SHARK_NODES; k++) {
      minX = Math.min(minX, spine[k * 2]);
      maxX = Math.max(maxX, spine[k * 2]);
      minY = Math.min(minY, spine[k * 2 + 1]);
      maxY = Math.max(maxY, spine[k * 2 + 1]);
    }
    const reach = L * Math.max(this.shape.pectoral[3] * 1.2, this.shape.head?.span ?? 0, 0.15) + ch;
    const c0 = Math.max(0, Math.floor((minX - reach) / cw));
    const c1 = Math.min(cols - 1, Math.floor((maxX + reach) / cw));
    const r0 = Math.max(0, Math.floor((minY - reach) / ch));
    const r1 = Math.min(rows - 1, Math.floor((maxY + reach) / ch));
    // Depth changes very slowly: submerged silhouettes emerge and recede in pale ink.
    const depth = clamp(shark.depth + Math.sin(time * 0.038 + shark.id * 1.6) * 0.035, 0.6, 1);
    const depthInk = (0.32 + smoothstep(0.55, 1, depth) * 0.63) * presence;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const x = (col + 0.5) * cw, y = (row + 0.5) * ch;
        if (!this.sampleShark(x, y, L)) continue;
        const index = row * cols + col;
        const shade = this.hitShade;
        const coverage = this.hitCoverage;
        // Cell-stable characters: no random clock, no neon shimmer.
        const grain = hash3(col, row, shark.id);
        const water = 0.93 + 0.07 * Math.sin(x * 0.006 + y * 0.009 - time * 0.12);
        // Broken ink on the lit flank, with coherent pigment on the back.
        const dry = grain < 0.09 && this.hitFlag === BODY ? 0.68 : 1;
        const opacity = coverage * (0.29 + shade * 0.7) * depthInk * water * dry;
        if (foreground && coverage > 0.4) this.occupied[index] = 1;
        if (opacity < this.target[index]) continue;
        let glyph: string;
        if (this.hitFlag === EYE) glyph = "o";
        else if (coverage < 0.36) glyph = grain > 0.5 ? "." : ",";
        else {
          const ink = shade + (grain - 0.5) * 0.22;
          const desired = ink * (RAMP.length - 1);
          const previous = this.glyph[index];
          // A small dead band holds the letter around a shade boundary.
          const level = this.alpha[index] > 0.06 && previous < RAMP.length && Math.abs(desired - previous) < 0.85
            ? previous : clamp(Math.round(desired), 0, RAMP.length - 1);
          glyph = RAMP[level];
        }
        this.target[index] = opacity;
        this.targetGlyph[index] = GLYPHS.indexOf(glyph);
      }
    }
    if (foreground && time - (this.wakeAt.get(shark.id) ?? -Infinity) > 0.72 + (1 - shark.stroke) * 0.65) {
      const k = (SHARK_NODES - 1) * 2;
      const side = Math.sin(shark.phase) > 0 ? 1 : -1;
      const tx = spine[k] - spine[k - 2], ty = spine[k + 1] - spine[k - 1];
      const length = Math.hypot(tx, ty) || 1;
      const nx = -ty / length * side, ny = tx / length * side;
      this.wakes.push({
        x: spine[k] + nx * cw,
        y: spine[k + 1] + ny * cw,
        vx: tx / length * 0.7 + nx * 1.4,
        vy: ty / length * 0.7 + ny * 1.4,
        born: time, alpha: depthInk * (0.07 + shark.stroke * 0.07), glyph: hash3(shark.id, Math.floor(time), 2) > 0.5 ? "." : ",",
      });
      this.wakeAt.set(shark.id, time);
    }
  }

  private drawSharks(dt: number) {
    const elapsed = Math.max(0, dt);
    const arrival = this.fresh ? 1 : 1 - Math.exp(-elapsed * 18);
    const departure = this.fresh ? 1 : 1 - Math.exp(-elapsed * 13);
    for (let i = 0; i < this.alpha.length; i++) {
      const target = this.target[i];
      if (target > 0.008) {
        if (this.fresh || this.alpha[i] < 0.015) {
          this.glyph[i] = this.targetGlyph[i];
          this.glyphBlend[i] = 1;
        } else if (this.targetGlyph[i] !== this.glyph[i] && this.glyphBlend[i] >= 1) {
          this.previousGlyph[i] = this.glyph[i];
          this.glyph[i] = this.targetGlyph[i];
          this.glyphBlend[i] = 0;
        }
      }
      this.glyphBlend[i] = Math.min(1, this.glyphBlend[i] + elapsed / 0.18);
      this.alpha[i] += (target - this.alpha[i]) * (target > this.alpha[i] ? arrival : departure);
      if (this.alpha[i] < 0.008) continue;
      const x = (i % this.cols + 0.5) * this.cw, y = (Math.floor(i / this.cols) + 0.5) * this.ch;
      const mix = smoothstep(0, 1, this.glyphBlend[i]);
      if (mix < 1) this.drawGlyph(this.previousGlyph[i], x, y, this.alpha[i] * (1 - mix));
      this.drawGlyph(this.glyph[i], x, y, this.alpha[i] * mix);
    }
  }

  private drawFish(world: World) {
    const occupied = this.occupied;
    for (const fish of world.fish) {
      if (!fish.alive) continue;
      const col = Math.floor(fish.x / this.cw), row = Math.floor(fish.y / this.ch);
      if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) continue;
      const i = row * this.cols + col;
      if (occupied[i]) continue;
      occupied[i] = 1;
      const heading = Math.atan2(fish.vy, fish.vx);
      // A single short ASCII gesture follows its heading, with sub-cell movement.
      const character = Math.abs(Math.sin(heading)) < 0.38 ? "-" : Math.sin(heading) * Math.cos(heading) > 0 ? "\\" : "/";
      const pointer = world.pointer;
      const nearbyInk = pointer.influence * (1 - smoothstep(28, 90, Math.hypot(fish.x - pointer.x, fish.y - pointer.y))) * 0.12;
      const opacity = 0.12 + (fish.depth - 0.55) * 0.24 + Math.min(fish.alarm, 0.6) * 0.025 + nearbyInk;
      this.drawGlyph(GLYPHS.indexOf(character), fish.x, fish.y, opacity);
    }
  }

  private drawWaterMarks(world: World) {
    for (const mark of world.pointer.marks) {
      const radius = 14 + mark.age * 42;
      const fade = smoothstep(0, 0.08, mark.age) * (1 - smoothstep(0.5, 2.2, mark.age));
      // Broken, upright glyphs suggest water; never draw a solid ring.
      for (let k = 0; k < 24; k++) {
        if (k % 4 === 0) continue;
        const angle = mark.heading + k / 24 * Math.PI * 2;
        const opacity = mark.strength * fade * (0.18 + 0.07 * Math.sin(k * 2.7) ** 2);
        this.drawGlyph(GLYPHS.indexOf(k % 2 ? "." : ","), mark.x + Math.cos(angle) * radius,
          mark.y + Math.sin(angle) * radius * 0.72, opacity);
      }
    }
  }

  private drawWakes(world: World) {
    this.wakes = this.wakes.filter((wake) => world.time - wake.born < 6.5);
    // Hard cap is independent of frame rate and session duration.
    if (this.wakes.length > 64) this.wakes.splice(0, this.wakes.length - 64);
    for (const wake of this.wakes) {
      const age = world.time - wake.born;
      const fade = smoothstep(0, 0.7, age) * (1 - smoothstep(1.4, 6.5, age));
      this.drawGlyph(GLYPHS.indexOf(wake.glyph), wake.x + age * wake.vx, wake.y + age * wake.vy, wake.alpha * fade);
    }
  }
}
