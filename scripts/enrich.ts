/**
 * Builds public/features.json: one mood vector per album in your Tidal collection.
 *
 *   npm run enrich                 # all albums, reusing cached signals
 *   npm run enrich -- --limit 20   # first 20 albums only (good first test)
 *   npm run enrich -- --refresh    # ignore .cache/signals and fetch again
 *
 * Needs TIDAL_ACCESS_TOKEN in .env.local (copy it from the app after logging in:
 * localStorage key "side-a:tidal-token"). Last.fm and AcousticBrainz are used when
 * LASTFM_API_KEY / ACOUSTICBRAINZ_DIR are set. Untested against live APIs: run with
 * --limit first and read the report.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { TidalClient } from '../src/data/tidal/client';
import { combine } from '../src/enrich/combine';
import { MusicBrainz } from '../src/enrich/musicbrainz';
import { lastfmAlbumTags } from '../src/enrich/lastfm';
import { averageRecordings, parseHighLevel } from '../src/enrich/acousticbrainz';
import type { AlbumSignals, FeatureCache } from '../src/enrich/signals';

try { process.loadEnvFile('.env.local'); } catch { /* optional */ }

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;
const refresh = args.includes('--refresh');
const env = process.env;

if (!env.TIDAL_ACCESS_TOKEN) {
  console.error('Set TIDAL_ACCESS_TOKEN in .env.local first (see .env.example).');
  process.exit(1);
}

const tidal = new TidalClient({
  getToken: async () => env.TIDAL_ACCESS_TOKEN!,
  countryCode: env.VITE_TIDAL_COUNTRY || 'US',
  onRateLimit: (ms) => console.log(`  rate-limited by Tidal, waiting ${ms} ms`),
});
const mb = new MusicBrainz({ userAgent: env.MUSICBRAINZ_USER_AGENT || 'SideA/0.1 ( set MUSICBRAINZ_USER_AGENT )' });
const abDir = env.ACOUSTICBRAINZ_DIR;

const exists = (p: string) => access(p).then(() => true, () => false);
const CACHE = '.cache/signals';

async function gather(albumId: string, title: string, artist: string, barcode: string | null, genres: string[]): Promise<AlbumSignals> {
  const sig: AlbumSignals = {};
  const tracks = await tidal.albumTracks(albumId);
  sig.tidal = {
    genres,
    bpms: tracks.map((t) => t.bpm),
    keyScales: tracks.map((t) => t.keyScale),
    toneTags: tracks.flatMap((t) => t.toneTags),
    trackCount: tracks.length,
  };

  try {
    let recordingIds: string[] = [];
    const rel = barcode ? await mb.releaseByBarcode(barcode) : null;
    if (rel) {
      const tags = await mb.releaseGroupTags(rel.releaseGroupId);
      sig.musicbrainz = { releaseGroupId: rel.releaseGroupId, ...tags };
      if (abDir) recordingIds = await mb.releaseRecordings(rel.releaseId);
    } else if (abDir) {
      for (const t of tracks.slice(0, 4)) if (t.isrc) recordingIds.push(...(await mb.recordingsByIsrc(t.isrc)).slice(0, 1));
    }
    if (abDir && recordingIds.length) {
      const moods = [];
      for (const id of recordingIds) {
        const p = join(abDir, `${id}.json`);
        if (!(await exists(p))) continue;
        const m = parseHighLevel(JSON.parse(await readFile(p, 'utf8')));
        if (m) moods.push(m);
      }
      sig.acousticbrainz = averageRecordings(moods);
    }
  } catch (e) {
    console.warn(`  MusicBrainz step failed for ${title}: ${(e as Error).message}`);
  }

  if (env.LASTFM_API_KEY) {
    try { sig.lastfm = { tags: await lastfmAlbumTags(artist, title, env.LASTFM_API_KEY) }; }
    catch (e) { console.warn(`  Last.fm failed for ${title}: ${(e as Error).message}`); }
  }
  return sig;
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  console.log('Reading your Tidal collection…');
  const items = (await tidal.collectionAlbumIds()).slice(0, limit);
  const albums = await tidal.albums(items.map((i) => i.id));
  console.log(`${albums.length} albums.`);

  const out: FeatureCache = (await exists('public/features.json'))
    ? JSON.parse(await readFile('public/features.json', 'utf8')) : {};
  const sourceCount = new Map<string, number>();
  const unmatched = new Map<string, number>();
  const conf = [0, 0, 0, 0];

  for (const [n, a] of albums.entries()) {
    const artist = a.artists[0] ?? '';
    console.log(`[${n + 1}/${albums.length}] ${artist} – ${a.title}`);
    const cachePath = join(CACHE, `${a.id}.json`);
    let sig: AlbumSignals;
    if (!refresh && (await exists(cachePath))) sig = JSON.parse(await readFile(cachePath, 'utf8'));
    else {
      sig = await gather(a.id, a.title, artist, a.barcodeId, a.genres);
      await writeFile(cachePath, JSON.stringify(sig, null, 2));
    }
    const c = combine(sig);
    out[a.id] = { f: c.f, confidence: c.confidence, sources: c.sources, updatedAt: new Date().toISOString() };
    c.sources.forEach((s) => sourceCount.set(s, (sourceCount.get(s) ?? 0) + 1));
    c.unmatched.forEach((u) => unmatched.set(u, (unmatched.get(u) ?? 0) + 1));
    c.confidence.forEach((v, i) => (conf[i]! += v / albums.length));
  }

  await writeFile('public/features.json', JSON.stringify(out, null, 1));
  console.log('\nWrote public/features.json\n\nAlbums per source:');
  for (const [s, k] of [...sourceCount].sort((x, y) => y[1] - x[1])) console.log(`  ${s.padEnd(22)} ${k}`);
  console.log('\nAverage confidence: ' + ['energy', 'brightness', 'organic', 'density'].map((d, i) => `${d} ${conf[i]!.toFixed(2)}`).join(', '));
  console.log('\nMost common terms the lexicon does not know (add them to src/enrich/lexicon.ts):');
  console.log('  ' + [...unmatched].sort((x, y) => y[1] - x[1]).slice(0, 30).map(([t, k]) => `${t} (${k})`).join(', '));
}

main().catch((e) => { console.error(e); process.exit(1); });
