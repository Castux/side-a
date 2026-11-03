# Genre and mood data sources

Researched 3 November 2026 from memory up to mid-2026; these sites could not be reached from the build sandbox. Check current terms and response shapes before relying on any of them.

| Source | Gives | Access | Used here |
|---|---|---|---|
| Tidal (see tidal-api-notes.md) | Genres; per-track bpm, key, key scale, tone tags | OAuth, `collection.read` | Yes, primary |
| AcousticBrainz dumps | Per-recording classifier scores: happy, sad, relaxed, aggressive, party, acoustic, electronic, danceability | Free download from MetaBrainz; project stopped collecting in 2022 | Yes, if `ACOUSTICBRAINZ_DIR` is set |
| MusicBrainz | Curated genres, community tags; barcode and ISRC lookups | Free, no key; ≤ 1 request/s; identifying User-Agent required | Yes, as the bridge to AcousticBrainz and for genres |
| Last.fm | Community tags, many of them moods | Free API key; non-commercial terms | Yes, if `LASTFM_API_KEY` is set |
| Discogs | Genres and fine-grained styles | Free personal token; about 60 requests/min | Not yet; `combine.ts` already accepts it |
| Spotify audio features | Energy, valence, acousticness… | Closed to new apps since Nov 2024 | No |
| Rate Your Music | Excellent descriptors | No API; scraping breaks terms | No |
| Essentia | Mood and genre models run on audio | Open source; needs local audio files | No, Tidal streams can’t be analysed |

## Matching albums across services

Tidal album `barcodeId` → MusicBrainz release (`/ws/2/release/?query=barcode:…`) → release group (genres, tags) and recordings → AcousticBrainz files by recording MBID. When the barcode isn’t found, fall back to track ISRCs (`/ws/2/isrc/{isrc}`). Last.fm is matched by artist and album name with autocorrect.

## Using the AcousticBrainz dump

Download the high-level dump, extract the JSON files you need, and put them in `data/acousticbrainz/` named `<recording-mbid>.json` (the folder is git-ignored). `src/enrich/acousticbrainz.ts` expects `highlevel.<model>.all.<class>` probabilities, e.g. `highlevel.mood_happy.all.happy`. Check one real file before trusting the parser. The full dump is large; a later improvement is an index that extracts only recordings in the owner’s collection.
