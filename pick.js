// Choosing albums. Pure functions only; tested in tests/pick.test.js.
//
// An album is { id, title, artist, year, genres: string[], cover: string | null }.

/** Local calendar day, e.g. "2026-11-03". Albums shown today aren't shown again until tomorrow. */
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** How alike two albums are: same artist counts most, then shared genres, then era. 0 means unrelated. */
export function likeness(a, b) {
  let s = 0;
  if (a.artist && a.artist === b.artist) s += 3;
  const g = new Set(a.genres ?? []);
  for (const x of b.genres ?? []) if (g.has(x)) s += 2;
  if (a.year && b.year) {
    const d = Math.abs(a.year - b.year);
    if (d <= 3) s += 1;
    else if (d <= 8) s += 0.5;
  }
  return s;
}

/** Removes and returns one item, chosen with probability proportional to its weight. */
function takeWeighted(items, weights, rng) {
  const total = weights.reduce((t, w) => t + w, 0);
  let r = rng() * total;
  let i = 0;
  while (i < items.length - 1 && (r -= weights[i]) >= 0) i++;
  weights.splice(i, 1);
  return items.splice(i, 1)[0];
}

/**
 * Picks `n` albums from `pool`, skipping ids in `seen`.
 * With no `liked` albums the pick is uniformly random. With some, up to n - 1 slots go to
 * albums like them (weighted by likeness) and the rest stay random, so there's always a wildcard.
 * If fewer than `n` unseen albums are left, `reset` is true and the pick ignores `seen`.
 */
export function pick(pool, { n = 6, seen = [], liked = [], rng = Math.random } = {}) {
  const skip = new Set(seen);
  let rest = pool.filter((a) => !skip.has(a.id));
  let reset = false;
  if (rest.length < n) {
    reset = true;
    const now = new Set(liked.map((a) => a.id));
    rest = pool.filter((a) => !now.has(a.id));
  }
  rest = rest.slice();
  const out = [];
  if (liked.length) {
    const near = [];
    const weights = [];
    for (const a of rest) {
      const w = Math.max(...liked.map((l) => likeness(l, a)));
      if (w > 0) { near.push(a); weights.push(w); }
    }
    while (out.length < n - 1 && near.length) out.push(takeWeighted(near, weights, rng));
    const taken = new Set(out.map((a) => a.id));
    rest = rest.filter((a) => !taken.has(a.id));
  }
  while (out.length < n && rest.length) out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { albums: out, reset };
}
