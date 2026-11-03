# Side A

Pick a whole album to start the day. Side A shows five albums from your Tidal collection, you tap the ones that fit your mood, and each round narrows in until one jumps out. Play opens it in Tidal.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173 with 66 sample albums
npm test
```

## Use your Tidal collection

1. Register an app at <https://developer.tidal.com> with redirect URI `http://localhost:5173/` and the `collection.read` scope.
2. Copy `.env.example` to `.env.local`, set `VITE_LIBRARY=tidal` and `VITE_TIDAL_CLIENT_ID`.
3. `npm run dev` and log in.
4. Optional, for better mood matching: put your access token (and a Last.fm key) in `.env.local` and run `npm run enrich -- --limit 20`, then without `--limit`.

The Tidal integration is written from Tidal’s API spec and hasn’t been run against the live service yet. See `docs/HANDOVER.md` for status and next steps.

## Docs

- `docs/HANDOVER.md`: status, architecture, next tasks
- `docs/tidal-api-notes.md`: what Tidal’s API offers for this app
- `docs/data-sources.md`: other sources of genre and mood data
- `docs/design.md`: visual design tokens and principles
- `prototype/side-a.html`: the original single-file prototype
