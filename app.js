import { REDIRECT_URI, TIDAL_CLIENT_ID, TIDAL_SCOPES } from './config.js';
import { dayKey, deal as nextDeal } from './pick.js';
import { recommend } from './recommend.js';
import { judge, lessons } from './taste.js';
import {
  albumUrl, AuthError, beginLogin, fetchAlbums, finishLogin, isLoggedIn, likedTrackAlbumIds, logOut, mixAlbumIds,
  saveAlbum, ScopeError, similarAlbumIds, syncCollection,
} from './tidal.js';

const N = 6;
const RESYNC_MS = 60 * 60 * 1000; // refresh the collection at most hourly, and only after you've used the page
const demo = new URLSearchParams(location.search).has('demo');
const KEY = demo ? 'sideA.demo.' : 'sideA.';
const tidal = { clientId: TIDAL_CLIENT_ID, redirectUri: REDIRECT_URI, scopes: TIDAL_SCOPES };
const mixes = TIDAL_SCOPES.split(' ').includes('recommendations.read');

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(KEY + k)) ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* full or blocked */ } };
const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

// Two modes on one page: "mine" deals from the collection; "new" (#new) finds albums to add to it.
const views = {
  mine: { shown: [], picked: new Set(), note: '', seenKey: 'seen' },
  new: { shown: [], picked: new Set(), note: '', seenKey: 'seenNew', login: false },
};
const modeFromHash = () => (!demo && location.hash === '#new' ? 'new' : 'mine');
let mode = modeFromHash();
let view = views[mode];
document.documentElement.dataset.mode = mode;

let albums = [];
let ready = false; // the collection is loaded
let status = '';
let busy = false; // a recommendation request is in flight
let verdicts = load('verdicts', {}); // what she told Side A, see taste.js
let menuFor = null; // album id whose "not for me / kids" choice is open

/* ---------- Seen today ---------- */

function seenToday(key) {
  const s = load(key, null);
  return s?.day === dayKey() ? s.ids : [];
}
function markSeen(key, ids, reset = false) {
  store(key, { day: dayKey(), ids: reset ? ids : [...seenToday(key), ...ids] });
}

/* ---------- Rendering ---------- */

const ICONS = {
  new: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 2.5l1.9 6.1 6.1 1.9-6.1 1.9L11 18.5l-1.9-6.1L3 10.5l6.1-1.9z"/><path d="M18.5 14.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/></svg>',
  mine: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="var(--paper)" stroke-width=".8" opacity=".5"/><circle cx="12" cy="12" r="3.2" fill="var(--sun)"/><circle cx="12" cy="12" r="1"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z"/></svg>',
};

function greet(h = new Date().getHours()) {
  return h < 5 ? 'Up early' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function cover(a) {
  return a.cover
    ? `<img src="${esc(a.cover)}" alt="" decoding="async">`
    : `<span class="ph" style="--h:${hash(a.id) % 360}">${esc(a.title)}</span>`;
}

const OUT = { no: 'Not for me', kids: 'Kids’ music' };

function card(a) {
  const tilt = ((hash(a.id) / 2 ** 32 - 0.5) * 6).toFixed(1);
  const on = view.picked.has(a.id);
  const isNew = mode === 'new';
  const v = isNew ? verdicts[a.id]?.v : null;
  const out = v in OUT;
  const saved = v === 'love';
  const id = esc(a.id);
  const why = out
    ? `${OUT[v]} · <button class="link" data-action="undo">Undo</button>`
    : saved ? 'Saved to your collection' : esc(a.why ?? '');
  return `<li class="sleeve${on ? ' is-picked' : ''}${out ? ' is-out' : ''}" style="--tilt:${tilt}deg" data-id="${id}">
    <button class="sleeve-art" data-action="toggle" aria-pressed="${on}" aria-label="${esc(a.title)} by ${esc(a.artist)}: more like this"${out ? ' disabled' : ''}>${cover(a)}<span class="check" aria-hidden="true">✓</span></button>
    ${isNew && !out ? `<button class="nope" data-action="nope" aria-label="Not for me?" aria-expanded="${menuFor === a.id}">✕</button>` : ''}
    ${isNew && menuFor === a.id ? `<div class="judge">
      <button data-action="no">Not for me</button>
      <button data-action="kids">Kids’ music</button>
      <button class="link" data-action="nope">Cancel</button>
    </div>` : ''}
    <div class="acts">
      <a class="play" href="${esc(albumUrl(a.id))}" target="_blank" rel="noopener">Play</a>
      ${isNew && !out ? `<button class="save" data-action="save" aria-pressed="${saved}" aria-label="${saved ? 'Saved; tap to remove from' : 'Save to'} your Tidal collection">${ICONS.heart}</button>` : ''}
    </div>
    <div class="sleeve-meta"><p class="t">${esc(a.title)}</p><p class="a">${esc(a.artist)}${a.year ? ', ' + a.year : ''}</p>${why ? `<p class="why">${why}</p>` : ''}</div>
  </li>`;
}

function toggle() {
  if (demo) return '';
  const to = mode === 'mine' ? 'new' : 'mine';
  const label = to === 'new' ? 'New albums for you' : 'Your collection';
  return `<a class="mode" href="${to === 'new' ? '#new' : '#'}" aria-label="${label}" title="${label}">${ICONS[to]}</a>`;
}

function render() {
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const note = view.note || (busy && !view.shown.length ? 'Finding albums for you…' : '');
  const login = view.login ? ' <button class="link" data-action="login">Log in again</button>' : '';
  $('#app').innerHTML = `
    <section class="hello">${toggle()}<h1>${greet()}.</h1><p class="date">${esc(date)}${mode === 'new' ? ' · new to you' : ''}</p></section>
    ${note ? `<p class="note">${esc(note)}${login}</p>` : ''}
    <ol class="table">${view.shown.map(card).join('')}</ol>
    <div class="actions">
      <button class="btn primary" data-action="more"></button>
      <p class="status" id="status"></p>
    </div>`;
  updateButton();
  renderStatus();
}

function updateButton() {
  const btn = $('[data-action="more"]');
  if (!btn) return;
  const n = view.picked.size;
  btn.textContent = busy ? 'Finding…' : n ? `More like ${n === 1 ? 'this' : 'these'}` : 'Six more';
  btn.disabled = busy || n >= N; // with every slot kept there's nothing to deal
}

function renderStatus() {
  const el = $('#status');
  if (!el) return;
  const count = `${albums.length} album${albums.length === 1 ? '' : 's'}`;
  el.innerHTML = demo
    ? `${count} of sample data · <a href="./">Use my Tidal</a>`
    : `${esc(status || count)} · ${isLoggedIn()
      ? '<button class="link" data-action="logout">Log out</button>'
      : '<button class="link" data-action="login">Log in again</button>'}`;
}

function renderMessage(html) {
  $('#app').innerHTML = `<section class="connect"><h1>Side A</h1>${html}</section>`;
}

function renderConnect(error) {
  const err = error ? `<p class="error">${esc(error)}</p>` : '';
  if (!TIDAL_CLIENT_ID) {
    return renderMessage(`${err}<p>Add your Tidal app’s client id to <code>config.js</code> to use your collection.</p>
      <p><a class="btn primary" href="?demo">Try it with sample albums</a></p>`);
  }
  renderMessage(`${err}<p>Six albums from your Tidal collection each morning. Pick one and play it.</p>
    <p><button class="btn primary" data-action="login">Log in with Tidal</button></p>
    <p class="muted">Your login and album list stay in this browser.</p>`);
}

/* ---------- Collection mode ---------- */

// Picked sleeves stay where they are (still picked); the other slots get albums like them.
function dealMine() {
  const v = views.mine;
  const { albums: next, fresh, reset } = nextDeal(albums, { shown: v.shown, keep: v.picked, n: N, seen: seenToday(v.seenKey) });
  markSeen(v.seenKey, fresh.map((a) => a.id), reset);
  v.note = reset ? 'You’ve seen every album today, so these are repeats.' : '';
  v.shown = next;
  render();
}

/* ---------- New mode ---------- */

// Tidal's similar albums barely change, so each album's list is fetched once and kept.
const similarCache = load('similar', {});
async function similar(id) {
  if (!similarCache[id]) {
    similarCache[id] = await similarAlbumIds(TIDAL_CLIENT_ID, id);
    store('similar', similarCache);
  }
  return similarCache[id];
}

/**
 * Album ids from her liked tracks and Tidal mixes, gathered once a day. `known` are albums she
 * already plays (liked tracks, daily mixes); `extra` are Tidal's picks (discovery, new releases).
 * The mixes need the recommendations.read scope (see config.js) and are skipped without it.
 * A source that fails is skipped; one that needs a new scope asks her to log in again.
 */
async function dailySources() {
  const cached = load('sources', null);
  if (cached?.day === dayKey()) return cached;
  let missingScope = false;
  const from = async (why, fn) => {
    try {
      return (await fn()).map((id) => ({ id, why }));
    } catch (e) {
      if (e instanceof AuthError) throw e;
      if (e instanceof ScopeError) missingScope = true;
      console.warn(why, e);
      return [];
    }
  };
  const [liked, daily, discovery, releases] = await Promise.all([
    from('From your liked tracks', () => likedTrackAlbumIds(TIDAL_CLIENT_ID)),
    mixes ? from('From your daily mix', () => mixAlbumIds(TIDAL_CLIENT_ID, 'userDailyMixes')) : [],
    mixes ? from('From your discovery mix', () => mixAlbumIds(TIDAL_CLIENT_ID, 'userDiscoveryMixes')) : [],
    mixes ? from('New release for you', () => mixAlbumIds(TIDAL_CLIENT_ID, 'userNewReleaseMixes')) : [],
  ]);
  const once = (list) => [...new Map(list.map((x) => [x.id, x])).values()];
  const sources = { day: dayKey(), known: once([...liked, ...daily]), extra: once([...discovery, ...releases]), missingScope };
  if (!missingScope) store('sources', sources); // otherwise try again after she logs in again
  return sources;
}

function setVerdict(album, v) {
  const { why, ...plain } = album; // the reason belongs to today's card, not to her taste
  verdicts = judge(verdicts, plain, v);
  store('verdicts', verdicts);
}

async function dealNew() {
  if (busy) return;
  if (!isLoggedIn()) return renderConnect();
  const v = views.new;
  busy = true;
  menuFor = null;
  render();
  try {
    // Picked albums count as liked from now on.
    for (const a of v.shown) if (v.picked.has(a.id) && !verdicts[a.id]) setVerdict(a, 'like');
    const { known, extra, missingScope } = await dailySources();
    const taste = lessons(verdicts, similarCache);
    const { albums: next, fresh } = await recommend({
      shown: v.shown, keep: v.picked, n: N, seen: seenToday(v.seenKey), owned: albums, known, extra, ...taste,
      similar, details: (ids) => fetchAlbums(TIDAL_CLIENT_ID, ids),
    });
    markSeen(v.seenKey, fresh.map((a) => a.id));
    v.login = missingScope;
    v.note = missingScope ? 'Log in again to let Side A use your liked tracks.'
      : fresh.length ? '' : 'No new albums turned up this time. Try again.';
    if (fresh.length) {
      v.shown = next;
      store('newShown', { day: dayKey(), albums: next }); // a reload shows the same six
    }
  } catch (e) {
    busy = false;
    if (e instanceof AuthError) return renderConnect();
    v.note = 'Couldn’t reach Tidal just now. Try again in a moment.';
    console.error(e);
  }
  busy = false;
  if (view === v) render();
}

/** ♥: saves the album to her Tidal collection (or removes it again), showing the result straight away. */
async function toggleSave(album) {
  const v = views.new;
  const save = verdicts[album.id]?.v !== 'love';
  const { why, ...plain } = album;
  setVerdict(album, save ? 'love' : null);
  albums = save ? [plain, ...albums] : albums.filter((a) => a.id !== album.id);
  render();
  try {
    await saveAlbum(TIDAL_CLIENT_ID, album.id, save);
    store('albums', albums);
  } catch (e) {
    setVerdict(album, save ? null : 'love');
    albums = save ? albums.filter((a) => a.id !== album.id) : [plain, ...albums];
    v.login = e instanceof ScopeError || e instanceof AuthError;
    v.note = v.login ? 'Log in again to let Side A save albums to Tidal.' : 'Couldn’t save that just now. Try again in a moment.';
    console.error(e);
    render();
  }
}

/* ---------- Both modes ---------- */

const deal = () => (mode === 'new' ? dealNew() : dealMine());

/** Shows the current mode, dealing only if it has nothing on screen yet. */
function show() {
  mode = modeFromHash();
  view = views[mode];
  document.documentElement.dataset.mode = mode;
  if (mode === 'mine' && !albums.length) return renderMessage('<p>Your Tidal collection has no albums yet. Save a few in Tidal, then reload.</p>');
  if (view.shown.length) return render();
  if (mode === 'new') {
    const saved = load('newShown', null);
    if (saved?.day === dayKey() && saved.albums?.length) {
      view.shown = saved.albums;
      return render();
    }
  }
  deal();
}

/* ---------- Collection refresh ---------- */

let syncing = false;
async function sync({ force = false } = {}) {
  if (demo || syncing || !isLoggedIn()) return;
  if (!force && Date.now() - load('syncedAt', 0) < RESYNC_MS) return;
  syncing = true;
  status = 'Updating your collection…';
  renderStatus();
  try {
    albums = await syncCollection(TIDAL_CLIENT_ID, albums, (text) => { status = text; renderStatus(); });
    store('albums', albums);
    store('syncedAt', Date.now());
    status = '';
  } catch (e) {
    status = 'Couldn’t update the collection';
    console.error(e);
  } finally {
    syncing = false;
    renderStatus();
  }
}

/* ---------- Events ---------- */

addEventListener('hashchange', () => { if (ready) show(); });

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (e.target.closest('.play, [data-action="toggle"], [data-action="more"]')) setTimeout(sync, 500);
  if (!el) return;
  const li = el.closest('.sleeve');
  const album = li && view.shown.find((a) => a.id === li.dataset.id);
  switch (el.dataset.action) {
    case 'toggle': {
      const on = !view.picked.has(li.dataset.id);
      on ? view.picked.add(li.dataset.id) : view.picked.delete(li.dataset.id);
      li.classList.toggle('is-picked', on);
      el.setAttribute('aria-pressed', String(on));
      updateButton();
      break;
    }
    case 'nope':
      menuFor = menuFor === album.id ? null : album.id;
      render();
      break;
    case 'no':
    case 'kids':
      setVerdict(album, el.dataset.action);
      view.picked.delete(album.id);
      menuFor = null;
      if (el.dataset.action === 'kids') similar(album.id).catch(() => {}); // so its neighbours get blocked too
      render();
      break;
    case 'undo':
      setVerdict(album, null);
      render();
      break;
    case 'save':
      toggleSave(album);
      break;
    case 'more':
      deal();
      scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      break;
    case 'login':
      sessionStorage.setItem('sideA.hash', location.hash); // the login redirect drops it
      beginLogin(tidal);
      break;
    case 'logout':
      logOut();
      // Her verdicts stay: they're about music, and logging back in shouldn't lose them.
      for (const k of ['albums', 'syncedAt', 'newShown', 'seenNew', 'sources']) localStorage.removeItem(KEY + k);
      renderConnect();
      break;
  }
});

/* ---------- Boot ---------- */

async function boot() {
  if (demo) {
    albums = (await import('./demo.js')).demoAlbums();
    ready = true;
    return show();
  }
  try {
    if (await finishLogin(tidal)) {
      history.replaceState(null, '', location.pathname + (sessionStorage.getItem('sideA.hash') ?? ''));
      sessionStorage.removeItem('sideA.hash');
    }
  } catch (e) {
    return renderConnect(e.message);
  }
  albums = load('albums', []);
  if (albums.length || load('syncedAt', 0)) { // fast path: cached collection, refreshed later
    ready = true;
    return show();
  }
  if (!TIDAL_CLIENT_ID || !isLoggedIn()) return renderConnect();
  renderMessage('<p class="muted" id="progress">Loading your collection…</p>');
  try {
    albums = await syncCollection(TIDAL_CLIENT_ID, [], (text) => { $('#progress').textContent = text; });
  } catch (e) {
    return renderConnect(e instanceof AuthError ? '' : `Couldn’t load your collection: ${e.message}`);
  }
  store('albums', albums);
  store('syncedAt', Date.now());
  ready = true;
  show();
}

boot();
