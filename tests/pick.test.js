import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKey, likeness, pick } from '../pick.js';

// Small deterministic RNG so the tests don't flake.
const seeded = (s = 1) => () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 2 ** 32);
const album = (id, artist = 'A' + id, genres = [], year = 2000) => ({ id: String(id), title: 'T' + id, artist, genres, year, cover: null });
const pool = Array.from({ length: 30 }, (_, i) => album(i, 'Artist ' + i, [], 1950 + i * 3));

test('dayKey uses the local calendar day', () => {
  assert.equal(dayKey(new Date(2026, 10, 3, 23, 59)), '2026-11-03');
  assert.equal(dayKey(new Date(2026, 0, 9, 0, 1)), '2026-01-09');
});

test('picks six distinct albums', () => {
  const { albums, reset } = pick(pool, { rng: seeded() });
  assert.equal(albums.length, 6);
  assert.equal(new Set(albums.map((a) => a.id)).size, 6);
  assert.equal(reset, false);
});

test('skips albums seen today', () => {
  const seen = pool.slice(0, 24).map((a) => a.id);
  const { albums } = pick(pool, { seen, rng: seeded() });
  assert.deepEqual(albums.map((a) => a.id).sort(), pool.slice(24).map((a) => a.id).sort());
});

test('resets when fewer than six unseen remain, avoiding the liked ones', () => {
  const seen = pool.slice(0, 27).map((a) => a.id);
  const liked = [pool[0]];
  const { albums, reset } = pick(pool, { seen, liked, rng: seeded() });
  assert.equal(reset, true);
  assert.equal(albums.length, 6);
  assert.ok(!albums.some((a) => a.id === '0'));
});

test('works with a collection smaller than six', () => {
  const { albums } = pick(pool.slice(0, 4), { rng: seeded() });
  assert.equal(albums.length, 4);
});

test('likeness: artist beats genre beats era', () => {
  const x = album(1, 'Miles Davis', ['Jazz'], 1959);
  assert.ok(likeness(x, album(2, 'Miles Davis', [], 1990)) > likeness(x, album(3, 'Other', ['Jazz'], 1990)));
  assert.ok(likeness(x, album(3, 'Other', ['Jazz'], 1990)) > likeness(x, album(4, 'Other', [], 1960)));
  assert.equal(likeness(x, album(5, 'Other', ['Rock'], 2020)), 0);
});

test('liked albums pull in similar ones and keep one random slot', () => {
  const jazz = Array.from({ length: 10 }, (_, i) => album('j' + i, 'J' + i, ['Jazz'], 1800));
  const rock = Array.from({ length: 40 }, (_, i) => album('r' + i, 'R' + i, ['Rock'], 1700));
  const liked = [album('x', 'X', ['Jazz'], 1500)];
  for (let s = 1; s <= 20; s++) {
    const { albums } = pick([...jazz, ...rock], { liked, rng: seeded(s) });
    assert.ok(albums.filter((a) => a.genres[0] === 'Jazz').length >= 5);
  }
});

test('with no similar albums, liked falls back to random', () => {
  const liked = [album('x', 'Nobody', ['Polka'], 0)];
  const { albums } = pick(pool, { liked, rng: seeded() });
  assert.equal(albums.length, 6);
});
