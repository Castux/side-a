// Choosing albums. Pure functions only; tested in tests/pick.test.js.
//
// An album is { id, title, artist, year, cover: string | null }.

/** Local calendar day, e.g. "2026-11-03". Albums shown today aren't shown again until tomorrow. */
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Picks `n` albums from `pool`, skipping ids in `seen`. Uniformly random, except that with
 * `liked` albums, up to n - 1 slots go to other albums by the same artists; there's always a wildcard.
 * If fewer than `n` unseen albums are left, `reset` is true and the pick ignores `seen`
 * (but still never repeats a liked album).
 */
export function pick(pool, { n = 6, seen = [], liked = [], rng = Math.random } = {}) {
  const skip = new Set(seen);
  let rest = pool.filter((a) => !skip.has(a.id));
  const reset = rest.length < n;
  if (reset) {
    const now = new Set(liked.map((a) => a.id));
    rest = pool.filter((a) => !now.has(a.id));
  }
  const take = (list) => list.splice(Math.floor(rng() * list.length), 1)[0];
  const artists = new Set(liked.map((a) => a.artist));
  const same = rest.filter((a) => artists.has(a.artist));
  rest = rest.filter((a) => !artists.has(a.artist));
  const out = [];
  while (out.length < n - 1 && same.length) out.push(take(same));
  rest.push(...same);
  while (out.length < n && rest.length) out.push(take(rest));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { albums: out, reset };
}

/**
 * The next deal. Albums in `shown` whose id is in `keep` stay in their slots; the other slots
 * get albums by the same artists where there are any (see pick), never repeating a kept one.
 * Returns `fresh`, the new albums only, so the caller can mark them seen.
 */
export function deal(pool, { shown = [], keep = new Set(), n = 6, seen = [], rng = Math.random } = {}) {
  const kept = shown.filter((a) => keep.has(a.id));
  const { albums: fresh, reset } = pick(pool, {
    n: n - kept.length, seen: [...seen, ...kept.map((a) => a.id)], liked: kept, rng,
  });
  if (!kept.length) return { albums: fresh, fresh, reset };
  let i = 0;
  const albums = shown.map((a) => (keep.has(a.id) ? a : fresh[i++])).concat(fresh.slice(i)).filter(Boolean);
  return { albums, fresh, reset };
}
