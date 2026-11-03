export interface Species {
  name: string;
  cruise: number;
  maxSpeed: number;
  minSpeed: number;
  /** Relative odds of a new school being this species. */
  weight: number;
  schoolSize: [number, number];
  /** Personal space in grid cells (x, y), so every fish gets its own glyph. */
  spacing: [number, number];
  // Behaviour weights. Different mixes produce different collective shapes
  // (Couzin et al. 2002): strong alignment gives polarised schools and
  // ribbons, low alignment gives swarms, and a tangential pull gives a mill.
  align: number;
  cohesion: number;
  jitter: number;
  /** Tangential pull around the local centre: >0 makes a rotating bait ball. */
  mill: number;
  /** Damps vertical speed; real fish mostly cruise level. */
  verticalDrag: number;
}

export const SPECIES: Species[] = [
  {
    name: "sardine",
    cruise: 22, maxSpeed: 42, minSpeed: 11, weight: 3,
    schoolSize: [4, 7], spacing: [3.4, 2],
    align: 1.8, cohesion: 0.65, jitter: 6, mill: 0, verticalDrag: 0.9,
  },
  {
    name: "anchovy",
    cruise: 28, maxSpeed: 48, minSpeed: 14, weight: 3,
    schoolSize: [4, 7], spacing: [3.2, 1.9],
    align: 3.2, cohesion: 0.3, jitter: 6, mill: 0, verticalDrag: 1.4,
  },
  {
    name: "silverside",
    cruise: 24, maxSpeed: 44, minSpeed: 12, weight: 3,
    schoolSize: [3, 6], spacing: [3.6, 2.1],
    align: 2.4, cohesion: 0.55, jitter: 6, mill: 0, verticalDrag: 1.6,
  },
  {
    name: "mackerel",
    cruise: 20, maxSpeed: 38, minSpeed: 10, weight: 2,
    schoolSize: [3, 5], spacing: [4, 2.2],
    align: 2, cohesion: 0.5, jitter: 5, mill: 0, verticalDrag: 2,
  },
  {
    name: "goby",
    cruise: 16, maxSpeed: 34, minSpeed: 7, weight: 1,
    schoolSize: [3, 4], spacing: [3, 2],
    align: 0.8, cohesion: 0.5, jitter: 10, mill: 0, verticalDrag: 0.6,
  },
];

const TOTAL_WEIGHT = SPECIES.reduce((sum, s) => sum + s.weight, 0);

export function pickSpecies() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < SPECIES.length; i++) {
    r -= SPECIES[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

