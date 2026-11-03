# Side A: handover

Read this before changing code. Live at <https://castux.github.io/side-a/>; every push to `main` deploys (GitHub Pages, repo root).

An earlier, much bigger build (Vite, TypeScript, mood model, several pages) was replaced by this one at the owner’s request. It’s in git history at `e47e2b6`.

## Rules

- Keep it small: plain HTML, CSS and ES modules, no build step, no dependencies. Ask the owner before adding a framework, bundler or package.
- Ask before changing the flow or the visual design (`docs/design.md`).
- `pick.js` and the parsers in `tidal.js` are pure; change them with a test in `tests/`.
- UI copy: sentence case, plain verbs, typographic apostrophes (’).
- When Tidal doesn’t behave as described here, fix this file.

## The product

One screen: a greeting, the date and six random albums from the owner’s Tidal collection.

- **Play** on a card opens the album in Tidal.
- Tapping sleeves picks them. **More like these** keeps the picked sleeves in place and refills the other slots, with other albums by the same artists where there are any. With nothing picked, **Six more** deals six random ones.
- Albums shown today don’t come back until tomorrow. When the whole collection has been seen, the picker starts over and a one-line notice says so.

## Code

| File | What |
|---|---|
| `pick.js` | `pick()` chooses n albums; `deal()` keeps picked ones in place and refills the rest. Pure. |
| `tidal.js` | PKCE login (no secret), token refresh, `syncCollection()`, response parsers. |
| `app.js` | Boot, rendering, local storage, when to refresh. |
| `config.js` | Tidal client id (public by design with PKCE). Redirect URI is the page’s own URL. |
| `demo.js` | 84 albums from the owner’s collection for `?demo` (real ids and covers), four or five each by 19 artists so “more like these” works. |

**“Like these”** means same artist, nothing more: up to n − 1 new slots go to other albums by the picked artists, and at least one stays random. Genres and Tidal’s similar albums were tried and dropped (see below).

**Fast start:** with a cached collection, boot renders straight away with no API call. The collection refreshes in the background at most hourly, and only after the first tap on a sleeve, Play or the button; cards on screen don’t change when it lands. Only the first visit waits for a full load. A refresh pages through the collection ids and fetches details only for new ones, 20 per request.

**Local storage** (`sideA.` prefix, `sideA.demo.` in demo mode): `token` `{access, refresh, expires}`; `albums` `[{id, title, artist, year, cover}]` with cover as a ~320px image URL; `syncedAt`; `seen` `{day, ids}`. About 200 bytes per album.

## Tidal API

Base `https://openapi.tidal.com/v2`, JSON:API (`Accept: application/vnd.api+json`), paging via `links.meta.nextCursor` → `page[cursor]`. Login: `https://login.tidal.com/authorize`, token `https://auth.tidal.com/v1/oauth2/token`, scope `collection.read`. Reference: <https://tidal-music.github.io/tidal-api-reference/>.

| Purpose | Request |
|---|---|
| Collection ids | `GET /userCollectionAlbums/me/relationships/items?sort=-addedAt` |
| Album details | `GET /albums?filter[id]=…&include=artists&include=coverArt` (max 20 ids) |

No scope beyond `collection.read` is needed; per the spec, album endpoints accept any user token. 429s are retried using `Retry-After`. A 401 logs out.

**Confirmed live (3 Nov 2026):** login, token exchange and both calls work straight from the browser (no CORS proxy), with `me` as the collection id. Album genres come back empty, so they aren’t fetched. Tidal’s `similarAlbums` would mostly point outside the collection, so it isn’t used either.

**Not yet checked:**

- Whether `tidal.com/browse/album/{id}` opens the Tidal app on the phone. If not, try `tidal://album/{id}`.
- Albums `/albums` doesn’t return (region-locked, removed) are requested again on every refresh. Harmless; cache the misses if it’s common.

## Next

1. **Replace the test fixtures** in `tests/fixtures/` with a real collection page and `/albums` batch, personal data stripped.
2. **Check Play on the phone.**
