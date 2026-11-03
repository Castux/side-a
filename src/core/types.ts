/** [energy, brightness, organic, density], each 0..1. See DIMS for meaning. */
export type MoodVector = [number, number, number, number];

export const DIMS = [
  { key: 'energy', lo: 'Calm', hi: 'Lively' },
  { key: 'brightness', lo: 'Dark', hi: 'Bright' },
  { key: 'organic', lo: 'Electronic', hi: 'Acoustic' },
  { key: 'density', lo: 'Spare', hi: 'Lush' },
] as const;

export interface Album {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  f: MoodVector;
  /** 0..1 per dimension: how much evidence the vector rests on. Sample data is hand-tagged (1). */
  confidence?: MoodVector;
  /** Which sources contributed to the vector, shown on the detail sheet. */
  sources?: string[];
  addedAt: number;
  tidalId: string | null;
  coverUrl: string | null;
}

/** Every album source (sample data, Tidal, anything later) implements this. */
export interface LibraryAdapter {
  name: string;
  listAlbums(): Promise<Album[]>;
  playLink(album: Album): string;
}

export interface Play {
  id: string;
  at: number;
  source: 'morning' | 'library';
  round: number | null;
}

export interface SessionLog {
  at: number;
  rounds: number;
  kept: number;
  played: string;
}

export interface Settings {
  /** Albums played within this many days are left out of morning rounds. */
  avoidDays: number;
  /** Multiplier on the search radius after a round with picks (lower = narrows faster). */
  shrink: number;
  /** Include one out-of-zone album in rounds 2–3. */
  wildcard: boolean;
  /** Show fit scores and raw vectors on morning cards. */
  math: boolean;
}

export interface AppState {
  v: 1;
  plays: Play[];
  sessions: SessionLog[];
  settings: Settings;
}

export const defaultState = (): AppState => ({
  v: 1,
  plays: [],
  sessions: [],
  settings: { avoidDays: 7, shrink: 0.62, wildcard: true, math: false },
});
