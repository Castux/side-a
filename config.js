// Your Tidal app from https://developer.tidal.com (scope: collection.read).
// The client id is public by design with PKCE; never put the client secret here.
export const TIDAL_CLIENT_ID = '';

// Must match a redirect URI registered on that app exactly,
// e.g. http://localhost:8000/ or https://you.github.io/side-a/
export const REDIRECT_URI = location.origin + location.pathname;
