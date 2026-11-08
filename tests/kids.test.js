import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isForKids } from '../kids.js';

const kids = [
  { title: 'Baby Shark and More Kids Songs', artist: 'Pinkfong' },
  { title: 'Nursery Rhymes Vol. 3', artist: 'Super Simple Songs' },
  { title: 'Frozen (Original Motion Picture Soundtrack)', artist: 'Various Artists', copyright: '© 2013 Walt Disney Records' },
  { title: 'Lastenlauluja', artist: 'Fröbelin Palikat' },
  { title: 'Muumilaakson tarinoita', artist: 'Various Artists' },
  { title: 'Lasten joulu', artist: 'Various Artists' },
  { title: 'Petit Papa Noël et Chansons de Noël', artist: 'Petit Papa Noël' },
  { title: 'Les plus belles chansons enfantines françaises', artist: 'Santec Music Orchestra' },
  { title: 'Hevisaurus', artist: 'Hevisaurus' },
  { title: 'Barnvisor för hela familjen', artist: 'Various Artists' },
  { title: 'Die 30 besten Kinderlieder', artist: 'Simone Sommerland' },
  { title: 'Comptines pour les enfants', artist: 'Various Artists' },
  { title: 'Lullaby Renditions of Radiohead', artist: 'Rockabye Baby!' },
  { title: 'Party Hits', artist: 'Kidz Bop Kids' },
  { title: 'Songs', artist: 'Someone', copyright: '℗ 2021 Moonbug Entertainment' },
];

const notKids = [
  { title: 'Kid A', artist: 'Radiohead' },
  { title: 'Kids See Ghosts', artist: 'Kids See Ghosts' },
  { title: 'Lullabies to Paralyze', artist: 'Queens of the Stone Age' },
  { title: 'Bedtime Stories', artist: 'Madonna' },
  { title: 'Easy Like', artist: 'Barney Kessel' },
  { title: 'Mahler: Symphony No. 3', artist: 'Berliner Philharmoniker', copyright: 'with Children’s Choir' },
  { title: 'Chopin: Berceuse, Barcarolle', artist: 'Krystian Zimerman' },
  { title: 'The Resistance', artist: 'Muse', copyright: '℗ 2009 Warner Music UK' },
];

test('flags children’s music', () => {
  for (const a of kids) assert.ok(isForKids(a), `${a.artist} – ${a.title}`);
});

test('leaves grown-up music alone', () => {
  for (const a of notKids) assert.ok(!isForKids(a), `${a.artist} – ${a.title}`);
});
