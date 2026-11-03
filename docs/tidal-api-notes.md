# Tidal API notes

Source: the OpenAPI document in the npm package `@tidal-music/api` (read at 0.56.0, spec version 1.10.218), at `bin/tidal-api-oas.json` inside the package. Human-readable reference: <https://tidal-music.github.io/tidal-api-reference/>. These notes come from the spec, not from live calls.

## Basics

- Base URL `https://openapi.tidal.com/v2`, JSON:API (`Accept: application/vnd.api+json`).
- Related resources come back in `included` when requested with `include`.
- Paging: `links.meta.nextCursor`, passed back as `page[cursor]`.
- Array query params repeat the key (`include=artists&include=genres`).

## Auth

OAuth 2 Authorization Code with PKCE, public client (no secret).

- Authorize: `https://login.tidal.com/authorize`
- Token: `https://auth.tidal.com/v1/oauth2/token`
- Docs: <https://developer.tidal.com/documentation/api-sdk/api-sdk-authorization>

Side A requests only `collection.read`.

## Endpoints Side A uses

| Purpose | Request | Notes |
|---|---|---|
| Saved albums | `GET /userCollectionAlbums/me/relationships/items?sort=-addedAt` | Scope `collection.read`. Also takes `include=items`, `filter[query]`. |
| Album details | `GET /albums?filter[id]=…&include=artists&include=genres&include=coverArt` | Max 20 ids. `countryCode` optional. |

Possibly useful later: `GET /albums/{id}/relationships/similarAlbums` (Tidal’s own neighbours). Artwork resources have `files[]` with `href` and `meta.width/height`, plus `visualMetadata` with a palette colour that could tint placeholders.

## Open questions

- CORS from a browser on another origin (see the handover).
- How often album genres are populated.
- Rate limits. The client retries 429s using `Retry-After`.
