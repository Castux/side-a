/**
 * Placeholder sleeves generated from an album's mood vector, so the picture hints
 * at the feel: hue and lightness follow brightness, round vs. angular shapes follow
 * organic, shape count follows density, scatter and tilt follow energy.
 * Real albums with a coverUrl get an <img> instead (see ui/shared.ts).
 */
import { hashStr, mulberry32 } from '../core/math';
import type { Album } from '../core/types';

const cache = new Map<string, string>();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function generatedCover(a: Pick<Album, 'id' | 'title' | 'f'>): string {
  const hit = cache.get(a.id);
  if (hit) return hit;
  const [e, b, o, d] = a.f;
  const rng = mulberry32(hashStr(a.id + 'c'));
  const hue = Math.round(228 - b * 190 + (rng() - 0.5) * 30);
  const L = Math.round(16 + b * 58);
  const S = Math.round(30 + e * 40);
  const fgHue = (hue + 140 + rng() * 80) % 360;
  const fg = `hsl(${fgHue} ${55 + e * 30}% ${L > 52 ? 24 : 82}%)`;
  const fg2 = `hsl(${(fgHue + 40) % 360} 60% ${L > 52 ? 40 : 64}%)`;
  const n = 2 + Math.round(d * 12);
  let shapes = '';
  for (let i = 0; i < n; i++) {
    const x = 50 + (rng() - 0.5) * (30 + e * 70);
    const y = 50 + (rng() - 0.5) * (30 + e * 70);
    const col = rng() < 0.6 ? fg : fg2;
    const op = (0.35 + rng() * 0.55).toFixed(2);
    const size = (6 + rng() * 30) * (1.15 - d * 0.5);
    if (rng() < o) {
      shapes += rng() < 0.5
        ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="${col}" opacity="${op}"/>`
        : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${(1 + e * 3).toFixed(1)}" opacity="${op}"/>`;
    } else {
      const rot = Math.round((rng() - 0.5) * 180 * e);
      shapes += `<rect x="${(x - size / 2).toFixed(1)}" y="${(y - size / 4).toFixed(1)}" width="${size.toFixed(1)}" height="${((size / 2) * (rng() * 0.8 + 0.2)).toFixed(1)}" fill="${col}" opacity="${op}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }
  }
  const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(a.title)} cover"><rect width="100" height="100" fill="hsl(${hue} ${S}% ${L}%)"/>${shapes}</svg>`;
  cache.set(a.id, svg);
  return svg;
}
