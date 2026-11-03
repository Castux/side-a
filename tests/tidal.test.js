import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { albumUrl, parseAlbums, parseCollectionPage, pickCover } from '../tidal.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

test('reads collection ids and the next cursor', () => {
  assert.deepEqual(parseCollectionPage(fixture('collection-page.json')), { ids: ['1001', '1002'], next: 'abc' });
  assert.deepEqual(parseCollectionPage({ data: [] }), { ids: [], next: null });
});

test('resolves artists, genres and a cover from included', () => {
  const [a, b] = parseAlbums(fixture('albums.json'));
  assert.deepEqual(a, {
    id: '1001', title: 'Kind of Blue', artist: 'Miles Davis', year: 1959, genres: ['Jazz'],
    cover: 'https://resources.tidal.com/images/x/640x640.jpg',
  });
  assert.equal(b.artist, 'Daft Punk');
  assert.equal(b.cover, null);
});

test('pickCover prefers the smallest file that is big enough', () => {
  const art = (...w) => ({ attributes: { files: w.map((x) => ({ href: String(x), meta: { width: x } })) } });
  assert.equal(pickCover(art(160, 320, 640)), '320');
  assert.equal(pickCover(art(80, 160)), '160');
  assert.equal(pickCover(undefined), null);
});

test('album links point at the Tidal web player', () => {
  assert.equal(albumUrl('1001'), 'https://tidal.com/browse/album/1001');
});
