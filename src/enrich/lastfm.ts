/**
 * Last.fm album tags (album.getTopTags). Free API key; non-commercial use terms.
 * Response shape from memory of the 2.0 API, NOT yet verified live.
 */
export async function lastfmAlbumTags(
  artist: string, album: string, apiKey: string, fetchImpl: typeof fetch = fetch,
): Promise<{ name: string; count: number }[]> {
  const p = new URLSearchParams({ method: 'album.gettoptags', artist, album, api_key: apiKey, format: 'json', autocorrect: '1' });
  const res = await fetchImpl(`https://ws.audioscrobbler.com/2.0/?${p}`);
  if (!res.ok) throw new Error(`Last.fm ${res.status}`);
  return parseLastfmTags(await res.json());
}

export function parseLastfmTags(json: unknown): { name: string; count: number }[] {
  const tag = (json as { toptags?: { tag?: unknown } })?.toptags?.tag;
  const list = Array.isArray(tag) ? tag : tag ? [tag] : []; // a single tag can arrive as an object
  return list
    .map((t) => ({ name: String((t as { name?: unknown }).name ?? ''), count: Number((t as { count?: unknown }).count) || 0 }))
    .filter((t) => t.name);
}
