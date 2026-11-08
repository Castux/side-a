// Spotting music made for children, from the album title, artist and copyright line (which
// usually names the label). Tidal's genres are empty, so words are all there is. Pure; tested
// in tests/kids.test.js. When something slips through, add a pattern here and a test case.
// Disney in the copyright line also drops Star Wars, Marvel and Tron soundtracks: on purpose,
// since it catches Frozen and friends, whose titles don't say "kids".

const PATTERNS = [
  // English
  /\bfor (kids|children|babies|toddlers|little ones)\b/,
  /\bkids?'? ?(songs|music|hits|party|edition|classics|favou?rites)\b/,
  /\bchildren'?s (songs|music|favou?rites|classics|album)\b/,
  /\bnursery (rhymes|songs)\b/, /\blullab(y|ies) (for|renditions|versions)\b/, /\bbaby lullab/,
  /\bsing ?-?a ?-?long\b/, /\btoddlers?\b/,
  // Brands and characters
  /\bdisney\b/, /\bpixar\b/, /\bcocomelon\b/, /\bpinkfong\b/, /\bbaby shark\b/, /\bsuper simple songs\b/,
  /\blittle baby bum\b/, /\bsesame street\b/, /\bpeppa pig\b/, /\bpaw patrol\b/, /\bbluey\b/, /\bthe wiggles\b/,
  /\bkidz bop\b/, /\brockabye baby\b/, /\bteletubbies\b/, /\bmoonbug\b/, /\bbabybus\b/, /\bbaby einstein\b/,
  /\bmoomin\b/, /\bmuumi/,
  // Finnish
  /\blasten\b/, /\blastenlaul/, /\blapsille\b/, /\btuutulaul/, /\bloruja\b/,
  /\bti-ti nalle\b/, /\bfrobelin palikat\b/, /\bpikku kakkonen\b/, /\bhevisaurus\b/, /\bpelle hermanni\b/,
  // Swedish, Norwegian, Danish
  /\bbarnvis/, /\bbarnsang/, /\bbarnlat/, /\bfor barn\b/, /\bbornesang/, /\bfor born\b/,
  // German, Dutch
  /\bkinderlied/, /\bfur kinder\b/, /\bvoor kinderen\b/,
  // French, Spanish, Italian
  /\bcomptines?\b/, /\benfantines?\b/, /\bpetit papa noel\b/, /\bpour (les )?enfants\b/, /\bberceuses\b/, /\bcanciones infantiles\b/,
  /\bpara (ninos|ninas)\b/, /\bper bambini\b/, /\bninne nanne\b/,
];

// Lowercase and strip accents, so "Für Kinder" and "Fröbelin" match plain patterns.
const plain = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** True if the album looks like children's music. Album: { title, artist, copyright? }. */
export function isForKids(album) {
  const text = [album.title, album.artist, album.copyright].map(plain).join(' | ');
  return PATTERNS.some((p) => p.test(text));
}
