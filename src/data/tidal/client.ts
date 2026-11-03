/**
 * Thin fetch client for the handful of Tidal endpoints Side A needs. Works in the
 * browser and in Node 22 (scripts/enrich.ts). Endpoints, params and limits come from
 * the OpenAPI spec in @tidal-music/api; none of this has been run against the live API yet.
 *
 * Alternative: the official @tidal-music/api + @tidal-music/auth packages. This client
 * was kept dependency-free so parsing is testable with fixtures; switching is fine.
 */
import {
  parseAlbums, parseAlbumTracks, parseCollectionPage, parseIdentifiers,
  type Doc, type TidalAlbum, type TidalTrack,
} from './parse';

export const TIDAL_API = 'https://openapi.tidal.com/v2';
/** filter[id] accepts at most 20 ids per request (spec: maxItems 20). */
export const MAX_IDS_PER_REQUEST = 20;

type Query = Record<string, string | string[] | undefined>;

export interface TidalClientOptions {
  getToken: () => Promise<string>;
  countryCode: string;
  fetch?: typeof fetch;
  base?: string;
  /** Called with the wait in ms when the API rate-limits us. */
  onRateLimit?: (waitMs: number) => void;
}

export class TidalApiError extends Error {
  constructor(public status: number, public path: string, body: string) {
    super(`Tidal API ${status} on ${path}: ${body.slice(0, 300)}`);
  }
}

/** OpenAPI default for query arrays (style=form, explode=true): repeat the key. */
export function buildQuery(q: Query): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) p.append(k, item);
  }
  const s = p.toString();
  return s ? '?' + s : '';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TidalClient {
  private fetchImpl: typeof fetch;
  private base: string;

  constructor(private opts: TidalClientOptions) {
    this.fetchImpl = opts.fetch ?? fetch.bind(globalThis);
    this.base = opts.base ?? TIDAL_API;
  }

  async get(path: string, query: Query = {}, attempt = 0): Promise<Doc> {
    const url = this.base + path + buildQuery(query);
    const res = await this.fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${await this.opts.getToken()}`,
        Accept: 'application/vnd.api+json',
      },
    });
    if (res.status === 429 && attempt < 4) {
      const wait = (Number(res.headers.get('Retry-After')) || 2 ** attempt) * 1000;
      this.opts.onRateLimit?.(wait);
      await sleep(wait);
      return this.get(path, query, attempt + 1);
    }
    if (!res.ok) throw new TidalApiError(res.status, path, await res.text());
    return (await res.json()) as Doc;
  }

  /** Every album in "My Collection", newest first. Scope: collection.read. */
  async collectionAlbumIds(): Promise<{ id: string; addedAt: number }[]> {
    const out: { id: string; addedAt: number }[] = [];
    let cursor: string | undefined;
    do {
      const page = parseCollectionPage(
        await this.get('/userCollectionAlbums/me/relationships/items', { sort: '-addedAt', 'page[cursor]': cursor }),
      );
      out.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return out;
  }

  /** Album metadata with artists, genres and cover art, 20 ids per request. */
  async albums(ids: string[]): Promise<TidalAlbum[]> {
    const out: TidalAlbum[] = [];
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
      const doc = await this.get('/albums', {
        'filter[id]': ids.slice(i, i + MAX_IDS_PER_REQUEST),
        include: ['artists', 'genres', 'coverArt'],
        countryCode: this.opts.countryCode,
      });
      out.push(...parseAlbums(doc));
    }
    return out;
  }

  /** Tracks of one album with bpm, key, keyScale and toneTags. */
  async albumTracks(albumId: string): Promise<TidalTrack[]> {
    const out: TidalTrack[] = [];
    let cursor: string | undefined;
    do {
      const page = parseAlbumTracks(
        await this.get(`/albums/${encodeURIComponent(albumId)}/relationships/items`, {
          include: ['items'], countryCode: this.opts.countryCode, 'page[cursor]': cursor,
        }),
      );
      out.push(...page.tracks);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return out;
  }

  /** Tidal's own "similar albums" (first page only). */
  async similarAlbumIds(albumId: string): Promise<string[]> {
    const doc = await this.get(`/albums/${encodeURIComponent(albumId)}/relationships/similarAlbums`, {
      countryCode: this.opts.countryCode,
    });
    return parseIdentifiers(doc, 'albums').ids;
  }
}
