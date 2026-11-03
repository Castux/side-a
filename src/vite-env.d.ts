/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_LIBRARY?: 'mock' | 'tidal';
  readonly VITE_TIDAL_CLIENT_ID?: string;
  readonly VITE_TIDAL_REDIRECT_URI?: string;
  readonly VITE_TIDAL_COUNTRY?: string;
}
