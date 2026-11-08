# Design

The app should feel like pulling records off a table in morning light: quiet, a little tactile, quick on a phone.

## Tokens (style.css)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | #E6ECF1 mist | #0F1628 night | Page background |
| `--surface` | #F7F9FB | #18213A | Panels |
| `--ink` | #17203A | #E7ECF3 | Text, Play buttons |
| `--ink-2` | #56617A | #98A3BA | Secondary text |
| `--line` | #C8D1DB | #2B3654 | Borders, rules |
| `--sun` | #E7B13A | #F1C453 | Selection and the primary action only |

**New to you** (`#new`) swaps the tokens for a dusk palette (same roles, `[data-mode="new"]` in style.css):

| Token | Light | Dark |
|---|---|---|
| `--paper` | #F1E7EC blush | #1B1020 plum night |
| `--surface` | #FBF6F8 | #271830 |
| `--ink` | #2B1730 aubergine | #F2E8EE |
| `--ink-2` | #6E5A70 | #B39FB5 |
| `--line` | #DCCBD5 | #3D2A45 |
| `--sun` | #E8708A rose | #F08CA3 |

Type: Young Serif for the greeting and headings, Familjen Grotesk for everything else (Google Fonts, with system fallbacks).

## Principles

- One screen: greeting, date, six sleeves, one button. No intro text and no other pages.
- Two modes on that screen. A small icon at the top right flips between them: a sparkle leads to “new to you”, a record leads back to the collection. In new mode the date line ends with “· new to you”, and each card says why it was picked in a small italic line under the artist (“Like Radiohead”, “From your liked tracks”).
- New-mode cards add two quiet controls: an outline ♥ next to Play (filled rose once saved) and a small ✕ on the cover’s top-left corner, mirroring the ✓. ✕ opens “Not for me” / “Kids’ music” over the cover; a judged card turns grey and its reason line becomes “Not for me · Undo”.
- The sleeves are slightly tilted like records on a table; a picked sleeve straightens, lifts and gets a gold ring (rose in new mode).
- Gold (`--sun`) means “chosen” or “do this next”. Don’t use it decoratively.
- Every card has its own Play button, between the sleeve and the title, so the buttons line up across a row.
- Albums without art get a gradient placeholder with the title.
- Mobile first: three by two on phones, one row of six from 900px.
- Copy: sentence case, plain verbs, typographic apostrophes, no all-caps labels.
- Respect `prefers-reduced-motion` and keep visible focus rings.
