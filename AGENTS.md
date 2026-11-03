# Side A

Morning album picker for a Tidal collection. **Read `docs/HANDOVER.md` before doing anything else**: it covers the product, architecture, what is verified vs. assumed, and the next tasks in order.

Quick reference:

- `npm run dev` (sample data), `npm test`, `npm run typecheck`, `npm run build`, `npm run enrich -- --limit 20`
- No external API call in this repo has been run live yet. Confirm real responses before building on them, and update the handover notes when an assumption turns out wrong.
- Keep `src/recommender/` and `src/enrich/` pure and add tests with every change there.
- Ask the owner before changing the four mood axes, the morning flow or the visual design.
