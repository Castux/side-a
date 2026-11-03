/**
 * LibraryAdapter backed by the user's Tidal collection.
 * Mood vectors come from public/features.json (written by `npm run enrich`).
 * Albums not in that file get a rough vector from their Tidal genres alone, so a
 * fresh install still works before enrichment has run.
 */
import type { Album, LibraryAdapter, MoodVector } from '../../core/types';
import { combine } from '../../enrich/combine';
import type { FeatureCache } from '../../enrich/signals';
import { TidalClient } from './client';
import { tidalAlbumUrl } from './links';
import type { TidalAlbum } from './parse';

export function toAlbum(t: TidalAlbum, addedAt: number, features: FeatureCache): Album {
  const cached = features[t.id];
  const fallback = cached ? null : combine({ tidal: { genres: t.genres, bpms: [], keyScales: [], toneTags: [], trackCount: 0 } });
  return {
    id: 't' + t.id,
    tidalId: t.id,
    title: t.title,
    artist: t.artists.join(', ') || 'Unknown artist',
    year: Number(t.releaseDate?.slice(0, 4)) || 0,
    genre: t.genres[0] ?? 'Unknown',
    f: (cached?.f ?? fallback!.f) as MoodVector,
    confidence: (cached?.confidence ?? fallback!.confidence) as MoodVector,
    sources: cached?.sources ?? fallback!.sources,
    addedAt,
    coverUrl: t.coverUrl,
  };
}

export function createTidalLibrary(client: TidalClient, features: FeatureCache): LibraryAdapter {
  return {
    name: 'Your Tidal collection',
    async listAlbums() {
      const items = await client.collectionAlbumIds();
      const added = new Map(items.map((i) => [i.id, i.addedAt]));
      const albums = await client.albums(items.map((i) => i.id));
      return albums.map((a) => toAlbum(a, added.get(a.id) ?? 0, features));
    },
    playLink: (a) => tidalAlbumUrl(a.tidalId ?? ''),
  };
}
