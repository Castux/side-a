/**
 * Morning-session recommender. Pure apart from the injected RNG: no DOM, no storage.
 *
 * A session keeps a guess of today's mood (`target`, a point in the 4-D mood space)
 * and how sure it is (`sigma`, the search radius). Each round:
 *  - Picked albums pull the target toward their average (60% step).
 *  - Unpicked albums push it slightly away (12%), and their close neighbours are
 *    damped for the rest of the session.
 *  - Sigma shrinks after a round with picks (× settings.shrink, floor 0.10) and widens
 *    after a round with none (× 1.35, ceiling 0.60): "none of these" means look elsewhere.
 * Candidates are drawn by weighted sampling around the target and spread apart so the
 * five aren't near-duplicates. Rounds 2–3 swap one slot for a wildcard from outside the zone.
 * Round 1 (no target yet) uses farthest-point sampling for maximum variety.
 */
import { clamp01, dist, lerp, mean, mulberry32, DAY, type Rng } from '../core/math';
import type { Album, MoodVector, Play, Settings } from '../core/types';

export const ROUND_SIZE = 5;
export const TUNING = {
  initialSigma: 0.5,
  seededSigma: 0.22,
  minSigma: 0.1,
  maxSigma: 0.6,
  widenOnNone: 1.35,
  pullTowardPicks: 0.6,
  pushFromPassed: 0.12,
  passedPenalty: 0.5,
  passedPenaltyRadius: 0.08,
  spreadPenalty: 0.7,
  spreadRadius: 0.1,
  wildcardRounds: 3,
  wildcardMinDistance: 1.5, // × sigma
  firstRoundJitter: 0.25,
} as const;

export interface Context {
  albums: readonly Album[];
  byId: ReadonlyMap<string, Album>;
  plays: readonly Play[];
  settings: Settings;
  now: number;
}

export interface Candidate {
  id: string;
  wildcard: boolean;
  /** 0..1 Gaussian fit to the target, null in round 1. */
  fit: number | null;
}

export interface Session {
  round: number;
  target: MoodVector | null;
  sigma: number;
  liked: string[];
  passed: string[];
  seen: Set<string>;
  current: Candidate[];
  selected: Set<string>;
  rng: Rng;
  startedAt: number;
  seedId: string | null;
}

export function makeContext(albums: readonly Album[], plays: readonly Play[], settings: Settings, now = Date.now()): Context {
  return { albums, byId: new Map(albums.map((a) => [a.id, a])), plays, settings, now };
}

function recentIds(ctx: Context): Set<string> {
  const cut = ctx.now - ctx.settings.avoidDays * DAY;
  return new Set(ctx.plays.filter((p) => p.at > cut).map((p) => p.id));
}

function pool(ctx: Context, s: Session): Album[] {
  const recent = recentIds(ctx);
  const fresh = ctx.albums.filter((a) => !s.seen.has(a.id) && !recent.has(a.id));
  // A small library can run dry: fall back to recently played rather than showing nothing.
  return fresh.length >= ROUND_SIZE ? fresh : ctx.albums.filter((a) => !s.seen.has(a.id));
}

export function fit(ctx: Context, s: Session, a: Album): number | null {
  if (!s.target) return null;
  const d = dist(a.f, s.target);
  let w = Math.exp(-(d * d) / (2 * s.sigma * s.sigma));
  const r2 = 2 * TUNING.passedPenaltyRadius ** 2;
  for (const pid of s.passed) {
    const p = ctx.byId.get(pid);
    if (!p) continue;
    const dp = dist(a.f, p.f);
    w *= 1 - TUNING.passedPenalty * Math.exp(-(dp * dp) / r2);
  }
  return w;
}

function diverse(albums: Album[], rng: Rng, n: number): Candidate[] {
  const rest = [...albums];
  const out: Album[] = [rest.splice(Math.floor(rng() * rest.length), 1)[0]!];
  while (out.length < n && rest.length) {
    let best = -1;
    let bi = 0;
    rest.forEach((a, i) => {
      const m = Math.min(...out.map((o) => dist(o.f, a.f))) + rng() * TUNING.firstRoundJitter;
      if (m > best) { best = m; bi = i; }
    });
    out.push(rest.splice(bi, 1)[0]!);
  }
  return out.map((a) => ({ id: a.id, wildcard: false, fit: null }));
}

function focused(ctx: Context, albums: Album[], s: Session): Candidate[] {
  const target = s.target!;
  const wantWild = ctx.settings.wildcard && s.round <= TUNING.wildcardRounds;
  const nFocus = wantWild ? ROUND_SIZE - 1 : ROUND_SIZE;
  const cand = albums.map((a) => ({ a, w: fit(ctx, s, a) ?? 0 }));
  const out: Candidate[] = [];
  const sr2 = 2 * TUNING.spreadRadius ** 2;

  for (let k = 0; k < nFocus && cand.length; k++) {
    const total = cand.reduce((t, c) => t + c.w, 0);
    let idx = 0;
    if (total <= 1e-9) {
      // Everything is far away: take the nearest instead of sampling noise.
      idx = cand.reduce((bi, c, i) => (dist(c.a.f, target) < dist(cand[bi]!.a.f, target) ? i : bi), 0);
    } else {
      let r = s.rng() * total;
      for (; idx < cand.length - 1; idx++) { r -= cand[idx]!.w; if (r <= 0) break; }
    }
    const [c] = cand.splice(idx, 1);
    out.push({ id: c!.a.id, wildcard: false, fit: fit(ctx, s, c!.a) });
    for (const o of cand) {
      const d = dist(o.a.f, c!.a.f);
      o.w *= 1 - TUNING.spreadPenalty * Math.exp(-(d * d) / sr2);
    }
  }

  if (wantWild && cand.length) {
    const far = cand.filter((c) => dist(c.a.f, target) > s.sigma * TUNING.wildcardMinDistance);
    const src = far.length ? far : cand;
    const c = src[Math.floor(s.rng() * src.length)]!;
    out.splice(Math.floor(s.rng() * (out.length + 1)), 0, { id: c.a.id, wildcard: true, fit: fit(ctx, s, c.a) });
  }
  return out;
}

export function drawRound(ctx: Context, s: Session): Candidate[] {
  const p = pool(ctx, s);
  if (!p.length) return [];
  const picks = s.target ? focused(ctx, p, s) : diverse(p, s.rng, ROUND_SIZE);
  for (const c of picks) s.seen.add(c.id);
  return picks;
}

export function newSession(ctx: Context, opts: { seed?: Album; rngSeed?: number } = {}): Session {
  const { seed } = opts;
  const s: Session = {
    round: 1,
    target: seed ? ([...seed.f] as MoodVector) : null,
    sigma: seed ? TUNING.seededSigma : TUNING.initialSigma,
    liked: [],
    passed: [],
    seen: new Set(seed ? [seed.id] : []),
    current: [],
    selected: new Set(),
    rng: mulberry32(opts.rngSeed ?? ((ctx.now ^ 0x9e3779b9) >>> 0)),
    startedAt: ctx.now,
    seedId: seed?.id ?? null,
  };
  s.current = drawRound(ctx, s);
  return s;
}

/** Applies the current selection, updates the mood guess, and draws the next round. */
export function advance(ctx: Context, s: Session): void {
  const picked = s.current.filter((c) => s.selected.has(c.id)).map((c) => ctx.byId.get(c.id)!);
  const passed = s.current.filter((c) => !s.selected.has(c.id)).map((c) => ctx.byId.get(c.id)!);

  if (picked.length) {
    const pv = mean(picked.map((a) => a.f));
    let t = s.target ? lerp(s.target, pv, TUNING.pullTowardPicks) : pv;
    if (passed.length) {
      const pm = mean(passed.map((a) => a.f));
      t = t.map((v, i) => clamp01(v + TUNING.pushFromPassed * (v - pm[i]!))) as MoodVector;
    }
    s.target = t;
    s.sigma = Math.max(TUNING.minSigma, s.sigma * ctx.settings.shrink);
  } else if (s.target) {
    s.sigma = Math.min(TUNING.maxSigma, s.sigma * TUNING.widenOnNone);
  }

  s.liked.push(...picked.map((a) => a.id));
  s.passed.push(...passed.map((a) => a.id));
  s.selected = new Set();
  s.round++;
  s.current = drawRound(ctx, s);
}

export function toggle(s: Session, id: string): void {
  if (s.selected.has(id)) s.selected.delete(id);
  else s.selected.add(id);
}
