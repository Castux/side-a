// What she has told Side A about albums, and what follows from it. Pure; tested in tests/taste.test.js.
//
// Verdicts are { [albumId]: { v, album, at } } with v one of:
//   love  saved to her Tidal collection with ♥
//   like  used as "more like this"
//   no    not for her
//   kids  children's music

/** Records a verdict (or clears it with `v = null`), returning a new object. */
export function judge(verdicts, album, v, at = Date.now()) {
  const next = { ...verdicts };
  if (v) next[album.id] = { v, album, at };
  else delete next[album.id];
  return next;
}

/**
 * What the verdicts teach: never show judged albums again; for kids' albums, also block their
 * artist and every album Tidal lists as similar to them (`similar` maps album id → ids), since
 * kids' music clusters. Loved and liked albums become seeds for new recommendations.
 */
export function lessons(verdicts, similar = {}) {
  const judged = new Set(Object.keys(verdicts));
  const blocked = new Set();
  const blockedArtists = new Set();
  const favourites = [];
  for (const [id, { v, album }] of Object.entries(verdicts)) {
    if (v === 'kids') {
      blocked.add(id);
      for (const s of similar[id] ?? []) blocked.add(s);
      if (album?.artist && album.artist !== 'Various Artists') blockedArtists.add(album.artist);
    }
    if ((v === 'love' || v === 'like') && album) favourites.push({ album, weight: v === 'love' ? 2 : 1 });
  }
  return { judged, blocked, blockedArtists, favourites };
}
