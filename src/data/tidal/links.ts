// Web links open the Tidal web player, or the app if the OS hands the link over.
// `tidal://album/<id>` is the app's own scheme on mobile; untested here, so it isn't the default.
export const tidalAlbumUrl = (id: string) => `https://tidal.com/browse/album/${encodeURIComponent(id)}`;
export const tidalAppUrl = (id: string) => `tidal://album/${encodeURIComponent(id)}`;
export const tidalSearchUrl = (q: string) => `https://listen.tidal.com/search?q=${encodeURIComponent(q)}`;
