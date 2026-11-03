import { describe, expect, it } from 'vitest';
import { bpmToEnergy, combine } from '../src/enrich/combine';
import { lookup, normalizeTerm } from '../src/enrich/lexicon';
import { averageRecordings, parseHighLevel } from '../src/enrich/acousticbrainz';
import { parseLastfmTags } from '../src/enrich/lastfm';

const tidal = (over: Partial<NonNullable<Parameters<typeof combine>[0]['tidal']>> = {}) => ({
  genres: [], bpms: [], keyScales: [], toneTags: [], trackCount: 0, ...over,
});

describe('combine', () => {
  it('returns neutral values and zero confidence with no evidence', () => {
    const c = combine({});
    expect(c.f).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(c.confidence).toEqual([0, 0, 0, 0]);
    expect(c.sources).toEqual([]);
  });

  it('reads major keys as brighter than minor keys', () => {
    const major = combine({ tidal: tidal({ keyScales: ['MAJOR', 'MAJOR', 'MAJOR', 'LYDIAN'] }) });
    const minor = combine({ tidal: tidal({ keyScales: ['MINOR', 'DORIAN', 'MINOR', 'MINOR'] }) });
    expect(major.f[1]).toBeGreaterThan(0.65);
    expect(minor.f[1]).toBeLessThan(0.35);
    expect(major.sources).toContain('Tidal keys');
  });

  it('maps tempo to energy', () => {
    expect(bpmToEnergy(60)).toBe(0);
    expect(bpmToEnergy(200)).toBe(1);
    const c = combine({ tidal: tidal({ bpms: [150, 155, 160, null, 158] }) });
    expect(c.f[0]).toBeGreaterThan(0.8);
  });

  it('uses genres and tags for the acoustic and density axes', () => {
    const c = combine({ tidal: tidal({ genres: ['Techno'] }), lastfm: { tags: [{ name: 'minimal', count: 100 }, { name: 'dark', count: 60 }] } });
    expect(c.f[2]).toBeLessThan(0.2);
    expect(c.f[3]).toBeLessThan(0.3);
    expect(c.f[1]).toBeLessThan(0.3);
  });

  it('weights AcousticBrainz scores strongly and raises confidence', () => {
    const ab = { recordings: 8, happy: 0.9, sad: 0.1, relaxed: 0.2, aggressive: 0.7, party: 0.8, acoustic: 0.1, electronic: 0.9, danceable: 0.9 };
    const c = combine({ acousticbrainz: ab });
    expect(c.f[0]).toBeGreaterThan(0.7);
    expect(c.f[1]).toBeGreaterThan(0.8);
    expect(c.f[2]).toBeLessThan(0.2);
    expect(c.confidence[0]).toBeGreaterThan(0.6);
    expect(c.confidence[3]).toBe(0); // AcousticBrainz says nothing about density
  });

  it('reports tags the lexicon does not know', () => {
    const c = combine({ lastfm: { tags: [{ name: 'seen live', count: 100 }, { name: 'chill', count: 50 }] } });
    expect(c.unmatched).toContain('seen live');
    expect(c.unmatched).not.toContain('chill');
  });
});

describe('lexicon', () => {
  it('normalizes punctuation and spacing', () => {
    expect(normalizeTerm('Post-Punk')).toBe('post punk');
    expect(lookup('Hip-Hop')).not.toBeNull();
    expect(lookup('post_rock')).not.toBeNull();
  });
});

describe('source parsers', () => {
  it('parses AcousticBrainz high-level JSON', () => {
    const hl = Object.fromEntries(
      [['mood_happy', 'happy'], ['mood_sad', 'sad'], ['mood_relaxed', 'relaxed'], ['mood_aggressive', 'aggressive'], ['mood_party', 'party'], ['mood_acoustic', 'acoustic'], ['mood_electronic', 'electronic'], ['danceability', 'danceable']]
        .map(([m, c]) => [m, { all: { [c!]: 0.25 } }]),
    );
    const m = parseHighLevel({ highlevel: hl });
    expect(m?.happy).toBe(0.25);
    expect(averageRecordings([m!, { ...m!, happy: 0.75 }])?.happy).toBe(0.5);
    expect(parseHighLevel({})).toBeNull();
  });

  it('parses Last.fm tags, including a single-object tag', () => {
    expect(parseLastfmTags({ toptags: { tag: [{ name: 'jazz', count: 100 }, { name: 'cool jazz', count: '40' }] } }))
      .toEqual([{ name: 'jazz', count: 100 }, { name: 'cool jazz', count: 40 }]);
    expect(parseLastfmTags({ toptags: { tag: { name: 'folk', count: 3 } } })).toEqual([{ name: 'folk', count: 3 }]);
    expect(parseLastfmTags({ error: 6 })).toEqual([]);
  });
});
