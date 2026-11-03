/** Raw evidence about one album, gathered from each source before it's combined. */
export interface AlbumSignals {
  tidal?: {
    genres: string[];
    /** One entry per track; null where Tidal has no value. */
    bpms: (number | null)[];
    keyScales: (string | null)[];
    /** All tone tags across tracks, repeats included (frequency matters). */
    toneTags: string[];
    trackCount: number;
  };
  musicbrainz?: {
    releaseGroupId: string;
    genres: { name: string; count: number }[];
    tags: { name: string; count: number }[];
  };
  /** Averaged over the album's recordings that have high-level data. Each 0..1. */
  acousticbrainz?: {
    recordings: number;
    happy: number;
    sad: number;
    relaxed: number;
    aggressive: number;
    party: number;
    acoustic: number;
    electronic: number;
    danceable: number;
  };
  lastfm?: { tags: { name: string; count: number }[] };
  discogs?: { genres: string[]; styles: string[] };
}

/** One cached entry in public/features.json, keyed by Tidal album id. */
export interface FeatureEntry {
  f: [number, number, number, number];
  confidence: [number, number, number, number];
  sources: string[];
  updatedAt: string;
}

export type FeatureCache = Record<string, FeatureEntry>;
