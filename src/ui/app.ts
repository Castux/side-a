/** Shared UI state and small helpers. Views read and mutate `app`, then re-render. */
import { generatedCover } from '../covers/cover';
import type { Album, AppState, LibraryAdapter } from '../core/types';
import { makeContext, type Context, type Session } from '../recommender/recommender';
import type { StateStore } from '../store/store';

export const app = {
  lib: null as unknown as LibraryAdapter,
  store: null as unknown as StateStore,
  state: null as unknown as AppState,
  albums: [] as Album[],
  byId: new Map<string, Album>(),
  session: null as Session | null,
  library: { q: '', genre: 'All', sort: 'added' as 'added' | 'artist' | 'year' | 'rest' },
  clearArmed: false,
};

export const ctx = (): Context => makeContext(app.albums, app.state.plays, app.state.settings);
export const save = () => app.store.save(app.state);
export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;

export const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function coverHtml(a: Album): string {
  return a.coverUrl
    ? `<img src="${esc(a.coverUrl)}" alt="${esc(a.title)} cover" loading="lazy" decoding="async">`
    : generatedCover(a);
}

export type PlaySource = 'morning' | 'library' | 'sheet';

export function playLinkHtml(a: Album, source: PlaySource): string {
  const big = source === 'sheet';
  return `<a class="play${big ? ' big' : ''}" href="${esc(app.lib.playLink(a))}" target="_blank" rel="noopener" data-play="${esc(a.id)}" data-source="${source}">Play${big ? ' in Tidal' : ''}</a>`;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string): void {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

export function greet(d = new Date()): string {
  const h = d.getHours();
  return h < 5 ? 'Up early' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
