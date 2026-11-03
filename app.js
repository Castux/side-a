import { REDIRECT_URI, TIDAL_CLIENT_ID } from './config.js';
import { dayKey, deal as nextDeal } from './pick.js';
import { albumUrl, AuthError, beginLogin, finishLogin, isLoggedIn, logOut, syncCollection } from './tidal.js';

const N = 6;
const RESYNC_MS = 60 * 60 * 1000; // refresh the collection at most hourly, and only after you've used the page
const demo = new URLSearchParams(location.search).has('demo');
const KEY = demo ? 'sideA.demo.' : 'sideA.';
const tidal = { clientId: TIDAL_CLIENT_ID, redirectUri: REDIRECT_URI };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(KEY + k)) ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* full or blocked */ } };
const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

let albums = [];
let shown = [];
let note = '';
const picked = new Set();
let status = '';

/* ---------- Seen today ---------- */

function seenToday() {
  const s = load('seen', null);
  return s?.day === dayKey() ? s.ids : [];
}
function markSeen(ids, reset) {
  store('seen', { day: dayKey(), ids: reset ? ids : [...seenToday(), ...ids] });
}

/* ---------- Rendering ---------- */

function greet(h = new Date().getHours()) {
  return h < 5 ? 'Up early' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function cover(a) {
  return a.cover
    ? `<img src="${esc(a.cover)}" alt="" decoding="async">`
    : `<span class="ph" style="--h:${hash(a.id) % 360}">${esc(a.title)}</span>`;
}

function card(a) {
  const tilt = ((hash(a.id + shown[0]?.id) / 2 ** 32 - 0.5) * 6).toFixed(1);
  const on = picked.has(a.id);
  return `<li class="sleeve${on ? ' is-picked' : ''}" style="--tilt:${tilt}deg" data-id="${esc(a.id)}">
    <button class="sleeve-art" data-action="toggle" aria-pressed="${on}" aria-label="${esc(a.title)} by ${esc(a.artist)}: more like this">${cover(a)}<span class="check" aria-hidden="true">✓</span></button>
    <a class="play" href="${esc(demo ? `https://listen.tidal.com/search?q=${encodeURIComponent(a.artist + ' ' + a.title)}` : albumUrl(a.id))}" target="_blank" rel="noopener">Play</a>
    <div class="sleeve-meta"><p class="t">${esc(a.title)}</p><p class="a">${esc(a.artist)}${a.year ? ', ' + a.year : ''}</p></div>
  </li>`;
}

function render() {
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  $('#app').innerHTML = `
    <section class="hello"><h1>${greet()}.</h1><p class="date">${esc(date)}</p></section>
    ${note ? `<p class="note">${esc(note)}</p>` : ''}
    <ol class="table">${shown.map(card).join('')}</ol>
    <div class="actions">
      <button class="btn primary" data-action="more"></button>
      <p class="status" id="status"></p>
    </div>`;
  updateButton();
  renderStatus();
}

function updateButton() {
  $('[data-action="more"]').textContent = picked.size ? `More like ${picked.size === 1 ? 'this' : 'these'}` : 'Six more';
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

/* ---------- Actions ---------- */

// Picked sleeves stay where they are (still picked); the other slots get albums like them.
function deal() {
  const { albums: next, fresh, reset } = nextDeal(albums, { shown, keep: picked, n: N, seen: seenToday() });
  markSeen(fresh.map((a) => a.id), reset);
  note = reset ? 'You’ve seen every album today, so these are repeats.' : '';
  shown = next;
  render();
}

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

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (e.target.closest('.play, [data-action="toggle"], [data-action="more"]')) setTimeout(sync, 500);
  if (!el) return;
  switch (el.dataset.action) {
    case 'toggle': {
      const li = el.closest('.sleeve');
      const on = !picked.has(li.dataset.id);
      on ? picked.add(li.dataset.id) : picked.delete(li.dataset.id);
      li.classList.toggle('is-picked', on);
      el.setAttribute('aria-pressed', String(on));
      updateButton();
      break;
    }
    case 'more':
      deal();
      scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      break;
    case 'login':
      beginLogin(tidal);
      break;
    case 'logout':
      logOut();
      localStorage.removeItem(KEY + 'albums');
      localStorage.removeItem(KEY + 'syncedAt');
      renderConnect();
      break;
  }
});

/* ---------- Boot ---------- */

async function boot() {
  if (demo) {
    albums = (await import('./demo.js')).demoAlbums();
    return deal();
  }
  try {
    await finishLogin(tidal);
  } catch (e) {
    return renderConnect(e.message);
  }
  albums = load('albums', []);
  if (albums.length) return deal(); // fast path: cached collection, refreshed later
  if (!TIDAL_CLIENT_ID || !isLoggedIn()) return renderConnect();
  renderMessage('<p class="muted" id="progress">Loading your collection…</p>');
  try {
    albums = await syncCollection(TIDAL_CLIENT_ID, [], (text) => { $('#progress').textContent = text; });
  } catch (e) {
    return renderConnect(e instanceof AuthError ? '' : `Couldn’t load your collection: ${e.message}`);
  }
  store('albums', albums);
  store('syncedAt', Date.now());
  if (!albums.length) return renderMessage('<p>Your Tidal collection has no albums yet. Save a few in Tidal, then reload.</p>');
  deal();
}

boot();
