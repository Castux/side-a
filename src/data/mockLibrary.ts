import type { LibraryAdapter } from '../core/types';
import { sampleAlbums } from './sampleAlbums';
import { tidalAlbumUrl, tidalSearchUrl } from './tidal/links';

export const MockLibrary: LibraryAdapter = {
  name: 'Sample collection',
  async listAlbums() {
    return sampleAlbums();
  },
  // Sample albums have no Tidal ids, so Play opens a Tidal search instead.
  playLink: (a) => (a.tidalId ? tidalAlbumUrl(a.tidalId) : tidalSearchUrl(a.artist + ' ' + a.title)),
};
