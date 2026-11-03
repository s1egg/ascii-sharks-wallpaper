import { clamp } from "./math";
import { SHARK_NODES, type Shark } from "./world";

/** A restrained travelling wave: stable snout, stiff shoulders, lively caudal fin. */
export function writeSwimmingSpine(shark: Shark, out: Float32Array) {
  const n = shark.nodes;
  const flexible = shark.kind === "thresher" || shark.kind === "zebra" || shark.kind === "nurse";
  const effort = clamp(shark.speed / (14 + shark.length * 0.028), 0.7, 1.2)
    * (0.56 + shark.stroke * 0.44);
  for (let k = 0; k < SHARK_NODES; k++) {
    const s = k / (SHARK_NODES - 1);
    const a = Math.max(0, k - 1) * 2;
    const b = Math.min(SHARK_NODES - 1, k + 1) * 2;
    const tx = n[b] - n[a], ty = n[b + 1] - n[a + 1];
    const norm = Math.hypot(tx, ty) || 1;
    const envelope = Math.pow(s, flexible ? 2.2 : 2.8) * (flexible ? 0.062 : 0.048);
    const wave = Math.sin(shark.phase - s * (flexible ? 6.2 : 4.6)) * shark.length * envelope * effort;
    out[k * 2] = n[k * 2] - ty / norm * wave;
    out[k * 2 + 1] = n[k * 2 + 1] + tx / norm * wave;
  }

  // Articulate the painted spine as well as the steering spine. Adding a
  // transverse wave alone stretches the tail at the strongest part of a stroke.
  const segment = shark.length / (SHARK_NODES - 1);
  for (let k = 1; k < SHARK_NODES; k++) {
    const i = k * 2;
    const dx = out[i] - out[i - 2], dy = out[i + 1] - out[i - 1];
    const length = Math.hypot(dx, dy) || 1;
    out[i] = out[i - 2] + dx / length * segment;
    out[i + 1] = out[i - 1] + dy / length * segment;
  }
}
