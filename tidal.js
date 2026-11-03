// Tidal login (OAuth 2 + PKCE, no client secret) and the two API calls Side A needs.
// Endpoints from Tidal's OpenAPI spec (@tidal-music/api 0.56.0); see docs/HANDOVER.md for what's verified live.

const AUTHORIZE_URL = 'https://login.tidal.com/authorize';
const TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
const API = 'https://openapi.tidal.com/v2';
const SCOPES = 'collection.read';
const TOKEN_KEY = 'sideA.token';
const PENDING_KEY = 'sideA.pending';

/* ---------- Pure parsers (tested in tests/tidal.test.js) ---------- */

/** GET /userCollectionAlbums/me/relationships/items → album ids and the cursor for the next page. */
export function parseCollectionPage(doc) {
  const data = Array.isArray(doc?.data) ? doc.data : [];
  return {
    ids: data.filter((d) => d.type === 'albums').map((d) => d.id),
    next: doc?.links?.meta?.nextCursor ?? null,
  };
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

async function get(clientId, path, query, attempt = 0) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v != null) for (const x of [].concat(v)) q.append(k, x);
  const res = await fetch(`${API}${path}?${q}`, {
    headers: { Authorization: `Bearer ${await accessToken(clientId)}`, Accept: 'application/vnd.api+json' },
  });
  if (res.status === 429 && attempt < 4) {
    await new Promise((r) => setTimeout(r, (Number(res.headers.get('Retry-After')) || 2 ** attempt) * 1000));
    return get(clientId, path, query, attempt + 1);
  }
  if (res.status === 401) { logOut(); throw new AuthError('Session expired'); }
  if (!res.ok) throw new Error(`Tidal API ${res.status} on ${path}`);
  return res.json();
}

/**
 * Fetches the collection's album ids, then details only for ids not in `known`.
 * Returns the full list in collection order (newest first). `onProgress(text)` reports how far it got.
 */
export async function syncCollection(clientId, known, onProgress = () => {}) {
  const ids = [];
  let cursor = null;
  do {
    const page = parseCollectionPage(await get(clientId, '/userCollectionAlbums/me/relationships/items', {
      sort: '-addedAt', 'page[cursor]': cursor,
    }));
    ids.push(...page.ids);
    cursor = page.next;
    onProgress(`Found ${ids.length} albums…`);
  } while (cursor);

  const byId = new Map(known.map((a) => [a.id, a]));
  const missing = ids.filter((id) => !byId.has(id));
  for (let i = 0; i < missing.length; i += 20) {
    const doc = await get(clientId, '/albums', {
      'filter[id]': missing.slice(i, i + 20), include: ['artists', 'coverArt'],
    });
    for (const a of parseAlbums(doc)) byId.set(a.id, a);
    onProgress(`Loaded ${ids.length - missing.length + Math.min(i + 20, missing.length)} of ${ids.length} albums…`);
  }
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
