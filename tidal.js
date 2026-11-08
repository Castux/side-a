// Tidal login (OAuth 2 + PKCE, no client secret) and the API calls Side A needs.
// Endpoints from Tidal's OpenAPI spec (@tidal-music/api 0.56.0); see docs/HANDOVER.md for what's verified live.

const AUTHORIZE_URL = 'https://login.tidal.com/authorize';
const TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
const API = 'https://openapi.tidal.com/v2';
// Saving albums needs collection.write; the personal mixes need recommendations.read.
const SCOPES = 'collection.read collection.write recommendations.read';
const TOKEN_KEY = 'sideA.token';
const PENDING_KEY = 'sideA.pending';

/* ---------- Pure parsers (tested in tests/tidal.test.js) ---------- */

/** A page of resource ids of one type (collection items, similar albums, mix tracks) and the next cursor. */
export function parseIds(doc, type = 'albums') {
  const data = Array.isArray(doc?.data) ? doc.data : [];
  return {
    ids: data.filter((d) => d.type === type).map((d) => d.id),
    next: doc?.links?.meta?.nextCursor ?? null,
  };
}

/** GET /tracks?filter[id]=…&include=albums → each track's album id, in order. */
export function parseTrackAlbums(doc) {
  const data = Array.isArray(doc?.data) ? doc.data : [];
  return data.filter((t) => t.type === 'tracks')
    .map((t) => [t.relationships?.albums?.data ?? []].flat().find((a) => a?.type === 'albums')?.id)
    .filter(Boolean);
}

/** The smallest artwork file at least `min` px wide, else the largest there is. */
export function pickCover(artwork, min = 320) {
  const files = (artwork?.attributes?.files ?? []).filter((f) => f.href);
  const w = (f) => f.meta?.width ?? 0;
  const big = files.filter((f) => w(f) >= min).sort((a, b) => w(a) - w(b));
  const small = files.filter((f) => w(f) < min).sort((a, b) => w(b) - w(a));
  return (big[0] ?? small[0])?.href ?? null;
}

/** GET /albums?filter[id]=…&include=artists,coverArt → albums in Side A's shape. */
export function parseAlbums(doc) {
  const included = new Map((doc?.included ?? []).map((r) => [`${r.type}:${r.id}`, r]));
  const rel = (r, name) => {
    const d = r.relationships?.[name]?.data;
    return (Array.isArray(d) ? d : d ? [d] : []).map((i) => included.get(`${i.type}:${i.id}`)).filter(Boolean);
  };
  const data = Array.isArray(doc?.data) ? doc.data : doc?.data ? [doc.data] : [];
  return data.filter((r) => r.type === 'albums').map((r) => ({
    id: r.id,
    title: r.attributes?.title || 'Untitled',
    artist: rel(r, 'artists').map((a) => a.attributes?.name).filter(Boolean).join(', ') || 'Unknown artist',
    year: Number(String(r.attributes?.releaseDate ?? '').slice(0, 4)) || 0,
    cover: pickCover(rel(r, 'coverArt')[0]),
    type: r.attributes?.albumType ?? '',
    copyright: r.attributes?.copyright?.text ?? '',
  }));
}

export const albumUrl = (id) => `https://tidal.com/browse/album/${encodeURIComponent(id)}`;

/* ---------- Login ---------- */

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

const readToken = () => { try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch { return null; } };
const saveToken = (json, old) => {
  const t = {
    access: json.access_token,
    refresh: json.refresh_token ?? old?.refresh ?? null,
    expires: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
  return t;
};

export const isLoggedIn = () => !!readToken();
export const logOut = () => localStorage.removeItem(TOKEN_KEY);

export async function beginLogin({ clientId, redirectUri }) {
  const verifier = randomString(32);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const state = randomString(16);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));
  const q = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: SCOPES,
    code_challenge_method: 'S256', code_challenge: challenge, state,
  });
  location.assign(`${AUTHORIZE_URL}?${q}`);
}

async function tokenRequest(clientId, body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, ...body }),
  });
  if (!res.ok) throw new Error(`Tidal login failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** If Tidal just redirected back with ?code=…, swaps it for a token and cleans the URL. */
export async function finishLogin({ clientId, redirectUri }) {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!code && !error) return false;
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null');
  sessionStorage.removeItem(PENDING_KEY);
  history.replaceState(null, '', url.pathname);
  if (error) throw new Error(`Tidal said: ${url.searchParams.get('error_description') || error}`);
  if (!pending || pending.state !== url.searchParams.get('state')) throw new Error('The login didn’t match. Try again.');
  saveToken(await tokenRequest(clientId, {
    grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: pending.verifier,
  }));
  return true;
}

export class AuthError extends Error {}

async function accessToken(clientId) {
  const t = readToken();
  if (!t) throw new AuthError('Not logged in');
  if (t.expires - Date.now() > 60_000) return t.access;
  if (!t.refresh) throw new AuthError('Session expired');
  try {
    return saveToken(await tokenRequest(clientId, { grant_type: 'refresh_token', refresh_token: t.refresh }), t).access;
  } catch {
    logOut();
    throw new AuthError('Session expired');
  }
}

/* ---------- API ---------- */

/** The token lacks a scope (logged in before saving or mixes were added): log in again. */
export class ScopeError extends Error {}

async function request(clientId, method, path, query = {}, body, attempt = 0) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v != null) for (const x of [].concat(v)) q.append(k, x);
  const res = await fetch(`${API}${path}${q.size ? `?${q}` : ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken(clientId)}`,
      Accept: 'application/vnd.api+json',
      ...(body && { 'Content-Type': 'application/vnd.api+json' }),
    },
    body: body && JSON.stringify(body),
  });
  if (res.status === 429 && attempt < 4) {
    await new Promise((r) => setTimeout(r, (Number(res.headers.get('Retry-After')) || 2 ** attempt) * 1000));
    return request(clientId, method, path, query, body, attempt + 1);
  }
  if (res.status === 401) { logOut(); throw new AuthError('Session expired'); }
  if (res.status === 403) throw new ScopeError(`Tidal refused ${path}: log in again to allow it`);
  if (!res.ok) throw new Error(`Tidal API ${res.status} on ${path}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}
const get = (clientId, path, query) => request(clientId, 'GET', path, query);

/** Pages through a list of ids of one type, up to `limit`. */
async function allIds(clientId, path, type, query = {}, limit = Infinity) {
  const ids = [];
  let cursor = null;
  do {
    const page = parseIds(await get(clientId, path, { ...query, 'page[cursor]': cursor }), type);
    ids.push(...page.ids);
    cursor = page.next;
  } while (cursor && ids.length < limit);
  return ids.slice(0, limit);
}

/** Album details in Side A's shape, 20 per request. `onBatch(done)` reports progress. Missing albums are skipped. */
export async function fetchAlbums(clientId, ids, onBatch = () => {}) {
  const out = [];
  for (let i = 0; i < ids.length; i += 20) {
    const doc = await get(clientId, '/albums', {
      'filter[id]': ids.slice(i, i + 20), include: ['artists', 'coverArt'],
    });
    out.push(...parseAlbums(doc));
    onBatch(Math.min(i + 20, ids.length));
  }
  return out;
}

/** Ids of the albums Tidal lists as similar to this one (first page only). */
export async function similarAlbumIds(clientId, id) {
  return parseIds(await get(clientId, `/albums/${encodeURIComponent(id)}/relationships/similarAlbums`, {})).ids;
}

/** The albums these tracks are on, without repeats, in order. */
async function trackAlbumIds(clientId, trackIds) {
  const out = [];
  for (let i = 0; i < trackIds.length; i += 20) {
    out.push(...parseTrackAlbums(await get(clientId, '/tracks', { 'filter[id]': trackIds.slice(i, i + 20), include: 'albums' })));
  }
  return [...new Set(out)];
}

/** Albums of the most recently liked tracks. */
export async function likedTrackAlbumIds(clientId, limit = 200) {
  return trackAlbumIds(clientId, await allIds(clientId, '/userCollectionTracks/me/relationships/items', 'tracks', { sort: '-addedAt' }, limit));
}

/** Albums of the tracks in one of the user's Tidal mixes: userDailyMixes, userDiscoveryMixes or userNewReleaseMixes. */
export async function mixAlbumIds(clientId, mix) {
  return trackAlbumIds(clientId, parseIds(await get(clientId, `/${mix}/me/relationships/items`, {}), 'tracks').ids);
}

/** Adds an album to the user's Tidal collection, or removes it with `save = false`. */
export async function saveAlbum(clientId, id, save = true) {
  await request(clientId, save ? 'POST' : 'DELETE', '/userCollectionAlbums/me/relationships/items', {}, { data: [{ id, type: 'albums' }] });
}

/**
 * Fetches the collection's album ids, then details only for ids not in `known`.
 * Returns the full list in collection order (newest first). `onProgress(text)` reports how far it got.
 */
export async function syncCollection(clientId, known, onProgress = () => {}) {
  const ids = await allIds(clientId, '/userCollectionAlbums/me/relationships/items', 'albums', { sort: '-addedAt' });
  onProgress(`Found ${ids.length} albums…`);

  // Albums cached before `copyright` was kept are fetched again once (the kids filter reads it).
  const byId = new Map(known.filter((a) => 'copyright' in a).map((a) => [a.id, a]));
  const missing = ids.filter((id) => !byId.has(id));
  const have = ids.length - missing.length;
  const fetched = await fetchAlbums(clientId, missing, (done) => onProgress(`Loaded ${have + done} of ${ids.length} albums…`));
  for (const a of fetched) byId.set(a.id, a);
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
