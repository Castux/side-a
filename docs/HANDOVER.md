# Side A: handover

This document is for the AI assistant (Claude Code or similar) picking up this repo on the owner’s machine. Read it fully before changing code. It records what the product is for, what exists, what has and hasn’t been verified, and what to do next.

Written 3 November 2026 at the end of the first build session, which happened in a sandbox with no access to Tidal or the other music services. Everything was built against Tidal’s published OpenAPI spec, hand-written fixtures and memory of third-party APIs. **Nothing has touched a live API yet.** Treat every external call as unproven until you’ve seen a real response.

## 1. The product

The owner listens to whole albums, never shuffled tracks, from their Tidal collection. Each morning they want Side A to:

1. Show five random albums from their collection, as different from each other as possible.
2. Let them tap the ones that fit their mood (any number, including none).
3. Show five more, closer to what they tapped and further from what they skipped.
4. Repeat until one jumps out, then tap Play to open it in the Tidal app.

The ritual should take under a minute. Every card has its own Play button, so they can stop at any round. Secondary needs: browse and search the collection, see what they played, and tune how fast the picking narrows.

Things the owner cares about, in priority order: the morning flow feels quick and a little delightful on a phone; picks feel like they understood the mood; Play reliably opens the album in Tidal.

## 2. Current state

| Area | State |
|---|---|
| Morning flow, library, history, tuning UI | Working with sample data; smoke-tested in headless Chromium |
| Recommender | Working, 9 unit tests |
| Sample collection (66 albums) | Hand-tagged mood numbers, generated placeholder covers |
| Persistence | Browser `localStorage` (plays, sessions, settings) |
| Tidal login (OAuth + PKCE) | Written from the spec, **never run** |
| Tidal client and parsers | Written from the spec, tested against hand-written fixtures only |
| Mood enrichment (`npm run enrich`) | Written, **never run**. MusicBrainz, Last.fm and AcousticBrainz shapes are from memory |
| Discogs | Not implemented (weights and lexicon are ready for it) |

`prototype/side-a.html` is the original single-file prototype published as a claude.ai artifact. Keep it as a visual reference; don’t develop in it.

## 3. Commands

```sh
npm install          # .npmrc sets legacy-peer-deps; see §8
npm run dev          # http://localhost:5173, sample data by default
npm test             # vitest, 27 tests, all passing at handover
npm run typecheck
npm run build
npm run enrich -- --limit 20   # builds public/features.json from Tidal + other sources
```

To use Tidal instead of the sample data, copy `.env.example` to `.env.local`, set `VITE_LIBRARY=tidal` and `VITE_TIDAL_CLIENT_ID`, and restart the dev server.

## 4. Architecture

Plain TypeScript, Vite, no UI framework. Views render HTML strings into `#app`; all events are delegated in `src/main.ts` using `data-action` attributes. The recommender and enrichment code are pure and tested; the UI is not unit-tested.

```
src/
  core/          types.ts (Album, MoodVector, Settings, AppState), math.ts (seeded RNG, vector helpers)
  data/
    sampleAlbums.ts, mockLibrary.ts     the sample LibraryAdapter
    tidal/
      auth.ts         PKCE login, token refresh, browser token storage
      client.ts       TidalClient: collection, albums (20 ids/request), tracks, similar albums
      parse.ts        pure JSON:API → TidalAlbum / TidalTrack
      tidalLibrary.ts LibraryAdapter over TidalClient + public/features.json
      links.ts        album, app-scheme and search URLs
  recommender/   recommender.ts (sessions and rounds), describe.ts (mood words)
  enrich/        signals.ts (types), lexicon.ts (word → mood), combine.ts (signals → vector),
                 musicbrainz.ts, lastfm.ts, acousticbrainz.ts
  covers/        cover.ts: generated SVG sleeves for albums without art
  store/         store.ts: StateStore interface + LocalStore
  ui/            app.ts (shared state, helpers), morning.ts, views.ts (library, history, how, sheet, connect)
  main.ts        boot, adapter choice, routing (#morning, #library, #history, #how), events
scripts/enrich.ts   Node CLI that writes public/features.json
tests/              recommender, combine, tidal (+ fixtures/)
docs/               this file, tidal-api-notes.md, data-sources.md, design.md
```

Key seams, each the single place to change:

- **`LibraryAdapter`** (`core/types.ts`): `name`, `listAlbums()`, `playLink(album)`. Anything that supplies albums implements this.
- **`StateStore`** (`store/store.ts`): swap localStorage for a backend here.
- **`public/features.json`**: a map from Tidal album id to `{f, confidence, sources, updatedAt}`. The browser app only reads it; `scripts/enrich.ts` writes it. Albums missing from it get a rough vector from their Tidal genres alone.

## 5. The mood model

Every album has four numbers, each 0 to 1:

| Index | Axis | 0 | 1 |
|---|---|---|---|
| 0 | energy | calm | lively |
| 1 | brightness | dark | bright |
| 2 | organic | electronic | acoustic |
| 3 | density | spare | lush |

Albums can also carry a per-axis `confidence` and a list of `sources`, shown on the detail sheet.

### Recommender (`src/recommender/recommender.ts`)

The file’s header comment is the spec. In short: round 1 uses farthest-point sampling for variety. After that a session holds a `target` point and a radius `sigma`. Picks pull the target 60% of the way to their average; skipped albums push it 12% away and dampen their close neighbours for the rest of the session. A round with picks multiplies sigma by `settings.shrink` (0.62 default, floor 0.10); a round with none multiplies it by 1.35 (ceiling 0.60). Candidates are weighted-sampled from a Gaussian around the target, with a spread penalty so the five differ. Rounds up to 3 replace one slot with a wildcard from outside the zone. All constants are in `TUNING`.

Known behaviour: in a small library a focused session runs out of nearby albums within about four rounds, then shows the nearest remaining ones. This is expected with 66 samples and should fade with a real collection of a few hundred albums.

### Enrichment (`src/enrich/combine.ts`)

Each source yields estimates `{axis, value, weight}`. An axis is the weighted mean of its estimates, 0.5 if there are none; confidence is `1 − e^(−total weight)`. Weights are in `WEIGHTS`. Mappings:

- **Energy:** median Tidal tempo (65→0, 165→1, weak because tempo detection often doubles or halves); AcousticBrainz aggressive, party, danceable and (1 − relaxed); tags such as “chill” or “energetic”.
- **Brightness:** share of bright vs. dark key scales on Tidal tracks; AcousticBrainz happy and (1 − sad); tags and tone tags.
- **Organic:** AcousticBrainz acoustic and (1 − electronic); genres and styles.
- **Density:** only tags, genres and styles. This is the weakest axis.

`src/enrich/lexicon.ts` maps about 150 words to axis targets. The enrich report lists the most common unmatched terms so the lexicon can be grown from real data.

## 6. Verified vs. assumed

Be precise about this when you report to the owner.

**Verified by reading Tidal’s OpenAPI spec** (`@tidal-music/api` 0.55.0, `bin/tidal-api-oas.json`; the repo pins 0.53.0, so re-check if behaviour differs):

- Base URL `https://openapi.tidal.com/v2`; JSON:API with `Accept: application/vnd.api+json`.
- `GET /userCollectionAlbums/me/relationships/items` needs the scope `collection.read` (third-party tier). It accepts `sort` (`-addedAt` default, also artist name, release date and title) and `page[cursor]`; each item carries `meta.addedAt`.
- `GET /albums` takes up to 20 `filter[id]` values and `include` of `artists`, `genres`, `coverArt`, `items`, `similarAlbums` and more.
- Album attributes include `title`, `releaseDate`, `barcodeId`, `popularity` and `numberOfItems`. Track attributes include `isrc`, `bpm`, `key`, `keyScale` (major, minor and modes) and `toneTags` (array of strings, example “Happy”, no list of values).
- Genres are resources with `genreName`. Artwork has `files[]` with `href` and `meta.width/height`.
- Paging cursor: `links.meta.nextCursor`.
- OAuth URLs: authorize `https://login.tidal.com/authorize`, token `https://auth.tidal.com/v1/oauth2/token`.
- Array query params use the OpenAPI default (repeat the key), which is what the official SDK’s `openapi-fetch` does.

**Assumed, needs checking:**

- The token request body (standard OAuth PKCE form fields) and whether Tidal requires anything extra.
- That browsers can call `openapi.tidal.com` directly (CORS). If not, add a small proxy.
- How many tracks actually have `bpm`, `keyScale` and `toneTags` filled in, and what tone tag values look like.
- That `tidal.com/browse/album/{id}` opens the Tidal app on the owner’s phone. `tidal://album/{id}` exists in `links.ts` but is unused.
- MusicBrainz, Last.fm and AcousticBrainz request and response shapes, written from memory. See `docs/data-sources.md`.

## 7. Next tasks, in order

1. **Prove the Tidal login.** Register an app at developer.tidal.com with redirect URI `http://localhost:5173/`. Run with `VITE_LIBRARY=tidal`. Fix `auth.ts` against the real flow. Done when the library page lists the owner’s real albums with real covers.
2. **Capture real fixtures.** Save one collection page, one `/albums` batch and one album’s tracks, strip personal data, replace the files in `tests/fixtures/`, and fix any parser mismatches. Done when `npm test` passes on real shapes.
3. **Measure Tidal’s own mood data.** Run `npm run enrich -- --limit 30` with only the Tidal token set. Report what share of tracks have bpm, key scale and tone tags, and list the tone tag values seen. Add those values to the lexicon. This decides how much the other sources matter.
4. **Add Last.fm.** Get a free API key, run enrich again, and check the unmatched-terms report. Grow the lexicon from it.
5. **Check Play on the phone.** Confirm the album link opens the Tidal app on iOS/Android. If it doesn’t, try `tidal://album/{id}` on mobile with the web link as fallback.
6. **Sanity-check the vectors with the owner.** Show 10–15 albums they know well with their four numbers (turn on “Show fit scores and mood numbers” in How it works). Adjust `WEIGHTS` and the lexicon until they agree.
7. **Then, optionally:** AcousticBrainz dumps for older albums (see data-sources), Discogs styles, using Tidal’s similar albums as a small boost in the recommender, hosting (static site; enrichment stays a local script), and a way for the owner to correct an album’s mood from the detail sheet.

## 8. Gotchas

- **npm 10.9 crashes** resolving vitest 5’s optional peer deps (“Cannot read properties of null (reading 'edgesOut')”). `.npmrc` sets `legacy-peer-deps=true` as a workaround. Remove it on npm 11+ if a clean install works.
- **TypeScript 7.0** (the native compiler) is pinned. If tooling misbehaves, 5.9 is a safe fallback; the code uses nothing version-specific.
- Dependency versions were pinned to releases at least two weeks old at the time. Keep pinning exact versions.
- Scripts run in Node 22, where `fetch`, `crypto.subtle` and `process.loadEnvFile` are built in.
- The generated covers are deliberately driven by the mood vector. Don’t replace them with random art; they help when mood numbers are being debugged.
- `public/features.json` will contain the owner’s collection once enriched. Decide with them whether it belongs in git before committing it.

## 9. Working with the owner

- Ask before changing the four-axis model, the morning flow or the visual design; these were agreed choices. Recommender constants, lexicon entries and source weights are fine to tune with evidence.
- When something external doesn’t match these notes, say which assumption was wrong and fix the notes in this file too.
- Keep copy in the existing voice: sentence case, plain verbs, typographic apostrophes (’) in UI text. Design rules are in `docs/design.md`.
- Keep the pure modules pure, and add a test with every recommender or enrichment change.
