import assert from 'node:assert/strict';
import { test } from 'node:test';
import { judge, lessons } from '../taste.js';

const album = (id, artist = 'Artist ' + id) => ({ id, title: 'T' + id, artist });

test('judge records and clears verdicts without touching the original', () => {
  const v0 = {};
  const v1 = judge(v0, album('a'), 'love', 1);
  assert.deepEqual(v0, {});
  assert.deepEqual(v1.a, { v: 'love', album: album('a'), at: 1 });
  assert.deepEqual(judge(v1, album('a'), null), {});
});

test('kids’ albums block themselves, their artist and their similar albums', () => {
  const v = judge(judge({}, album('k', 'Pinkfong'), 'kids'), album('x'), 'no');
  const { judged, blocked, blockedArtists } = lessons(v, { k: ['k2', 'k3'], x: ['x2'] });
  assert.deepEqual([...judged].sort(), ['k', 'x']);
  assert.deepEqual([...blocked].sort(), ['k', 'k2', 'k3']);
  assert.deepEqual([...blockedArtists], ['Pinkfong']);
});

test('a kids’ compilation doesn’t block Various Artists', () => {
  const { blockedArtists } = lessons(judge({}, album('k', 'Various Artists'), 'kids'));
  assert.equal(blockedArtists.size, 0);
});

test('loved albums seed twice as strongly as liked ones; the rest don’t seed', () => {
  let v = judge({}, album('l'), 'love');
  v = judge(v, album('m'), 'like');
  v = judge(v, album('n'), 'no');
  const { favourites } = lessons(v);
  assert.deepEqual(favourites.map((f) => [f.album.id, f.weight]), [['l', 2], ['m', 1]]);
});
