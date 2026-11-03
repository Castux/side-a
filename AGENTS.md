# Side A

Six random albums from the owner's Tidal collection each morning. A static site: plain HTML, CSS and ES modules, no framework, no build step, no dependencies. **Read `docs/HANDOVER.md` first.**

- `npm run dev` serves the folder on http://localhost:8000 (open `/?demo` for sample albums). `npm test` runs `node --test`.
- Keep it small. Don't add a framework, bundler or npm dependency without asking the owner.
- `pick.js` and the parsers in `tidal.js` are pure; add a test in `tests/` with every change to them.
- The Tidal calls haven't been run live yet. Confirm real responses before building on them, and update the handover when an assumption turns out wrong.
- Ask the owner before changing the flow or the visual design (`docs/design.md`).
