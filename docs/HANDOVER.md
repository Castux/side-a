# Side A: handover

For the AI assistant picking up this repo. Read this before changing code.

Updated 3 November 2026. The first build (Vite + TypeScript, four-axis mood model, enrichment pipeline, library/history/how pages) was replaced at the owner’s request with something much smaller. It’s all in git history (commit `e47e2b6`) if a piece is ever wanted back.

## 1. The product

The owner listens to whole albums from their Tidal collection. Each morning Side A shows **six random albums**. They can:

- press **Play** on any card to open it in Tidal, or
- tap the sleeves that suit their mood and press **Six more like these**, or tap nothing and press **Six more** for another random six.

Albums shown today aren’t shown again until tomorrow. That’s the only memory. When every album has been seen today, the picker starts over and says so.

What the owner asked for: runs entirely in the browser, hostable on GitHub Pages or their own site, keep it simple, minimal interface, fast start.

## 2. How it works

Plain ES modules, no build, no dependencies. `npm run dev` is just `python3 -m http.server 8000`.

- **`pick.js`** (pure): `pick(pool, { n, seen, liked, rng })`. With no liked albums the pick is uniformly random. With some, up to five slots go to albums like them, weighted by `likeness()` (same artist 3, each shared Tidal genre 2, release year within 3 years 1, within 8 years 0.5). At least one slot stays random. The six are shuffled.
- **`tidal.js`**: PKCE login with no client secret, token refresh, and `syncCollection()`, which pages through the collection ids and then fetches details only for ids it doesn’t already have, 20 per request.
- **`app.js`**: boot, rendering, local storage.

**Fast start:** if a collection is cached, boot renders six albums straight away with no network call apart from cover images. The collection refreshes in the background, at most once an hour, and only after the first tap on a sleeve, Play or Six more. The cards on screen don’t change when the refresh lands. Only the first visit waits for a full load, and it shows progress.

**Local storage keys** (`sideA.` prefix; demo mode uses `sideA.demo.`):

| Key | Holds |
|---|---|
| `token` | `{access, refresh, expires}` |
| `albums` | `[{id, title, artist, year, genres, cover}]`. Cover is the image URL (about 320px), not the image; the browser’s HTTP cache handles the pictures. |
| `syncedAt` | ms timestamp of the last refresh |
| `seen` | `{day: "YYYY-MM-DD", ids: [...]}` |

At about 250 bytes per album, a collection of a few thousand albums fits easily in the usual 5 MB.

`?demo` loads 66 sample albums from `demo.js`, and its Play links go to a Tidal search.

## 3. Verified vs. assumed

**Verified against Tidal’s OpenAPI spec** (`@tidal-music/api` 0.56.0, spec 1.10.218, checked 3 Nov 2026):

- `GET /userCollectionAlbums/{id}/relationships/items` exists, needs `collection.read`, takes `sort` (`-addedAt` default) and `page[cursor]`.
- `GET /albums` takes up to 20 `filter[id]` values and `include` of `artists`, `genres` and `coverArt`. `countryCode` is optional, so the app doesn’t send it.
- The authorize and token URLs: `https://login.tidal.com/authorize` and `https://auth.tidal.com/v1/oauth2/token`.

**Verified in headless Chrome against mocked Tidal responses:** the login redirect and code exchange, a first load across three collection pages, a zero-request reload from cache, an incremental refresh that fetched only two new albums, log out, and demo mode at phone and desktop widths.

**Assumed, needs a live check:**

- That `me` works as the collection id with a PKCE token.
- That the browser can call `auth.tidal.com` and `openapi.tidal.com` directly (CORS). Tidal’s own browser SDK does this, so it’s likely. If not, a proxy would be needed, which would break the static-only goal, so ask the owner first.
- The token request body: standard PKCE fields, no secret.
- That album `genres` are actually populated. If they’re empty, “more like these” falls back to artist and era only.
- That `tidal.com/browse/album/{id}` opens the Tidal app on the owner’s phone. If it doesn’t, try `tidal://album/{id}`.
- Albums that `/albums` doesn’t return (region-locked, removed) are requested again on every refresh. That’s harmless, but cache the misses if it turns out to be common.

## 4. Next tasks

1. **Prove the login.** Register an app at developer.tidal.com with redirect URI `http://localhost:8000/`, put the client id in `config.js`, run `npm run dev` and log in. Fix `tidal.js` against what really happens. Done when six real albums with real covers show up.
2. **Capture real fixtures.** Save one collection page and one `/albums` batch, strip personal data, replace `tests/fixtures/`, and run `npm test`.
3. **Check Play on the phone** (see above).
4. **Host it.** Add the hosted URL as a second redirect URI on the Tidal app.
5. **Optional, only if random isn’t enough:** Tidal’s `GET /albums/{id}/relationships/similarAlbums`, intersected with the collection, as an extra `likeness` signal.

## 5. Working with the owner

- Keep it simple: no framework, bundler or dependency without asking.
- Ask before changing the flow or the visual design (`docs/design.md`).
- Copy: sentence case, plain verbs, typographic apostrophes (’) in UI text.
- When something external doesn’t match these notes, say which assumption was wrong and fix this file.
