import type { MoodVector } from './types';

export const DAY = 86_400_000;

export type Rng = () => number;

/** Small seeded PRNG, so recommender runs are reproducible in tests. */
export function mulberry32(seed: number): Rng {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a. Stable ids and per-album seeds. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const dist = (a: readonly number[], b: readonly number[]) =>
  Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0));

export function mean(vs: readonly MoodVector[]): MoodVector {
  const out: MoodVector = [0, 0, 0, 0];
  for (const v of vs) for (let i = 0; i < 4; i++) out[i]! += v[i]! / vs.length;
  return out;
}

export const lerp = (a: MoodVector, b: MoodVector, t: number): MoodVector =>
  a.map((v, i) => v + (b[i]! - v) * t) as MoodVector;
