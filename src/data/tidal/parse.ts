/**
 * Pure parsers for Tidal's JSON:API responses (https://openapi.tidal.com/v2).
 * Shapes follow the OpenAPI spec shipped in @tidal-music/api (node_modules/@tidal-music/api/bin/tidal-api-oas.json).
 * They have only been checked against the spec and hand-written fixtures, not live responses.
 */

export interface Identifier {
  id: string;
  type: string;
  meta?: Record<string, unknown>;
}

export interface Resource extends Identifier {
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: Identifier[] | Identifier | null }>;
}

export interface Doc {
  data: Resource[] | Identifier[] | Resource | null;
  included?: Resource[];
  links?: { self: string; next?: string; meta?: { nextCursor?: string } };
}

export interface TidalAlbum {
  id: string;
  title: string;
  releaseDate: string | null;
  barcodeId: string | null;
  popularity: number | null;
  numberOfItems: number | null;
  artists: string[];
  genres: string[];
  coverUrl: string | null;
}

export interface TidalTrack {
  id: string;
  title: string;
  isrc: string | null;
  bpm: number | null;
  key: string | null;
  keyScale: string | null;
  toneTags: string[];
  trackNumber: number | null;
  volumeNumber: number | null;
}

const str = (v: unknown) => (typeof v === 'string' && v.length ? v : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export const nextCursor = (doc: Doc): string | null => doc.links?.meta?.nextCursor ?? null;

function index(doc: Doc): Map<string, Resource> {
  return new Map((doc.included ?? []).map((r) => [`${r.type}:${r.id}`, r]));
}

function related(r: Resource, rel: string, idx: Map<string, Resource>): Resource[] {
  const d = r.relationships?.[rel]?.data;
  const ids = Array.isArray(d) ? d : d ? [d] : [];
  return ids.map((i) => idx.get(`${i.type}:${i.id}`)).filter((x): x is Resource => !!x);
}

/** GET /userCollectionAlbums/me/relationships/items → album ids with the date you saved each. */
export function parseCollectionPage(doc: Doc): { items: { id: string; addedAt: number }[]; nextCursor: string | null } {
  const data = Array.isArray(doc.data) ? doc.data : [];
  return {
    items: data
      .filter((d) => d.type === 'albums')
      .map((d) => ({ id: d.id, addedAt: Date.parse(String(d.meta?.addedAt ?? '')) || 0 })),
    nextCursor: nextCursor(doc),
  };
}

/** Picks the artwork file closest to `target` px wide. */
export function pickCoverFile(artwork: Resource | undefined, target = 640): string | null {
  const files = (artwork?.attributes?.files as { href?: string; meta?: { width?: number } }[] | undefined) ?? [];
  let best: string | null = null;
  let bestScore = Infinity;
  for (const f of files) {
    if (!f.href) continue;
    const w = f.meta?.width ?? target;
    const score = Math.abs(w - target) + (w < target ? 1000 : 0); // prefer not upscaling
    if (score < bestScore) { bestScore = score; best = f.href; }
  }
  return best;
}

/** GET /albums?filter[id]=…&include=artists&include=genres&include=coverArt */
export function parseAlbums(doc: Doc): TidalAlbum[] {
  const idx = index(doc);
  const data = (Array.isArray(doc.data) ? doc.data : doc.data ? [doc.data] : []) as Resource[];
  return data.filter((r) => r.type === 'albums').map((r) => {
    const a = r.attributes ?? {};
    return {
      id: r.id,
      title: str(a.title) ?? 'Untitled',
      releaseDate: str(a.releaseDate),
      barcodeId: str(a.barcodeId),
      popularity: num(a.popularity),
      numberOfItems: num(a.numberOfItems),
      artists: related(r, 'artists', idx).map((x) => str(x.attributes?.name)).filter((x): x is string => !!x),
      genres: related(r, 'genres', idx).map((x) => str(x.attributes?.genreName)).filter((x): x is string => !!x),
      coverUrl: pickCoverFile(related(r, 'coverArt', idx)[0]),
    };
  });
}

/** GET /albums/{id}/relationships/items?include=items → the album's tracks (videos skipped). */
export function parseAlbumTracks(doc: Doc): { tracks: TidalTrack[]; nextCursor: string | null } {
  const idx = index(doc);
  const ids = (Array.isArray(doc.data) ? doc.data : []) as Identifier[];
  const tracks = ids
    .filter((i) => i.type === 'tracks')
    .map((i) => {
      const a = idx.get(`tracks:${i.id}`)?.attributes ?? {};
      return {
        id: i.id,
        title: str(a.title) ?? '',
        isrc: str(a.isrc),
        bpm: num(a.bpm),
        key: str(a.key) === 'UNKNOWN' ? null : str(a.key),
        keyScale: str(a.keyScale) === 'UNKNOWN' ? null : str(a.keyScale),
        toneTags: strs(a.toneTags),
        trackNumber: num(i.meta?.trackNumber),
        volumeNumber: num(i.meta?.volumeNumber),
      };
    });
  return { tracks, nextCursor: nextCursor(doc) };
}

/** GET /albums/{id}/relationships/similarAlbums → ids only. */
export function parseIdentifiers(doc: Doc, type: string): { ids: string[]; nextCursor: string | null } {
  const data = (Array.isArray(doc.data) ? doc.data : []) as Identifier[];
  return { ids: data.filter((d) => d.type === type).map((d) => d.id), nextCursor: nextCursor(doc) };
}
