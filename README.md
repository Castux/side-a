# Side A

Six random albums from your Tidal collection to start the day. Tap any that suit your mood to get six more like them, or press Play to open one in Tidal. Albums you’ve seen today don’t come back until tomorrow.

It’s a static page with no build step. Your Tidal login and album list stay in your browser’s local storage.

## Try it

```sh
npm run dev        # or any static server; ES modules don't load from file://
```

Open <http://localhost:8000/?demo> for 66 sample albums.

## Use your Tidal collection

1. Register an app at <https://developer.tidal.com> with the `collection.read` scope. Add a redirect URI for each place you’ll open the page, exactly as it appears in the address bar, e.g. `http://localhost:8000/` and `https://you.github.io/side-a/`.
2. Put the app’s client id in `config.js`. It’s public by design with PKCE, so committing it is fine. Never add the client secret.
3. Open the page and log in.

## Host it

Any static host works. For GitHub Pages, push the repo and enable Pages for the branch root. The files the browser needs are `index.html`, `style.css`, `app.js`, `pick.js`, `tidal.js`, `config.js` and `demo.js`.

## Files

| File | What |
|---|---|
| `app.js` | UI, boot, local storage, when to refresh |
| `pick.js` | Choosing six albums (pure, tested) |
| `tidal.js` | Login, collection sync, response parsers |
| `config.js` | Tidal client id |
| `demo.js` | Sample albums for `?demo` |
| `docs/HANDOVER.md` | Status, what’s verified, next steps |
