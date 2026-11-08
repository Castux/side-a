import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recommend, why } from '../recommend.js';

const seeded = (s = 1) => () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 2 ** 32);
const album = (id, extra = {}) => ({ id, title: 'T' + id, artist: 'Artist ' + id, year: 2000, cover: null, type: 'ALBUM', copyright: '', ...extra });

// A fake Tidal: every album is similar to the same 30 candidates, a few of them unsuitable.
const owned = Array.from({ length: 10 }, (_, i) => album('c' + i));
const candidates = Array.from({ length: 30 }, (_, i) => album('r' + i));
candidates[0] = album('r0', { title: 'Nursery Rhymes Vol. 1' });
candidates[1] = album('r1', { type: 'SINGLE' });
candidates[2] = album('r2', { artist: 'Artist r3' }); // same artist as r3
const knownAlbums = Array.from({ length: 6 }, (_, i) => album('k' + i));
const catalog = new Map([...owned, ...candidates, ...knownAlbums].map((a) => [a.id, a]));
const api = (lists = {}) => ({
  similar: async (id) => lists[id] ?? ['c1', ...candidates.map((a) => a.id)],
  details: async (ids) => { assert.ok(ids.length <= 20); return ids.map((id) => catalog.get(id)).filter(Boolean); },
});
const ids = (albums) => albums.map((a) => a.id);

test('recommends six: not owned, not for kids, no singles, one per artist, each with a reason', async () => {
  for (let s = 1; s <= 20; s++) {
    const { albums, fresh } = await recommend({ owned, ...api(), rng: seeded(s) });
    assert.equal(albums.length, 6);
    assert.deepEqual(albums, fresh);
    assert.ok(albums.every((a) => a.id.startsWith('r') && !['r0', 'r1'].includes(a.id)));
    assert.equal(new Set(albums.map((a) => a.artist)).size, 6);
    assert.ok(albums.every((a) => a.why.startsWith('Like ')));
  }
});

test('skips albums seen today, judged or blocked, and blocked artists', async () => {
  const seen = ['r3', 'r4', 'r5'];
  const judged = new Set(['r6', 'r7']);
  const blocked = new Set(['r8', 'r9']);
  const blockedArtists = new Set(['Artist r10', 'Artist r11']);
  for (let s = 1; s <= 10; s++) {
    const { albums } = await recommend({ owned, seen, judged, blocked, blockedArtists, ...api(), rng: seeded(s) });
    assert.ok(albums.every((a) => !['r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11'].includes(a.id)), ids(albums).join());
  }
});

test('mixes in up to three albums she already knows, with their own reason', async () => {
  const known = knownAlbums.map((a) => ({ id: a.id, why: 'From your liked tracks' }));
  known.push({ id: 'c2', why: 'From your liked tracks' }); // already saved: never shown
  const { albums } = await recommend({ owned, known, ...api(), rng: seeded() });
  const fromKnown = albums.filter((a) => a.id.startsWith('k'));
  assert.equal(fromKnown.length, 3);
  assert.ok(fromKnown.every((a) => a.why === 'From your liked tracks'));
  assert.ok(!ids(albums).includes('c2'));
});

test('with nothing else to offer, it fills up with albums she knows', async () => {
  const known = knownAlbums.map((a) => ({ id: a.id, why: 'From your daily mix' }));
  const { albums } = await recommend({ owned, known, similar: async () => [], details: api().details, rng: seeded() });
  assert.deepEqual(ids(albums).sort(), ids(knownAlbums).sort());
});

test('Tidal’s own picks come in with their reason', async () => {
  const extra = [{ id: 'r20', why: 'From your discovery mix' }];
  const { albums } = await recommend({ owned, extra, similar: async () => [], details: api().details, rng: seeded() });
  assert.deepEqual(albums.map((a) => [a.id, a.why]), [['r20', 'From your discovery mix']]);
});

test('loved albums seed recommendations even with nothing saved', async () => {
  const loved = album('l1', { artist: 'Plini' });
  const { albums } = await recommend({ favourites: [{ album: loved, weight: 2 }], ...api({ l1: ['r12', 'r13'] }), rng: seeded() });
  assert.deepEqual(ids(albums).sort(), ['r12', 'r13']);
  assert.ok(albums.every((a) => a.why === 'Like Plini'));
});

test('kept albums stay in their slots and steer the rest', async () => {
  const shown = candidates.slice(10, 16);
  const keep = new Set(['r10', 'r13']);
  const near = Array.from({ length: 10 }, (_, i) => 'r' + (16 + i));
  let fromNear = 0;
  for (let s = 1; s <= 20; s++) {
    const { albums, fresh } = await recommend({
      owned, shown, keep, ...api({ r10: near, r13: near, c0: ['r26', 'r27', 'r28', 'r29'] }), rng: seeded(s),
    });
    assert.equal(albums[0], shown[0]);
    assert.equal(albums[3], shown[3]);
    assert.equal(fresh.length, 4);
    fromNear += fresh.filter((a) => near.includes(a.id)).length;
  }
  assert.ok(fromNear >= 0.7 * 80, `${fromNear} of 80 from the kept albums’ neighbours`);
});

test('never starts from a kids’ album or a blocked artist', async () => {
  const asked = [];
  const { similar, details } = api();
  await recommend({
    owned: [album('k1', { artist: 'Pinkfong' }), album('k2', { title: 'Lastenlauluja' }), album('b1', { artist: 'Blocked' })],
    blockedArtists: new Set(['Blocked']),
    similar: (id) => { asked.push(id); return similar(id); }, details, rng: seeded(),
  });
  assert.deepEqual(asked, []);
});

test('a failing similar-albums call doesn’t stop the rest', async () => {
  const { details } = api();
  let calls = 0;
  const similar = async () => { if (calls++ % 2) throw new Error('429'); return candidates.map((a) => a.id); };
  const { albums } = await recommend({ owned, similar, details, rng: seeded() });
  assert.equal(albums.length, 6);
});

test('why names the albums a recommendation came from', () => {
  const a = album('x', { artist: 'Plini' });
  assert.equal(why(a, [album('s1', { artist: 'Radiohead' })]), 'Like Radiohead');
  assert.equal(why(a, [album('s1', { artist: 'Muse' }), album('s2', { artist: 'Muse' }), album('s3', { artist: 'Portishead' }), album('s4', { artist: 'Air' })]), 'Like Muse and Portishead');
  assert.equal(why(a, [album('s1', { artist: 'Muse' }), album('s2', { artist: 'Plini' })]), 'More by Plini');
  assert.equal(why(a, [album('s1', { artist: 'Various Artists', title: 'Drive' })]), 'Like “Drive”');
  assert.equal(why(a, [album('s1', { artist: 'Berliner Philharmoniker, Herbert von Karajan' })]), 'Like Berliner Philharmoniker');
  assert.equal(why(a, []), '');
});
