# Side A

Six random albums from your Tidal collection to start the day. Tap any that suit your mood to keep them and fill the rest with more like them, or press Play to open one in Tidal. Albums you’ve seen today don’t come back until tomorrow.

Live at <https://castux.github.io/side-a/>. A static page with no build step and no dependencies; your Tidal login and album list stay in your browser.

## Run it

```sh
npm run dev   # serves on http://localhost:8000; ES modules don't load from file://
npm test
```

Open <http://localhost:8000/?demo> for sample albums.

## Use your own Tidal app

1. Register an app at <https://developer.tidal.com> with the `collection.read` scope. Add a redirect URI for each address you’ll open the page at, exactly as in the address bar, e.g. `http://localhost:8000/` and `https://you.github.io/side-a/`.
2. Put its client id in `config.js`. Committing it is fine; never add the client secret.

Any static host works. On GitHub Pages, serve the branch root.

Changing the code? Read [`docs/HANDOVER.md`](docs/HANDOVER.md). Visual design: [`docs/design.md`](docs/design.md).
