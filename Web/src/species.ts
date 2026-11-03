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
    schoolSize: [18, 28], spacing: [1.8, 1.1],
    align: 1.6, cohesion: 1.6, jitter: 13, mill: 38, verticalDrag: 0.5,
  },
  {
    name: "anchovy",
    cruise: 28, maxSpeed: 48, minSpeed: 14, weight: 3,
    schoolSize: [20, 32], spacing: [1.5, 1],
    align: 3.2, cohesion: 0.45, jitter: 10, mill: 0, verticalDrag: 1.4,
  },
  {
    name: "silverside",
    cruise: 24, maxSpeed: 44, minSpeed: 12, weight: 3,
    schoolSize: [12, 20], spacing: [2, 1.1],
    align: 2.4, cohesion: 1.1, jitter: 11, mill: 0, verticalDrag: 1.6,
  },
  {
    name: "mackerel",
    cruise: 20, maxSpeed: 38, minSpeed: 10, weight: 2,
    schoolSize: [5, 9], spacing: [2.6, 1.3],
    align: 2, cohesion: 0.9, jitter: 9, mill: 0, verticalDrag: 2,
  },
  {
    name: "goby",
    cruise: 16, maxSpeed: 34, minSpeed: 7, weight: 1,
    schoolSize: [8, 12], spacing: [1.4, 1.1],
    align: 0.35, cohesion: 1.4, jitter: 28, mill: 0, verticalDrag: 0.3,
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

