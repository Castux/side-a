import './styles.css';
import type { LibraryAdapter } from './core/types';
import { MockLibrary } from './data/mockLibrary';
import { beginLogin, completeLoginFromUrl, validAccessToken, type TidalAuthConfig } from './data/tidal/auth';
import { TidalClient } from './data/tidal/client';
import { createTidalLibrary } from './data/tidal/tidalLibrary';
import type { FeatureCache } from './enrich/signals';
import { advance, newSession, toggle } from './recommender/recommender';
import { LocalStore } from './store/store';
import { $, app, ctx, save, toast } from './ui/app';
import { renderMorning } from './ui/morning';
import { closeDetail, openDetail, renderConnect, renderHistory, renderHow, renderLibrary, shrinkLabel, updateGrid } from './ui/views';

const env = import.meta.env;
const tidalCfg: TidalAuthConfig = {
  clientId: env.VITE_TIDAL_CLIENT_ID ?? '',
  redirectUri: env.VITE_TIDAL_REDIRECT_URI ?? location.origin + '/',
};

/* ---------- Routing ---------- */

const VIEWS = { morning: renderMorning, library: renderLibrary, history: renderHistory, how: renderHow } as const;
type ViewName = keyof typeof VIEWS;

function route(): void {
  const h = location.hash.slice(1);
  const name: ViewName = h in VIEWS ? (h as ViewName) : 'morning';
  document.querySelectorAll('.nav a').forEach((a) => {
    if (a.getAttribute('href') === '#' + name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  VIEWS[name]();
}

/* ---------- Plays ---------- */

function logPlay(id: string, source: 'morning' | 'library'): void {
  const s = app.session;
  const fromMorning = source === 'morning' && !!s;
  app.state.plays.unshift({ id, at: Date.now(), source: fromMorning ? 'morning' : 'library', round: fromMorning ? s!.round : null });
  if (fromMorning) app.state.sessions.unshift({ at: s!.startedAt, rounds: s!.round, kept: s!.liked.length + s!.selected.size, played: id });
  save();
  toast(`Opened ${app.byId.get(id)?.title ?? 'album'} in Tidal`);
  if (fromMorning) {
    app.session = null;
    setTimeout(route, 400);
  }
}

/* ---------- Events (delegated) ---------- */

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const play = target.closest<HTMLElement>('[data-play]');
  if (play) {
    closeDetail();
    logPlay(play.dataset.play!, play.dataset.source === 'morning' ? 'morning' : 'library');
    return; // the link itself opens Tidal
  }
  if (target === $('#scrim')) return closeDetail();
  const el = target.closest<HTMLElement>('[data-action]');
  if (!el) return;
  const id = el.dataset.id ?? '';
  switch (el.dataset.action) {
    case 'toggle':
      toggle(app.session!, id);
      renderMorning();
      document.querySelector<HTMLElement>(`[data-action="toggle"][data-id="${CSS.escape(id)}"]`)?.focus();
      break;
    case 'next':
      advance(ctx(), app.session!);
      renderMorning();
      document.querySelector('.table')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
      break;
    case 'restart':
      app.session = newSession(ctx());
      renderMorning();
      scrollTo(0, 0);
      break;
    case 'detail':
      openDetail(id);
      break;
    case 'close':
      closeDetail();
      break;
    case 'seed':
      closeDetail();
      app.session = newSession(ctx(), { seed: app.byId.get(id) });
      if (location.hash === '#morning') renderMorning();
      else location.hash = 'morning';
      scrollTo(0, 0);
      break;
    case 'genre':
      app.library.genre = el.dataset.genre ?? 'All';
      document.querySelectorAll<HTMLElement>('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.genre === app.library.genre)));
      updateGrid();
      break;
    case 'clear':
      if (!app.clearArmed) {
        app.clearArmed = true;
        renderHistory();
        setTimeout(() => { app.clearArmed = false; if (location.hash === '#history') renderHistory(); }, 4000);
      } else {
        app.state.plays = [];
        app.state.sessions = [];
        app.clearArmed = false;
        save();
        renderHistory();
        toast('History cleared');
      }
      break;
  }
});

document.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.input === 'q') { app.library.q = t.value; updateGrid(); }
  if (t.dataset.input === 'sort') { app.library.sort = t.value as typeof app.library.sort; updateGrid(); }
  const k = t.dataset.setting as keyof typeof app.state.settings | undefined;
  if (k) {
    const st = app.state.settings as unknown as Record<string, number | boolean>;
    st[k] = t.type === 'checkbox' ? t.checked : Number(t.value);
    if (k === 'avoidDays') $('#v-avoidDays').textContent = `${app.state.settings.avoidDays} days`;
    if (k === 'shrink') $('#v-shrink').textContent = shrinkLabel(app.state.settings.shrink);
    save();
  }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#scrim').hidden) closeDetail(); });
addEventListener('hashchange', () => { route(); scrollTo(0, 0); });

/* ---------- Boot ---------- */

async function loadFeatures(): Promise<FeatureCache> {
  try {
    const res = await fetch('/features.json', { cache: 'no-cache' });
    return res.ok ? ((await res.json()) as FeatureCache) : {};
  } catch {
    return {};
  }
}

async function chooseLibrary(): Promise<LibraryAdapter | null> {
  if (env.VITE_LIBRARY !== 'tidal') return MockLibrary;
  if (!tidalCfg.clientId) {
    renderConnect(() => {}, 'VITE_TIDAL_CLIENT_ID is not set. Add it to .env.local (see .env.example) and restart the dev server.');
    return null;
  }
  try {
    await completeLoginFromUrl(tidalCfg);
  } catch (err) {
    renderConnect(() => beginLogin(tidalCfg), (err as Error).message);
    return null;
  }
  if (!(await validAccessToken(tidalCfg))) {
    renderConnect(() => beginLogin(tidalCfg));
    return null;
  }
  const client = new TidalClient({
    countryCode: env.VITE_TIDAL_COUNTRY ?? 'US',
    getToken: async () => (await validAccessToken(tidalCfg)) ?? Promise.reject(new Error('Tidal session expired. Log in again.')),
  });
  return createTidalLibrary(client, await loadFeatures());
}

async function boot(): Promise<void> {
  app.store = new LocalStore();
  app.state = app.store.load();
  const lib = await chooseLibrary();
  if (!lib) return;
  app.lib = lib;
  try {
    app.albums = await lib.listAlbums();
  } catch (err) {
    renderConnect(() => beginLogin(tidalCfg), `Couldn’t load your collection: ${(err as Error).message}`);
    return;
  }
  app.byId = new Map(app.albums.map((a) => [a.id, a]));
  route();
}

boot();
