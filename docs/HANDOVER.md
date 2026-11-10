# Side A: handover

Read this before changing code. Live at <https://castux.github.io/side-a/>; every push to `main` deploys (GitHub Pages, repo root).

An earlier, much bigger build (Vite, TypeScript, mood model, several pages) was replaced by this one at the owner’s request. It’s in git history at `e47e2b6`.

## Rules

- Keep it small: plain HTML, CSS and ES modules, no build step, no dependencies. Ask the owner before adding a framework, bundler or package.
- Ask before changing the flow or the visual design (`docs/design.md`).
- `pick.js`, `recommend.js`, `taste.js`, `kids.js` and the parsers in `tidal.js` are pure; change them with a test in `tests/`.
- UI copy: sentence case, plain verbs, typographic apostrophes (’).
- When Tidal doesn’t behave as described here, fix this file.

## The product

One screen, two modes, flipped by an icon next to the greeting.

**Your collection** (default, the owner’s): six random albums from the Tidal collection. Tap sleeves and **More like these** keeps them and refills the rest with other albums by the same artists; **Six more** deals six random ones. Purely random by design: no ratings here.

**New to you** (`#new`, plum and rose theme), built for the owner’s wife. She has saved few albums, and her Tidal recommendations are skewed by the kids’ music played from her account. A one-minute daily routine that rebuilds a clean collection in Tidal:

- Six albums she hasn’t saved, each with a reason in italics: albums she already plays (“From your liked tracks”, “From your daily mix”), albums like her saved and loved ones (“Like Radiohead”, “More by Plini”) and Tidal’s own picks (“From your discovery mix”, “New release for you”).
- **Play** opens it in Tidal. **♥** saves it to her Tidal collection (tap again to remove). **✕** asks “Not for me” or “Kids’ music”, with Undo. Tapping the sleeve is “more like this”, as in the collection.
- Every answer teaches: saved albums seed recommendations strongly, “more like this” ones mildly; judged albums never come back; a kids’ flag also blocks the artist and every album Tidal lists as similar to it, since kids’ music clusters.
- Never kids’ music (word filter plus her flags), singles, saved or judged albums.

In both modes, albums shown today don’t come back until tomorrow.

## Code

| File | What |
|---|---|
| `pick.js` | Collection mode: `pick()` chooses n albums; `deal()` keeps picked ones in place and refills the rest. |
| `recommend.js` | New mode: `recommend()` mixes the sources into six picks with reasons. Takes the Tidal calls as arguments, so tests use fakes. |
| `taste.js` | Her answers (`judge()`) and what they teach (`lessons()`: what to skip, what to block, what to seed from). |
| `kids.js` | `isForKids()`: word patterns over title, artist and copyright line. |
| `tidal.js` | PKCE login (no secret), token refresh, the API calls below, response parsers. |
| `app.js` | Boot, the two modes, rendering, local storage, when to refresh. |
| `config.js` | Tidal client id (public by design with PKCE). Redirect URI is the page’s own URL. |
| `demo.js` | 84 albums from the owner’s collection for `?demo` (real ids and covers), four or five each by 19 artists. Demo has no “new to you” mode, since that needs Tidal. |

**How a new-mode deal works** (`recommend()`): up to 3 slots (1 when something is picked) go to albums she already knows (liked tracks, daily mixes), random order. The rest come from weighted candidates: albums similar to the seeds (picked 3×, loved 2×, saved or liked 1×; 8 seeds when nothing is picked, else the picked ones plus 2), plus Tidal’s discovery and new-release mixes at weight 1. Details are fetched best-first, skipping kids’ albums, singles, blocked artists and repeats of an artist. If that runs short, more known albums fill in. The six are shuffled so the known ones don’t always lead.

**Sources** are gathered once a day on the first deal: the albums of her 200 most recently liked tracks and, with the `recommendations.read` scope, of her daily, discovery and new-release mixes. A source that fails is skipped; a 403 (token from before the new scopes) shows “Log in again” and isn’t cached.

**Kids filter:** Tidal’s genres are empty, so `kids.js` matches words: kids’ phrases in English, Finnish, Swedish, Danish, Norwegian, German, Dutch, French, Spanish and Italian, plus brands (Disney, Pinkfong, Cocomelon, Hevisaurus…). Against the owner’s 576 albums it flagged all ten kids’ albums and nothing else. Disney in the copyright line also drops Star Wars, Marvel and Tron soundtracks, on purpose. Her “Kids’ music” flags catch what words can’t. When something common slips through, add a pattern and a test case.

**Fast start:** with a cached collection, collection mode renders straight away with no API call. The collection refreshes in the background at most hourly, and only after the first tap on a sleeve, Play or the button; cards on screen don’t change when it lands. A refresh fetches details only for new ids, 20 per request. New mode needs the network for each deal (the first of the day also gathers sources, a few seconds), but today’s six are stored, so a reload is instant.

**Local storage** (`sideA.` prefix, `sideA.demo.` in demo mode):

| Key | Holds |
|---|---|
| `token` | `{access, refresh, expires}` |
| `albums` | `[{id, title, artist, year, cover, type, copyright}]`, cover a ~320px image URL; about 250 bytes each |
| `syncedAt` | ms timestamp of the last refresh |
| `seen`, `seenNew` | `{day, ids}` shown today, per mode |
| `newShown` | `{day, albums}` today’s six in new mode, with `why` |
| `sources` | `{day, known, extra}` today’s album ids from liked tracks and mixes, each `{id, why}` |
| `similar` | `{albumId: [ids]}` each album’s similar albums, fetched once and kept |
| `verdicts` | `{albumId: {v, album, at}}` her answers: `love` (saved), `like` (used as more like this), `no`, `kids`. Kept on log out. Only in this browser. |

## Tidal API

Base `https://openapi.tidal.com/v2`, JSON:API (`Accept: application/vnd.api+json`), paging via `links.meta.nextCursor` → `page[cursor]`. Login: `https://login.tidal.com/authorize`, token `https://auth.tidal.com/v1/oauth2/token`, scopes from `TIDAL_SCOPES` in `config.js`, currently `collection.read collection.write`. Every scope requested must be enabled on the Tidal app, or Tidal’s login page fails with error 1002 (8 Nov 2026: asking for `recommendations.read` broke login). The mixes are only fetched when `recommendations.read` is in the list. Reference: <https://tidal-music.github.io/tidal-api-reference/>.

| Purpose | Request |
|---|---|
| Collection ids | `GET /userCollectionAlbums/me/relationships/items?sort=-addedAt` |
| Album details | `GET /albums?filter[id]=…&include=artists&include=coverArt` (max 20 ids) |
| Similar albums | `GET /albums/{id}/relationships/similarAlbums` (first page only) |
| Liked tracks | `GET /userCollectionTracks/me/relationships/items?sort=-addedAt` |
| Mixes | `GET /userDailyMixes/me/relationships/items`, same for `userDiscoveryMixes`, `userNewReleaseMixes` (first page) |
| Tracks’ albums | `GET /tracks?filter[id]=…&include=albums` (max 20 ids) |
| Save / unsave | `POST` / `DELETE /userCollectionAlbums/me/relationships/items` with `{data: [{id, type: "albums"}]}` |

429s are retried using `Retry-After`. A 401 logs out. A 403 means the token predates a scope: log in again.

**Confirmed live (3 Nov 2026):** login, token exchange, collection ids and album details work straight from the browser (no CORS proxy), with `me` as the collection id. Album genres come back empty, so they aren’t fetched.

**Not yet checked** (new mode was tested only against a fake Tidal in headless Chrome):

- That `similarAlbums` returns album ids for a user token without `countryCode`. If it comes back empty, try adding `countryCode`.
- That `/albums` fills `albumType` and `copyright.text`. Without them, singles get through and the kids filter only sees title and artist.
- That the mixes accept `me` as their id and list tracks. The spec types their attributes as empty objects; if `me` fails, `GET /userDailyMixes/me` (without `/relationships/items`) or the user id may be needed.
- That `/tracks?include=albums` links each track to its album, and that save and unsave answer 2xx with that body.
- Whether `tidal.com/browse/album/{id}` opens the Tidal app on the phone. If not, try `tidal://album/{id}`.
- Albums `/albums` doesn’t return (region-locked, removed) are requested again on every refresh. Harmless; cache the misses if it’s common.

## Next

1. **Try new mode live** on her phone and check the points above (browser console warnings name any source that failed). Logins from before 8 Nov 2026 lack the new scopes: log in again. Collections cached before then lack `copyright`; the first refresh fetches them all again once.
2. **Replace the test fixtures** in `tests/fixtures/` with a real collection page and `/albums` batch, personal data stripped.
3. **Check Play on the phone.**
