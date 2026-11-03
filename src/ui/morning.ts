import { hashStr, mulberry32 } from '../core/math';
import { confidenceLabel, moodWords } from '../recommender/describe';
import { newSession, type Session } from '../recommender/recommender';
import { $, app, coverHtml, ctx, esc, greet, playLinkHtml } from './app';

export function renderMorning(): void {
  const s = (app.session ??= newSession(ctx()));
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const seed = s.seedId ? app.byId.get(s.seedId) : null;
  const lead = s.round === 1 && !seed
    ? 'Five from your collection, as different as they come. Tap the ones that suit how you feel, then ask for more.'
    : `Reading you as ${moodWords(s.target ?? [0.5, 0.5, 0.5, 0.5])}.` + (seed && s.round === 1 ? ` Starting near ${seed.title}.` : '');
  const n = s.selected.size;
  const math = app.state.settings.math;

  const cards = s.current.map((c) => {
    const a = app.byId.get(c.id)!;
    const picked = s.selected.has(c.id);
    const tilt = ((mulberry32(hashStr(c.id + s.round))() - 0.5) * 7).toFixed(1);
    let tag = c.wildcard ? '<p class="tagline wild">Wildcard</p>' : '';
    if (math) tag += `<p class="tagline">${c.fit == null ? 'spread pick' : 'fit ' + Math.round(c.fit * 100) + '%'}, ${a.f.map((v) => v.toFixed(2)).join(' ')}</p>`;
    return `<li class="sleeve${picked ? ' is-picked' : ''}" style="--tilt:${tilt}deg">
      <button class="sleeve-art" data-action="toggle" data-id="${esc(a.id)}" aria-pressed="${picked}" aria-label="${esc(a.title)} by ${esc(a.artist)}: ${picked ? 'fits my mood' : 'tap if it fits your mood'}">${coverHtml(a)}<span class="check" aria-hidden="true">✓</span></button>
      <div class="sleeve-meta"><p class="t">${esc(a.title)}</p><p class="a">${esc(a.artist)}${a.year ? ', ' + a.year : ''}</p>${tag}</div>
      ${playLinkHtml(a, 'morning')}
    </li>`;
  }).join('');

  const kept = s.liked.map((id) => app.byId.get(id)!).filter(Boolean);
  const keptHtml = kept.length
    ? `<ul class="kept">${kept.map((a) => `<li><button class="mini" data-action="detail" data-id="${esc(a.id)}" aria-label="Details for ${esc(a.title)}">${coverHtml(a)}</button><div><p>${esc(a.title)}</p><p class="a">${esc(a.artist)}</p></div>${playLinkHtml(a, 'morning')}</li>`).join('')}</ul>`
    : '<p class="muted">Albums you tap are kept here across rounds, so you can go back to one.</p>';

  const body = s.current.length
    ? `<ol class="table" aria-label="Round ${s.round} albums">${cards}</ol>
      <div class="actions">
        <button class="btn primary" data-action="next">${n ? `Show 5 more like ${n === 1 ? 'this' : 'these'}` : 'None fit, show different ones'}</button>
        <button class="btn quiet" data-action="restart">Start over</button>
      </div>`
    : `<div class="empty"><p>You’ve seen every album that fits this session. Start over to reshuffle, or pick from the ones you kept below.</p>
      <button class="btn primary" data-action="restart">Start over</button></div>`;

  $('#app').innerHTML = `
    <section class="hello"><h1>${greet()}.</h1><p class="date">${esc(date)}</p></section>
    <div class="round-line"><strong>Round ${s.round}</strong>${s.target ? `<span>${confidenceLabel(s.sigma)}</span>` : ''}</div>
    <p class="reading">${esc(lead)}</p>
    ${body}
    <div class="below">
      <section><h2>Kept so far</h2>${keptHtml}</section>
      <figure class="compass" style="margin:0"><h2>Today’s mood</h2>${compass(s)}
        <figcaption>${s.target ? 'The shaded zone is where the next five come from. Gold dots are albums you kept.' : 'After your first picks, a zone appears showing where Side A is looking.'}</figcaption></figure>
    </div>`;
}

/** Energy × brightness map: whole library faint, current round dark, kept albums gold, search zone shaded. */
function compass(s: Session): string {
  const W = 220, P = 22, span = W - 2 * P;
  const X = (v: number) => (P + v * span).toFixed(1);
  const Y = (v: number) => (W - P - v * span).toFixed(1);
  const dot = (cls: string, r: number) => (id: string) => {
    const a = app.byId.get(id);
    return a ? `<circle class="${cls}" cx="${X(a.f[0])}" cy="${Y(a.f[1])}" r="${r}"/>` : '';
  };
  const all = app.albums.map((a) => dot('all', 2)(a.id)).join('');
  const cand = s.current.map((c) => dot('cand', 3.2)(c.id)).join('');
  const liked = s.liked.map(dot('liked', 4.2)).join('');
  const zone = s.target ? `<circle class="zone" cx="${X(s.target[0])}" cy="${Y(s.target[1])}" r="${(s.sigma * span).toFixed(1)}"/>` : '';
  return `<svg viewBox="0 0 ${W} ${W}" role="img" aria-label="Mood map: energy across, brightness up">
    <defs><clipPath id="cp"><rect x="${P}" y="${P}" width="${span}" height="${span}"/></clipPath></defs>
    <rect class="frame" x="${P}" y="${P}" width="${span}" height="${span}" rx="4"/>
    <g clip-path="url(#cp)">${zone}</g>${all}${cand}${liked}
    <text class="lbl" x="${P}" y="${W - 6}">calm</text>
    <text class="lbl" x="${W - P}" y="${W - 6}" text-anchor="end">lively</text>
    <text class="lbl" x="4" y="${P + 8}">bright</text>
    <text class="lbl" x="4" y="${W - P - 2}">dark</text>
  </svg>`;
}
