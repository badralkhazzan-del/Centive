// Small seeded pseudo-random generator (mulberry32). Same seed, same sequence,
// in every browser and in Node, so seed data and the Simulation Lab are reproducible.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform number in [min, max). */
export function uniform(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** Approximately normal (Irwin-Hall with 6 draws), mean 0, sd ~ sd. */
export function gaussian(rng: Rng, sd: number): number {
  let s = 0;
  for (let i = 0; i < 6; i++) s += rng();
  return (s - 3) * sd * Math.SQRT2;
}

export function pickWeighted<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Short, human-friendly batch code such as "PT-7K3Q" (no 0/O or 1/I). */
export function batchCode(rng: Rng): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return `PT-${s}`;
}

/** Deterministic code from a counter, used for codes created during the demo. */
export function batchCodeFromSeq(seq: number): string {
  return batchCode(mulberry32(seq * 7919 + 17));
}
