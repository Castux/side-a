// Your Tidal app from https://developer.tidal.com.
// The client id is public by design with PKCE; never put the client secret here.
export const TIDAL_CLIENT_ID = 'mfU3sMM5msPlfusq';

// Must match a redirect URI registered on that app exactly,
// e.g. http://localhost:8000/ or https://you.github.io/side-a/
export const REDIRECT_URI = location.origin + location.pathname;

// Must all be enabled on that app, or Tidal's login page fails (error 1002).
// collection.write lets the heart save albums. Add recommendations.read once it's enabled
// on the app, and "new to you" also draws from her daily, discovery and new-release mixes.
export const TIDAL_SCOPES = 'collection.read collection.write';
