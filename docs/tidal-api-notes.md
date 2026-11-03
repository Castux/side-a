# Tidal API notes

Source: the OpenAPI document shipped in the npm package `@tidal-music/api` (read at version 0.55.0, published 29 Oct 2026; the repo pins 0.53.0). After `npm install` it’s at `node_modules/@tidal-music/api/bin/tidal-api-oas.json`. API title “TIDAL API”, spec version 1.10.217, 322 paths. Human-readable reference: <https://tidal-music.github.io/tidal-api-reference/>.

These notes come from reading the spec, not from live calls.

## Basics

- Base URL `https://openapi.tidal.com/v2`, JSON:API (`application/vnd.api+json`).
- Related resources come back in `included` when requested with `include`.
- Paging: `links.next` and `links.meta.nextCursor`; pass it back as `page[cursor]`.
- Array query params: OpenAPI default form/explode, i.e. repeat the key (`include=artists&include=genres`).
- Most catalogue endpoints take `countryCode` (ISO 3166-1 alpha-2).

## Auth

OAuth 2 Authorization Code with PKCE.

- Authorize: `https://login.tidal.com/authorize`
- Token: `https://auth.tidal.com/v1/oauth2/token`
- Docs: <https://developer.tidal.com/documentation/api-sdk/api-sdk-authorization>

Scopes available to third-party apps include `collection.read`, `collection.write`, `playlists.read`, `playlists.write`, `playback`, `recommendations.read`, `search.read`, `user.read` and `entitlements.read`. `r_usr` and `w_usr` are internal only. Side A needs only `collection.read`. Catalogue endpoints also accept client-credentials tokens.

## Endpoints Side A uses

| Purpose | Request | Notes |
|---|---|---|
| Saved albums | `GET /userCollectionAlbums/me/relationships/items` | `sort` one of `addedAt`, `-addedAt` (default), `artists.name`, `-artists.name`, `releaseDate`, `-releaseDate`, `title`, `-title`. Each item has `meta.addedAt`. |
| Album details | `GET /albums?filter[id]=…&include=artists&include=genres&include=coverArt` | Max 20 ids per request. |
| Album tracks | `GET /albums/{id}/relationships/items?include=items` | Items are tracks or videos; `meta.trackNumber`, `meta.volumeNumber`. |
| Similar albums | `GET /albums/{id}/relationships/similarAlbums` | Tidal’s own neighbours; not used yet. |
| Genres | `GET /albums/{id}/relationships/genres`, `GET /genres` | Genre resource: `genreName`. |

## Fields that matter for mood

Album: `title`, `releaseDate`, `barcodeId` (UPC, for MusicBrainz lookups), `popularity` (0–1), `albumType`, `numberOfItems`, `duration`.

Track: `bpm`, `key` (C, CSharp, D, Eb … B, or UNKNOWN), `keyScale` (MAJOR, MINOR, AEOLIAN, BLUES, DORIAN, HARMONIC_MINOR, LOCRIAN, LYDIAN, MIXOLYDIAN, PENTATONIC_MAJOR, PHRYGIAN, MELODIC_MINOR, PENTATONIC_MINOR, or UNKNOWN), `toneTags` (array of strings; the spec’s only example is “Happy” and gives no list), `isrc`, `popularity`.

Artwork: `files[]` with `href` and `meta.width/height`; `visualMetadata.selectedPaletteColor` and `blurHash` could be used for placeholders.

## Open questions

- How often are `bpm`, `keyScale` and `toneTags` populated, and what values do tone tags take?
- Does the browser get CORS access to `openapi.tidal.com`?
- Rate limits: the client retries on 429 using `Retry-After`; real limits unknown.
