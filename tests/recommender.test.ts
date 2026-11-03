import { describe, expect, it } from 'vitest';
import { DAY, dist } from '../src/core/math';
import { defaultState, type Play } from '../src/core/types';
import { sampleAlbums } from '../src/data/sampleAlbums';
import { advance, makeContext, newSession, ROUND_SIZE, TUNING } from '../src/recommender/recommender';
import { moodWords } from '../src/recommender/describe';

const NOW = 1_800_000_000_000;
const albums = sampleAlbums(NOW);
const settings = defaultState().settings;
const ctxWith = (plays: Play[] = [], s = settings) => makeContext(albums, plays, s, NOW);

describe('first round', () => {
  it('draws five distinct albums', () => {
    const s = newSession(ctxWith(), { rngSeed: 1 });
    expect(s.current).toHaveLength(ROUND_SIZE);
    expect(new Set(s.current.map((c) => c.id)).size).toBe(ROUND_SIZE);
  });

  it('is spread out compared with random picks', () => {
    const ctx = ctxWith();
    const minPair = (ids: string[]) => {
      let m = Infinity;
      for (const a of ids) for (const b of ids) if (a < b) m = Math.min(m, dist(ctx.byId.get(a)!.f, ctx.byId.get(b)!.f));
      return m;
    };
    let total = 0;
    for (let seed = 1; seed <= 20; seed++) total += minPair(newSession(ctx, { rngSeed: seed }).current.map((c) => c.id));
    expect(total / 20).toBeGreaterThan(0.3); // random fives average well under this on the sample set
  });

  it('leaves out albums played within avoidDays', () => {
    const plays: Play[] = albums.slice(0, 40).map((a) => ({ id: a.id, at: NOW - DAY, source: 'library', round: null }));
    for (let seed = 1; seed <= 10; seed++) {
      const ids = newSession(ctxWith(plays), { rngSeed: seed }).current.map((c) => c.id);
      expect(ids.some((id) => plays.some((p) => p.id === id))).toBe(false);
    }
  });

  it('falls back to recently played when too few albums remain', () => {
    const plays: Play[] = albums.slice(0, albums.length - 2).map((a) => ({ id: a.id, at: NOW - DAY, source: 'library', round: null }));
    expect(newSession(ctxWith(plays), { rngSeed: 3 }).current).toHaveLength(ROUND_SIZE);
  });
});

describe('narrowing', () => {
  it('moves the target toward picks and shrinks the radius', () => {
    const ctx = ctxWith();
    const s = newSession(ctx, { rngSeed: 7 });
    const pick = s.current[0]!.id;
    s.selected.add(pick);
    advance(ctx, s);
    expect(s.round).toBe(2);
    expect(s.sigma).toBeCloseTo(TUNING.initialSigma * settings.shrink);
    expect(dist(s.target!, ctx.byId.get(pick)!.f)).toBeLessThan(0.15);
    expect(s.liked).toEqual([pick]);
    expect(s.passed).toHaveLength(ROUND_SIZE - 1);
  });

  it('widens the radius when nothing is picked', () => {
    const ctx = ctxWith();
    const s = newSession(ctx, { rngSeed: 7 });
    s.selected.add(s.current[0]!.id);
    advance(ctx, s);
    const before = s.sigma;
    advance(ctx, s); // no picks
    expect(s.sigma).toBeCloseTo(before * TUNING.widenOnNone);
  });

  it('never repeats an album within a session', () => {
    const ctx = ctxWith();
    const s = newSession(ctx, { rngSeed: 11 });
    const seen: string[] = [];
    for (let r = 0; r < 8 && s.current.length; r++) {
      seen.push(...s.current.map((c) => c.id));
      s.selected.add(s.current[0]!.id);
      advance(ctx, s);
    }
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('converges: calm acoustic picks keep the next rounds calm and acoustic', () => {
    // Only rounds 2–3: the 66-album sample set has 12 calm acoustic albums, so a
    // session runs out of them by round 4 and correctly falls back to the nearest rest.
    const ctx = ctxWith();
    for (const rngSeed of [1, 2, 3, 4, 5]) {
      const s = newSession(ctx, { rngSeed });
      for (let r = 0; r < 3; r++) {
        for (const c of s.current) {
          const a = ctx.byId.get(c.id)!;
          if (a.f[0] < 0.4 && a.f[2] > 0.7) s.selected.add(c.id);
        }
        if (!s.selected.size) s.selected.add(s.current.map((c) => ctx.byId.get(c.id)!).sort((a, b) => a.f[0] - b.f[0])[0]!.id);
        advance(ctx, s);
        if (r >= 1) {
          const focused = s.current.filter((c) => !c.wildcard).map((c) => ctx.byId.get(c.id)!);
          expect(focused.reduce((t, a) => t + a.f[0], 0) / focused.length).toBeLessThan(0.45);
        }
      }
    }
  });

  it('includes a wildcard only in early rounds when enabled', () => {
    const ctx = ctxWith();
    const s = newSession(ctx, { rngSeed: 2 });
    s.selected.add(s.current[0]!.id);
    advance(ctx, s);
    expect(s.current.filter((c) => c.wildcard)).toHaveLength(1);
    for (let r = 0; r < 3; r++) { s.selected.add(s.current[0]!.id); advance(ctx, s); }
    expect(s.current.filter((c) => c.wildcard)).toHaveLength(0);

    const off = ctxWith([], { ...settings, wildcard: false });
    const s2 = newSession(off, { rngSeed: 2 });
    s2.selected.add(s2.current[0]!.id);
    advance(off, s2);
    expect(s2.current.some((c) => c.wildcard)).toBe(false);
  });
});

describe('moodWords', () => {
  it('describes a vector in plain words', () => {
    expect(moodWords([0.2, 0.8, 0.9, 0.2])).toBe('calm, bright, acoustic and spare');
    expect(moodWords([0.5, 0.5, 0.5, 0.5])).toBe('steady and mellow');
  });
});
