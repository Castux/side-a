/**
 * Turns an album's raw signals into the four mood numbers, a per-axis confidence and
 * a list of sources that contributed. Pure; all weights live in WEIGHTS.
 *
 * Each source produces estimates {axis, value, weight}. An axis is the weighted mean of
 * its estimates, or 0.5 when nothing speaks to it. Confidence = 1 - e^(-total weight),
 * so one strong source gives ~0.6 and several agreeing sources approach 1.
 */
import { clamp01 } from '../core/math';
import type { MoodVector } from '../core/types';
import { lookup, type Hint } from './lexicon';
import type { AlbumSignals } from './signals';

const AXES = ['e', 'b', 'o', 'd'] as const;
type Axis = (typeof AXES)[number];

export const WEIGHTS = {
  acousticbrainz: 1.0,
  tidalBpm: 0.5,
  tidalKeyScale: 0.5,
  tidalToneTags: 0.8,
  tidalGenres: 0.6,
  musicbrainzGenres: 0.6,
  musicbrainzTags: 0.4,
  lastfmTags: 0.8,
  discogsStyles: 0.7,
} as const;

export const BRIGHT_SCALES = new Set(['MAJOR', 'LYDIAN', 'MIXOLYDIAN', 'PENTATONIC_MAJOR']);
export const DARK_SCALES = new Set(['MINOR', 'AEOLIAN', 'DORIAN', 'PHRYGIAN', 'LOCRIAN', 'HARMONIC_MINOR', 'MELODIC_MINOR', 'PENTATONIC_MINOR', 'BLUES']);

/** bpm → energy. Tempo estimates are often off by 2×, so this is a weak signal. */
export const bpmToEnergy = (bpm: number) => clamp01((bpm - 65) / (165 - 65));

interface Estimate { axis: Axis; v: number; w: number; src: string }

export interface Combined {
  f: MoodVector;
  confidence: MoodVector;
  sources: string[];
  /** Terms seen in tags/genres that the lexicon didn't know, for extending it. */
  unmatched: string[];
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Weighted terms → estimates. Each term's weight is its share of the strongest term. */
function fromTerms(terms: { name: string; count: number }[], baseWeight: number, src: string, unmatched: Set<string>, limit = 15): Estimate[] {
  const top = [...terms].sort((a, b) => b.count - a.count).slice(0, limit);
  const max = Math.max(1, ...top.map((t) => t.count));
  const out: Estimate[] = [];
  for (const t of top) {
    const hint: Hint | null = lookup(t.name);
    if (!hint) { unmatched.add(t.name); continue; }
    const w = baseWeight * (t.count / max);
    for (const axis of AXES) if (hint[axis] !== undefined) out.push({ axis, v: hint[axis]!, w, src });
  }
  return out;
}

const counted = (names: string[]) => {
  const m = new Map<string, number>();
  for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
  return [...m].map(([name, count]) => ({ name, count }));
};

export function combine(sig: AlbumSignals): Combined {
  const est: Estimate[] = [];
  const unmatched = new Set<string>();

  const ab = sig.acousticbrainz;
  if (ab && ab.recordings > 0) {
    const w = WEIGHTS.acousticbrainz * Math.min(1, ab.recordings / 4);
    const src = 'AcousticBrainz';
    est.push({ axis: 'e', v: (ab.aggressive + ab.party + ab.danceable + (1 - ab.relaxed)) / 4, w, src });
    est.push({ axis: 'b', v: (ab.happy + (1 - ab.sad)) / 2, w, src });
    est.push({ axis: 'o', v: (ab.acoustic + (1 - ab.electronic)) / 2, w, src });
  }

  const t = sig.tidal;
  if (t) {
    const bpms = t.bpms.filter((x): x is number => x !== null && x > 0);
    if (bpms.length) est.push({ axis: 'e', v: bpmToEnergy(median(bpms)), w: WEIGHTS.tidalBpm * Math.min(1, bpms.length / 4), src: 'Tidal tempo' });
    const scales = t.keyScales.filter((x): x is string => !!x);
    const bright = scales.filter((s) => BRIGHT_SCALES.has(s)).length;
    const dark = scales.filter((s) => DARK_SCALES.has(s)).length;
    if (bright + dark > 0) est.push({ axis: 'b', v: 0.25 + 0.5 * (bright / (bright + dark)), w: WEIGHTS.tidalKeyScale * Math.min(1, (bright + dark) / 4), src: 'Tidal keys' });
    if (t.toneTags.length) est.push(...fromTerms(counted(t.toneTags), WEIGHTS.tidalToneTags, 'Tidal tone tags', unmatched));
    if (t.genres.length) est.push(...fromTerms(t.genres.map((name) => ({ name, count: 1 })), WEIGHTS.tidalGenres, 'Tidal genres', unmatched));
  }

  const mb = sig.musicbrainz;
  if (mb) {
    est.push(...fromTerms(mb.genres, WEIGHTS.musicbrainzGenres, 'MusicBrainz genres', unmatched));
    est.push(...fromTerms(mb.tags, WEIGHTS.musicbrainzTags, 'MusicBrainz tags', unmatched));
  }
  if (sig.lastfm) est.push(...fromTerms(sig.lastfm.tags, WEIGHTS.lastfmTags, 'Last.fm tags', unmatched));
  if (sig.discogs) {
    const terms = [...sig.discogs.styles, ...sig.discogs.genres].map((name) => ({ name, count: 1 }));
    est.push(...fromTerms(terms, WEIGHTS.discogsStyles, 'Discogs styles', unmatched));
  }

  const f: MoodVector = [0.5, 0.5, 0.5, 0.5];
  const confidence: MoodVector = [0, 0, 0, 0];
  AXES.forEach((axis, i) => {
    const es = est.filter((e) => e.axis === axis);
    const tw = es.reduce((s, e) => s + e.w, 0);
    if (tw > 0) {
      f[i] = clamp01(es.reduce((s, e) => s + e.v * e.w, 0) / tw);
      confidence[i] = 1 - Math.exp(-tw);
    }
  });

  return { f, confidence, sources: [...new Set(est.map((e) => e.src))], unmatched: [...unmatched] };
}
