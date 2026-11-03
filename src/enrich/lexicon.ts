/**
 * Maps tags, tone tags, genres and styles to target values on the four mood axes.
 * e: energy (calm 0 → lively 1), b: brightness (dark 0 → bright 1),
 * o: organic (electronic 0 → acoustic 1), d: density (spare 0 → lush 1).
 * A term only states the axes it says something about. Hand-written first pass:
 * extend it as you see unmatched terms in the enrich report.
 */
export type Hint = Partial<Record<'e' | 'b' | 'o' | 'd', number>>;

export const LEXICON: Record<string, Hint> = {
  // Moods and descriptors (Last.fm tags, Tidal tone tags)
  happy: { b: 0.85 }, joyful: { b: 0.9, e: 0.7 }, uplifting: { b: 0.85, e: 0.65 }, cheerful: { b: 0.85 },
  sunny: { b: 0.9 }, summer: { b: 0.8, e: 0.6 }, feelgood: { b: 0.85 }, 'feel good': { b: 0.85 },
  playful: { b: 0.75, e: 0.6 }, romantic: { b: 0.6, e: 0.35 }, sensual: { e: 0.35, b: 0.5 }, sexy: { e: 0.45, b: 0.5 },
  sad: { b: 0.15 }, melancholic: { b: 0.2 }, melancholy: { b: 0.2 }, depressing: { b: 0.08, e: 0.25 },
  dark: { b: 0.12 }, gloomy: { b: 0.12 }, haunting: { b: 0.2, d: 0.55 }, brooding: { b: 0.15, e: 0.4 },
  bittersweet: { b: 0.4 }, nostalgic: { b: 0.45 }, introspective: { b: 0.35, e: 0.3 }, lonely: { b: 0.2, d: 0.3 },
  nocturnal: { b: 0.25, e: 0.35 }, 'late night': { b: 0.3, e: 0.3 }, night: { b: 0.3 }, rainy: { b: 0.3, e: 0.25 },
  angry: { e: 0.9, b: 0.2 }, aggressive: { e: 0.95, b: 0.2 }, intense: { e: 0.85 },
  energetic: { e: 0.9 }, upbeat: { e: 0.8, b: 0.75 }, party: { e: 0.9, b: 0.75 }, dance: { e: 0.85 },
  danceable: { e: 0.8 }, groovy: { e: 0.7, b: 0.65 }, funky: { e: 0.75, b: 0.7 }, driving: { e: 0.8 },
  chill: { e: 0.25 }, chillout: { e: 0.25, o: 0.35 }, relaxing: { e: 0.15 }, relaxed: { e: 0.2 }, calm: { e: 0.12 },
  mellow: { e: 0.25, b: 0.55 }, peaceful: { e: 0.1, b: 0.6 }, meditative: { e: 0.08, d: 0.3 }, sleep: { e: 0.05 },
  soothing: { e: 0.12, b: 0.6 }, dreamy: { e: 0.3, d: 0.7, b: 0.6 }, ethereal: { e: 0.25, d: 0.65 }, hypnotic: { e: 0.5 },
  atmospheric: { d: 0.7, e: 0.3 }, lush: { d: 0.9 }, epic: { d: 0.9, e: 0.75 }, cinematic: { d: 0.8 },
  orchestral: { d: 0.85, o: 0.85 }, 'wall of sound': { d: 0.95 }, noisy: { d: 0.9, e: 0.75 },
  minimal: { d: 0.15 }, minimalist: { d: 0.2 }, sparse: { d: 0.12 }, intimate: { d: 0.2, e: 0.25 }, quiet: { e: 0.1, d: 0.2 },
  warm: { b: 0.65, o: 0.7 }, cold: { b: 0.25, o: 0.25 }, mechanical: { o: 0.1 }, organic: { o: 0.85 },

  // Genres and styles (Tidal genres, MusicBrainz genres, Discogs styles)
  acoustic: { o: 0.95, d: 0.3 }, folk: { o: 0.9, d: 0.35 }, 'singer songwriter': { o: 0.9, d: 0.25 },
  'indie folk': { o: 0.85, d: 0.4 }, americana: { o: 0.9 }, country: { o: 0.85, b: 0.6 }, bluegrass: { o: 1, e: 0.65 },
  jazz: { o: 0.9 }, 'cool jazz': { o: 0.9, e: 0.3 }, 'hard bop': { o: 0.9, e: 0.7 }, 'free jazz': { o: 0.9, e: 0.8, d: 0.85 },
  'spiritual jazz': { o: 0.85, d: 0.65 }, 'bossa nova': { o: 0.95, e: 0.3, b: 0.75 }, blues: { o: 0.85, b: 0.35 },
  classical: { o: 0.9 }, 'modern classical': { o: 0.75, e: 0.3 }, 'contemporary classical': { o: 0.75, e: 0.3 },
  'neo classical': { o: 0.7, e: 0.25 }, baroque: { o: 1, b: 0.6 }, piano: { o: 0.9, d: 0.3 }, choral: { o: 0.95, d: 0.7 },
  soul: { o: 0.75, b: 0.6 }, funk: { o: 0.65, e: 0.8, b: 0.7 }, 'r&b': { o: 0.5 }, gospel: { o: 0.85, b: 0.8 },
  reggae: { o: 0.7, e: 0.5, b: 0.7 }, dub: { o: 0.3, e: 0.45, d: 0.6 }, afrobeat: { o: 0.8, e: 0.85, d: 0.8 },
  world: { o: 0.85 }, latin: { o: 0.8, e: 0.7, b: 0.75 },
  rock: { o: 0.6, e: 0.7 }, 'classic rock': { o: 0.65, e: 0.65 }, 'indie rock': { o: 0.55, e: 0.6 },
  'post punk': { e: 0.7, b: 0.25, o: 0.45 }, punk: { e: 0.95, o: 0.55 }, metal: { e: 0.95, b: 0.2, d: 0.9 },
  shoegaze: { d: 0.95, o: 0.35 }, 'dream pop': { d: 0.75, e: 0.35, b: 0.6 }, 'post rock': { d: 0.8, e: 0.5 },
  psychedelic: { d: 0.7 }, 'art rock': { d: 0.7 }, 'progressive rock': { d: 0.8, e: 0.6 },
  pop: { b: 0.7, e: 0.65 }, 'synth pop': { o: 0.15, b: 0.65, e: 0.65 }, 'indie pop': { b: 0.65 },
  'hip hop': { e: 0.7, o: 0.4 }, rap: { e: 0.75, o: 0.35 }, 'jazz rap': { o: 0.55, e: 0.6 }, 'trip hop': { e: 0.4, b: 0.25, o: 0.3 },
  electronic: { o: 0.1 }, electronica: { o: 0.15 }, techno: { o: 0.05, e: 0.85, b: 0.35 }, house: { o: 0.1, e: 0.85, b: 0.7 },
  'deep house': { o: 0.1, e: 0.65 }, disco: { e: 0.85, b: 0.85, o: 0.5 }, 'nu disco': { e: 0.8, b: 0.8, o: 0.25 },
  idm: { o: 0.05, d: 0.6 }, 'uk garage': { o: 0.1, e: 0.75 }, dubstep: { o: 0.05, b: 0.2 }, 'drum and bass': { o: 0.05, e: 0.9 },
  ambient: { e: 0.05, d: 0.35, o: 0.3 }, 'dark ambient': { e: 0.05, b: 0.1, o: 0.2 }, downtempo: { e: 0.3, o: 0.3 },
  'lo fi': { e: 0.3, d: 0.35 }, experimental: { d: 0.6 }, drone: { e: 0.1, d: 0.6 }, industrial: { o: 0.05, b: 0.15, e: 0.8 },
  synthwave: { o: 0.05, b: 0.55 }, chillwave: { o: 0.2, e: 0.35, b: 0.6 },
};

/** "Post-Punk", "post_punk" and "post punk" all map to "post punk". */
export const normalizeTerm = (s: string) => s.toLowerCase().replace(/[-_/]+/g, ' ').replace(/[^a-z0-9& ]/g, '').replace(/\s+/g, ' ').trim();

export function lookup(term: string): Hint | null {
  const n = normalizeTerm(term);
  return LEXICON[n] ?? LEXICON[n.replace(/ /g, '')] ?? null;
}
