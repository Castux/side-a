/**
 * OAuth 2.0 Authorization Code + PKCE for Tidal.
 * URLs and scope names come from the securitySchemes block of Tidal's OpenAPI spec.
 * The token request body follows the OAuth/PKCE standard (RFC 7636); confirm against
 * https://developer.tidal.com/documentation/api-sdk/api-sdk-authorization before relying on it.
 */
export const AUTHORIZE_URL = 'https://login.tidal.com/authorize';
export const TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
/** collection.read is enough to list saved albums. Third-party tier per the spec. */
export const SCOPES = ['collection.read'];

export interface TidalAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  fetch?: typeof fetch;
}

export interface Token {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

export function base64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function authorizeUrl(cfg: TidalAuthConfig, challenge: string, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: (cfg.scopes ?? SCOPES).join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });
  return `${AUTHORIZE_URL}?${p}`;
}

export function parseTokenResponse(json: Record<string, unknown>, now = Date.now()): Token {
  if (typeof json.access_token !== 'string') throw new Error('Token response has no access_token');
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    expiresAt: now + (Number(json.expires_in) || 3600) * 1000,
  };
}

async function tokenRequest(cfg: TidalAuthConfig, body: Record<string, string>): Promise<Token> {
  const res = await (cfg.fetch ?? fetch)(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, ...body }),
  });
  if (!res.ok) throw new Error(`Tidal token request failed: ${res.status} ${await res.text()}`);
  return parseTokenResponse((await res.json()) as Record<string, unknown>);
}

export const exchangeCode = (cfg: TidalAuthConfig, code: string, verifier: string) =>
  tokenRequest(cfg, { grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri, code_verifier: verifier });

export const refreshAccessToken = (cfg: TidalAuthConfig, refreshToken: string) =>
  tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: refreshToken });

/* ---------- Browser glue ---------- */

const TOKEN_KEY = 'side-a:tidal-token';
const PENDING_KEY = 'side-a:tidal-pending';

export const tokenStore = {
  get(): Token | null {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as Token | null; } catch { return null; }
  },
  set(t: Token) { try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch { /* ignore */ } },
  clear() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

/** Redirects to Tidal's login page. */
export async function beginLogin(cfg: TidalAuthConfig): Promise<void> {
  const { verifier, challenge } = await createPkcePair();
  const state = base64Url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));
  location.assign(authorizeUrl(cfg, challenge, state));
}

/** Call on boot. If the URL carries ?code=…&state=…, finishes the login and cleans the URL. */
export async function completeLoginFromUrl(cfg: TidalAuthConfig): Promise<Token | null> {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) return null;
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as { verifier: string; state: string } | null;
  sessionStorage.removeItem(PENDING_KEY);
  history.replaceState(null, '', url.pathname + url.hash);
  if (!pending || pending.state !== state) throw new Error('Tidal login state did not match. Start the login again.');
  const token = await exchangeCode(cfg, code, pending.verifier);
  tokenStore.set(token);
  return token;
}

/** Returns a usable access token, refreshing it when it's within a minute of expiring. */
export async function validAccessToken(cfg: TidalAuthConfig): Promise<string | null> {
  const t = tokenStore.get();
  if (!t) return null;
  if (t.expiresAt - Date.now() > 60_000) return t.accessToken;
  if (!t.refreshToken) return null;
  try {
    const fresh = await refreshAccessToken(cfg, t.refreshToken);
    tokenStore.set({ ...fresh, refreshToken: fresh.refreshToken ?? t.refreshToken });
    return fresh.accessToken;
  } catch {
    tokenStore.clear();
    return null;
  }
}
