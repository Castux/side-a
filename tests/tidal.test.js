import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseAlbums, parseIds, parseTrackAlbums, pickCover } from '../tidal.js';

// The fixtures are hand-written from Tidal's OpenAPI spec, not captured responses.
// Replacing them with real ones (personal data stripped) would make these tests worth more.

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

test('reads collection ids and the next cursor', () => {
  assert.deepEqual(parseIds(fixture('collection-page.json')), { ids: ['1001', '1002'], next: 'abc' });
  assert.deepEqual(parseIds({ data: [] }), { ids: [], next: null });
});

test('resolves artists and a cover from included', () => {
  const [a, b] = parseAlbums(fixture('albums.json'));
  assert.deepEqual(a, {
    id: '1001', title: 'Kind of Blue', artist: 'Miles Davis', year: 1959,
    cover: 'https://resources.tidal.com/images/x/640x640.jpg', type: 'ALBUM', copyright: '℗ 1959 Columbia Records',
  });
  assert.equal(b.artist, 'Daft Punk');
  assert.equal(b.cover, null);
  assert.equal(b.type, '');
  assert.equal(b.copyright, '');
});

test('pickCover prefers the smallest file that is big enough', () => {
  const art = (...w) => ({ attributes: { files: w.map((x) => ({ href: String(x), meta: { width: x } })) } });
  assert.equal(pickCover(art(160, 320, 640)), '320');
  assert.equal(pickCover(art(80, 160)), '160');
  assert.equal(pickCover(undefined), null);
});

test('reads ids of other types, such as mix tracks', () => {
  const doc = { data: [{ id: 't1', type: 'tracks' }, { id: 'v1', type: 'videos' }, { id: 't2', type: 'tracks' }] };
  assert.deepEqual(parseIds(doc, 'tracks'), { ids: ['t1', 't2'], next: null });
});

test('finds each track’s album', () => {
  const doc = { data: [
    { id: 't1', type: 'tracks', relationships: { albums: { data: [{ id: 'a1', type: 'albums' }] } } },
    { id: 't2', type: 'tracks', relationships: { albums: { data: [] } } },
    { id: 't3', type: 'tracks', relationships: { albums: { data: [{ id: 'a1', type: 'albums' }, { id: 'a2', type: 'albums' }] } } },
  ] };
  assert.deepEqual(parseTrackAlbums(doc), ['a1', 'a1']);
});
