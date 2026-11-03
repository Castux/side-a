/**
 * AcousticBrainz stopped collecting in 2022; its data survives as downloadable dumps
 * (see docs/data-sources.md). This parses one recording's "high-level" JSON.
 * Field names are from memory of that format; check one real file before trusting them.
 */
import type { AlbumSignals } from './signals';

type Scores = NonNullable<AlbumSignals['acousticbrainz']>;
type Mood = Omit<Scores, 'recordings'>;

const FIELDS: [keyof Mood, string, string][] = [
  ['happy', 'mood_happy', 'happy'],
  ['sad', 'mood_sad', 'sad'],
  ['relaxed', 'mood_relaxed', 'relaxed'],
  ['aggressive', 'mood_aggressive', 'aggressive'],
  ['party', 'mood_party', 'party'],
  ['acoustic', 'mood_acoustic', 'acoustic'],
  ['electronic', 'mood_electronic', 'electronic'],
  ['danceable', 'danceability', 'danceable'],
];

export function parseHighLevel(json: unknown): Mood | null {
  const hl = (json as { highlevel?: Record<string, { all?: Record<string, number> }> })?.highlevel;
  if (!hl) return null;
  const out = {} as Mood;
  for (const [key, model, cls] of FIELDS) {
    const v = hl[model]?.all?.[cls];
    if (typeof v !== 'number') return null;
    out[key] = v;
  }
  return out;
}

export function averageRecordings(moods: Mood[]): Scores | undefined {
  if (!moods.length) return undefined;
  const sum = (k: keyof Mood) => moods.reduce((s, m) => s + m[k], 0) / moods.length;
  return {
    recordings: moods.length,
    happy: sum('happy'), sad: sum('sad'), relaxed: sum('relaxed'), aggressive: sum('aggressive'),
    party: sum('party'), acoustic: sum('acoustic'), electronic: sum('electronic'), danceable: sum('danceable'),
  };
}
