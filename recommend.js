// "New to you": six albums she doesn't have saved, from three sources:
//   known    albums she already plays or likes (liked tracks, daily mixes): rebuilding the collection
//   similar  albums Tidal lists as similar to her saved, loved and liked ones
//   extra    Tidal's own picks for her (discovery and new-release mixes)
// Never kids' music, singles, owned or judged albums. Tested in tests/recommend.test.js with fake calls.

import { isForKids } from './kids.js';

const SEEDS = 8; // albums to start from when nothing is picked
const WILD = 2; // extra seeds next to picked albums, so "more like these" can still surprise
const KNOWN = 3; // slots for albums she already knows, when nothing is picked
const PICKED_WEIGHT = 3; // a picked album steers its neighbours this much more than a saved one

/** `k` items drawn without replacement, heavier `weight`s more likely (Efraimidis–Spirakis). */
function weightedSample(items, weight, k, rng) {
  return items
    .map((x) => [x, rng() ** (1 / weight(x))])
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([x]) => x);
}

/**
 * Why an album was recommended, from the albums it's similar to (strongest first):
 * "More by X" when one of them is by the same artist, else "Like X" or "Like X and Y".
 */
export function why(album, sources = []) {
  const first = (artist) => artist.split(', ')[0]; // "Berliner Philharmoniker, Herbert von Karajan" is too long
  if (sources.some((s) => s.artist === album.artist)) return `More by ${first(album.artist)}`;
  const names = [...new Set(sources.map((s) => (s.artist === 'Various Artists' ? `“${s.title}”` : first(s.artist))))];
  return names.length ? `Like ${names.slice(0, 2).join(' and ')}` : '';
}

/** True for albums worth recommending. */
export const recommendable = (a) => a.type !== 'SINGLE' && !isForKids(a);

/**
 * Deals `n` albums. Albums in `shown` whose id is in `keep` stay in their slots and steer the rest.
 * `owned` is her saved collection, `favourites` [{album, weight}] what she loved or liked here,
 * `known` and `extra` [{id, why}] the other sources. `judged`, `blocked` (ids) and
 * `blockedArtists` come from taste.js. `similar(id)` resolves to album ids, `details(ids)` to
 * albums (max 20 ids). Returns `fresh`, the new albums only, each with a `why`.
 */
export async function recommend({
  shown = [], keep = new Set(), n = 6, seen = [], owned = [], favourites = [], known = [], extra = [],
  judged = new Set(), blocked = new Set(), blockedArtists = new Set(), similar, details, rng = Math.random,
}) {
  const kept = shown.filter((a) => keep.has(a.id));
  const want = n - kept.length;
  if (want <= 0) return { albums: shown, fresh: [] };

  const skip = new Set([...owned.map((a) => a.id), ...seen, ...shown.map((a) => a.id), ...judged, ...blocked]);
  const fits = (a) => recommendable(a) && !blockedArtists.has(a.artist);

  // Seeds: picked albums first, then a weighted draw from saved, loved and liked ones.
  const pool = [...owned.map((album) => ({ album, weight: 1 })), ...favourites]
    .filter(({ album }) => fits(album) && !keep.has(album.id));
  const seeds = [
    ...kept.map((album) => ({ album, weight: PICKED_WEIGHT })),
    ...weightedSample(pool, (s) => s.weight, kept.length ? WILD : SEEDS, rng),
  ];
  const lists = await Promise.all(seeds.map((s) => similar(s.album.id).catch(() => [])));

  // Each candidate's weight, and where it came from.
  const weights = new Map();
  const from = new Map();
  const reasons = new Map();
  lists.forEach((ids, i) => {
    for (const id of ids) {
      if (skip.has(id)) continue;
      weights.set(id, (weights.get(id) ?? 0) + seeds[i].weight);
      from.set(id, [...(from.get(id) ?? []), seeds[i].album]);
    }
  });
  for (const { id, why: w } of extra) {
    if (skip.has(id)) continue;
    weights.set(id, (weights.get(id) ?? 0) + 1);
    if (!from.has(id)) reasons.set(id, w);
  }

  const fresh = [];
  const artists = new Set(kept.map((a) => a.artist));
  /** Fetches details for `ids` in order and takes up to `limit` that fit. */
  async function take(ids, limit, reason) {
    for (let i = 0; i < ids.length && limit > 0; i += 20) {
      const batch = ids.slice(i, i + 20);
      const byId = new Map((await details(batch)).map((a) => [a.id, a]));
      for (const id of batch) {
        const a = byId.get(id);
        if (!a || !fits(a) || artists.has(a.artist) || limit <= 0) continue;
        fresh.push({ ...a, why: reason(id, a) });
        artists.add(a.artist);
        limit--;
      }
    }
  }

  // Albums she already knows first (fewer when she's asking for more like her picks), then new ones.
  const knownWhy = new Map(known.filter((k) => !skip.has(k.id)).map((k) => [k.id, k.why]));
  const knownIds = weightedSample([...knownWhy.keys()], () => 1, Infinity, rng);
  await take(knownIds, Math.min(want, kept.length ? 1 : KNOWN), (id) => knownWhy.get(id));
  const taken = () => new Set(fresh.map((a) => a.id));
  const order = weightedSample([...weights.keys()], (id) => weights.get(id), Infinity, rng);
  await take(order.filter((id) => !taken().has(id)), want - fresh.length, (id, a) => why(a, from.get(id)) || reasons.get(id) || '');
  // Not enough new ones: top up with more she knows.
  if (fresh.length < want) await take(knownIds.filter((id) => !taken().has(id)), want - fresh.length, (id) => knownWhy.get(id));

  // Mix the known ones in rather than always leading with them.
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }
  if (!kept.length) return { albums: fresh, fresh };
  let j = 0;
  const albums = shown.map((a) => (keep.has(a.id) ? a : fresh[j++])).concat(fresh.slice(j)).filter(Boolean);
  return { albums, fresh };
}
