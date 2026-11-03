import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKey, deal, pick } from '../pick.js';

// Small deterministic RNG so the tests don't flake.
const seeded = (s = 1) => () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 2 ** 32);
const album = (id, artist = 'A' + id) => ({ id: String(id), title: 'T' + id, artist, year: 2000, cover: null });
const pool = Array.from({ length: 30 }, (_, i) => album(i, 'Artist ' + i));

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

test('liked albums pull in the same artists and keep one random slot', () => {
  const miles = Array.from({ length: 10 }, (_, i) => album('m' + i, 'Miles Davis'));
  const others = Array.from({ length: 40 }, (_, i) => album('o' + i));
  const liked = [album('x', 'Miles Davis')];
  for (let s = 1; s <= 20; s++) {
    const { albums } = pick([...miles, ...others], { liked, rng: seeded(s) });
    assert.ok(albums.filter((a) => a.artist === 'Miles Davis').length >= 5);
  }
});

test('with no other albums by the liked artists, the pick is random', () => {
  const { albums } = pick(pool, { liked: [album('x', 'Nobody')], rng: seeded() });
  assert.equal(albums.length, 6);
});

test('deal keeps picked albums in their slots and refills the rest without repeats', () => {
  const shown = pool.slice(0, 6);
  const keep = new Set(['1', '4']);
  const seen = shown.map((a) => a.id);
  const { albums, fresh, reset } = deal(pool, { shown, keep, seen, rng: seeded() });
  assert.equal(reset, false);
  assert.equal(albums.length, 6);
  assert.equal(albums[1], shown[1]);
  assert.equal(albums[4], shown[4]);
  assert.equal(fresh.length, 4);
  assert.ok(fresh.every((a) => !seen.includes(a.id)));
});

test('deal with nothing kept is a fresh pick', () => {
  const { albums, fresh } = deal(pool, { shown: pool.slice(0, 6), rng: seeded() });
  assert.equal(albums.length, 6);
  assert.equal(albums, fresh);
});

test('deal never repeats a kept album, even after a reset', () => {
  const shown = pool.slice(0, 6);
  const keep = new Set(['0', '1', '2']);
  const seen = pool.slice(0, 28).map((a) => a.id); // only two unseen left
  const { albums, reset } = deal(pool, { shown, keep, seen, rng: seeded() });
  assert.equal(reset, true);
  assert.equal(new Set(albums.map((a) => a.id)).size, 6);
});

test('deal with every album kept changes nothing', () => {
  const shown = pool.slice(0, 6);
  const { albums, fresh } = deal(pool, { shown, keep: new Set(shown.map((a) => a.id)), rng: seeded() });
  assert.deepEqual(albums, shown);
  assert.equal(fresh.length, 0);
});
