import { DIMS } from '../core/types';
import { $, app, coverHtml, esc, playLinkHtml } from './app';

/* ---------- Library ---------- */

const SORTS = [['added', 'Recently added'], ['artist', 'Artist'], ['year', 'Year'], ['rest', 'Longest since played']] as const;

export function renderLibrary(): void {
  const genres = ['All', ...new Set(app.albums.map((a) => a.genre))];
  const L = app.library;
  $('#app').innerHTML = `<section class="page">
    <div class="page-head">
      <h1>Library</h1>
      <input class="search" type="search" placeholder="Search albums or artists" aria-label="Search albums or artists" value="${esc(L.q)}" data-input="q">
      <select aria-label="Sort" data-input="sort">${SORTS.map(([v, l]) => `<option value="${v}"${L.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="chips" role="group" aria-label="Genre">${genres.map((g) => `<button class="chip" data-action="genre" data-genre="${esc(g)}" aria-pressed="${L.genre === g}">${esc(g)}</button>`).join('')}</div>
    <p class="count" id="count"></p>
    <ul class="grid" id="grid"></ul>
  </section>`;
  updateGrid();
}

export function updateGrid(): void {
  const L = app.library;
  const q = L.q.trim().toLowerCase();
  const lastPlayed = new Map<string, number>();
  for (const p of app.state.plays) if (!lastPlayed.has(p.id)) lastPlayed.set(p.id, p.at);
  const list = app.albums.filter((a) => (L.genre === 'All' || a.genre === L.genre) && (!q || `${a.title} ${a.artist}`.toLowerCase().includes(q)));
  const by = {
    added: (a: (typeof list)[0], b: (typeof list)[0]) => b.addedAt - a.addedAt,
    artist: (a: (typeof list)[0], b: (typeof list)[0]) => a.artist.localeCompare(b.artist) || a.year - b.year,
    year: (a: (typeof list)[0], b: (typeof list)[0]) => a.year - b.year,
    rest: (a: (typeof list)[0], b: (typeof list)[0]) => (lastPlayed.get(a.id) ?? 0) - (lastPlayed.get(b.id) ?? 0) || a.artist.localeCompare(b.artist),
  }[L.sort];
  list.sort(by);
  $('#count').textContent = list.length === app.albums.length
    ? `${list.length} albums in ${app.lib.name.toLowerCase()}`
    : `${list.length} of ${app.albums.length} albums`;
  $('#grid').innerHTML = list.length
    ? list.map((a) => `<li><button data-action="detail" data-id="${esc(a.id)}">${coverHtml(a)}<p class="t">${esc(a.title)}</p><p class="a">${esc(a.artist)}${a.year ? ', ' + a.year : ''}</p></button></li>`).join('')
    : `<li class="muted" style="grid-column:1/-1">No albums match “${esc(L.q)}”. Clear the search or pick another genre.</li>`;
}

/* ---------- History ---------- */

export function renderHistory(): void {
  const st = app.state;
  const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const ms = st.sessions;
  const avg = ms.length ? (ms.reduce((t, s) => t + s.rounds, 0) / ms.length).toFixed(1) : '0';
  $('#app').innerHTML = `<section class="page">
    <div class="page-head"><h1>History</h1></div>
    ${st.plays.length ? `
      <div class="stats">
        <p><b>${st.plays.length}</b><span>albums played</span></p>
        <p><b>${ms.length}</b><span>morning sessions</span></p>
        <p><b>${avg}</b><span>rounds before playing, on average</span></p>
      </div>
      <ul class="hist">${st.plays.map((p) => {
        const a = app.byId.get(p.id);
        if (!a) return '';
        return `<li>${coverHtml(a)}<div><p>${esc(a.title)}</p><p class="muted">${esc(a.artist)}${p.source === 'morning' ? `, from round ${p.round}` : ', from the library'}</p></div><p class="when">${fmt(p.at)}</p></li>`;
      }).join('')}</ul>
      <p style="margin-top:2rem"><button class="btn" data-action="clear">${app.clearArmed ? 'Tap again to clear everything' : 'Clear history'}</button></p>`
    : `<div class="empty"><p>Nothing played yet. Albums you start from Side A show up here, and stay out of your morning picks for ${st.settings.avoidDays} days.</p><p><a class="btn primary" href="#morning" style="text-decoration:none;display:inline-block">Start a morning session</a></p></div>`}
  </section>`;
}

/* ---------- How it works ---------- */

export const shrinkLabel = (v: number) => (v < 0.55 ? 'Fast' : v < 0.7 ? 'Moderate' : 'Slow');

export function renderHow(): void {
  const st = app.state.settings;
  $('#app').innerHTML = `<section class="page prose">
    <div class="page-head"><h1>How it works</h1></div>
    <p>Side A guesses your mood from what you tap and narrows in round by round. Library: ${esc(app.lib.name)}, ${app.albums.length} albums.</p>
    <h2>Tuning</h2>
    <div class="tune">
      <label>Keep recently played albums out of morning picks
        <span class="row"><input type="range" min="0" max="30" step="1" value="${st.avoidDays}" data-setting="avoidDays"><span class="val" id="v-avoidDays">${st.avoidDays} days</span></span></label>
      <label>How fast it narrows after picks
        <span class="row"><input type="range" min="0.4" max="0.85" step="0.01" value="${st.shrink}" data-setting="shrink"><span class="val" id="v-shrink">${shrinkLabel(st.shrink)}</span></span></label>
      <span class="check-row"><input type="checkbox" id="wc" ${st.wildcard ? 'checked' : ''} data-setting="wildcard"><label for="wc" style="display:inline">Include one wildcard in the first three rounds</label></span>
      <span class="check-row"><input type="checkbox" id="mt" ${st.math ? 'checked' : ''} data-setting="math"><label for="mt" style="display:inline">Show fit scores and mood numbers on morning cards</label></span>
      <small>Changes apply from the next round.</small>
    </div>
    <h2>What each album knows</h2>
    <p>Four numbers between 0 and 1: energy (calm to lively), brightness (dark to bright), texture (electronic to acoustic) and density (spare to lush). With Tidal connected they come from Tidal’s tempo, keys, tone tags and genres, plus MusicBrainz, AcousticBrainz and Last.fm where available. Each album’s details list its sources.</p>
    <h2>How a round is picked</h2>
    <p>Round one is chosen for spread. After that the app keeps a target point and a search radius. Albums you tap pull the target toward them; the ones you leave push it slightly away. A round with picks shrinks the radius; a round with none widens it. Early rounds keep one wildcard from outside the zone in case the guess went wrong.</p>
  </section>`;
}

/* ---------- Detail sheet ---------- */

export function openDetail(id: string): void {
  const a = app.byId.get(id);
  if (!a) return;
  const plays = app.state.plays.filter((p) => p.id === id);
  const low = a.confidence ? DIMS.filter((_, i) => (a.confidence![i] ?? 0) < 0.3).map((d) => d.key) : [];
  $('#sheet').innerHTML = `
    <button class="btn quiet close" data-action="close" aria-label="Close">Close</button>
    <div class="sheet-top">${coverHtml(a)}<div><h2>${esc(a.title)}</h2><p class="a">${esc(a.artist)}${a.year ? ', ' + a.year : ''}<br>${esc(a.genre)}</p></div></div>
    <div class="bars">${DIMS.map((d, i) => `<div class="bar"><span>${d.lo}</span><span class="track"><i style="left:${a.f[i]! * 100}%;opacity:${0.35 + 0.65 * (a.confidence?.[i] ?? 1)}"></i></span><span>${d.hi}</span></div>`).join('')}</div>
    <p class="sources">Mood from ${a.sources?.length ? esc(a.sources.join(', ')) : 'no sources yet'}.${low.length ? ` Little evidence for ${low.join(' and ')}, so those are guesses.` : ''}</p>
    <p class="muted" style="margin:0 0 1.2rem">${plays.length ? `Played ${plays.length} time${plays.length > 1 ? 's' : ''}, last on ${new Date(plays[0]!.at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.` : 'Not played from Side A yet.'}</p>
    <div class="sheet-actions">${playLinkHtml(a, 'sheet')}<button class="btn" data-action="seed" data-id="${esc(a.id)}">Start a session near this</button></div>`;
  $('#scrim').hidden = false;
  $<HTMLButtonElement>('#sheet .close').focus();
}

export const closeDetail = () => { $('#scrim').hidden = true; };

/* ---------- Connect / errors (Tidal mode) ---------- */

export function renderConnect(onConnect: () => void, error?: string): void {
  $('#app').innerHTML = `<section class="connect">
    <h1>Connect your Tidal collection.</h1>
    <p>Side A reads the albums you’ve saved in Tidal. It doesn’t change your collection or play anything itself; Play opens Tidal.</p>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}
    <p><button class="btn primary" id="connect">Log in with Tidal</button></p>
  </section>`;
  $('#connect').addEventListener('click', onConnect);
}
