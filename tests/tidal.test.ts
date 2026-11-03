import { describe, expect, it, vi } from 'vitest';
import collection from './fixtures/collection-page.json';
import albumsDoc from './fixtures/albums.json';
import items from './fixtures/album-items.json';
import { parseAlbums, parseAlbumTracks, parseCollectionPage, type Doc } from '../src/data/tidal/parse';
import { buildQuery, TidalClient } from '../src/data/tidal/client';
import { authorizeUrl, createPkcePair, parseTokenResponse } from '../src/data/tidal/auth';
import { toAlbum } from '../src/data/tidal/tidalLibrary';

describe('parsers', () => {
  it('reads collection ids, dates and the next cursor', () => {
    const p = parseCollectionPage(collection as Doc);
    expect(p.items.map((i) => i.id)).toEqual(['1001', '1002']);
    expect(p.items[0]!.addedAt).toBe(Date.parse('2026-10-30T07:12:00Z'));
    expect(p.nextCursor).toBe('abc');
  });

  it('resolves artists, genres and the 640px cover from included', () => {
    const [kob, disc] = parseAlbums(albumsDoc as Doc);
    expect(kob).toMatchObject({ id: '1001', title: 'Kind of Blue', artists: ['Miles Davis'], genres: ['Jazz'], barcodeId: '886976903328' });
    expect(kob!.coverUrl).toContain('640x640');
    expect(disc).toMatchObject({ artists: ['Daft Punk'], genres: [], coverUrl: null });
  });

  it('reads track mood fields and skips videos', () => {
    const { tracks } = parseAlbumTracks(items as Doc);
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({ bpm: 136, keyScale: 'DORIAN', toneTags: ['Cool', 'Relaxed'], trackNumber: 1 });
    expect(tracks[1]).toMatchObject({ key: null, keyScale: null });
  });

  it('builds an Album with a genre-only fallback vector when not enriched', () => {
    const [kob] = parseAlbums(albumsDoc as Doc);
    const a = toAlbum(kob!, 123, {});
    expect(a).toMatchObject({ id: 't1001', tidalId: '1001', year: 1959, genre: 'Jazz', addedAt: 123 });
    expect(a.f[2]).toBeGreaterThan(0.8); // jazz → acoustic
    expect(a.sources).toEqual(['Tidal genres']);
  });
});

describe('client', () => {
  it('repeats keys for array params (OpenAPI form/explode)', () => {
    expect(buildQuery({ include: ['artists', 'genres'], 'filter[id]': ['1', '2'], x: undefined }))
      .toBe('?include=artists&include=genres&filter%5Bid%5D=1&filter%5Bid%5D=2');
  });

  it('pages through the collection and batches album ids by 20', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      const u = new URL(url);
      let body: unknown;
      if (u.pathname.endsWith('/relationships/items')) {
        body = u.searchParams.get('page[cursor]')
          ? { data: [{ id: '3', type: 'albums', meta: { addedAt: '2026-01-01T00:00:00Z' } }], links: { self: '' } }
          : collection;
      } else body = { data: [], links: { self: '' } };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const c = new TidalClient({ getToken: async () => 'tok', countryCode: 'US', fetch: fetchMock as unknown as typeof fetch });
    expect((await c.collectionAlbumIds()).map((i) => i.id)).toEqual(['1001', '1002', '3']);
    await c.albums(Array.from({ length: 45 }, (_, i) => String(i)));
    expect(calls.filter((u) => new URL(u).pathname === '/v2/albums')).toHaveLength(3);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});

describe('auth', () => {
  it('creates a PKCE pair and an authorize URL with S256', async () => {
    const { verifier, challenge } = await createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const u = new URL(authorizeUrl({ clientId: 'cid', redirectUri: 'http://localhost:5173/' }, challenge, 'st'));
    expect(u.origin + u.pathname).toBe('https://login.tidal.com/authorize');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('scope')).toBe('collection.read');
  });

  it('parses a token response', () => {
    const t = parseTokenResponse({ access_token: 'a', refresh_token: 'r', expires_in: 100 }, 0);
    expect(t).toEqual({ accessToken: 'a', refreshToken: 'r', expiresAt: 100_000 });
    expect(() => parseTokenResponse({})).toThrow();
  });
});
