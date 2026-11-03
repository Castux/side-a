import type { MoodVector } from '../core/types';

/** Plain-language reading of a mood vector, e.g. "calm, bright and acoustic". */
export function moodWords(t: MoodVector): string {
  const [e, b, o, d] = t;
  const w = [e < 0.38 ? 'calm' : e > 0.62 ? 'lively' : 'steady', b < 0.38 ? 'dark' : b > 0.62 ? 'bright' : 'mellow'];
  if (o > 0.62) w.push('acoustic');
  else if (o < 0.38) w.push('electronic');
  if (d > 0.66) w.push('lush');
  else if (d < 0.34) w.push('spare');
  return w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1];
}

export function confidenceLabel(sigma: number): string {
  return sigma > 0.3 ? 'Still guessing' : sigma > 0.17 ? 'Getting warmer' : 'Zeroing in';
}
