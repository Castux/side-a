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

Type: Young Serif for the greeting and headings, Familjen Grotesk for everything else (Google Fonts, with system fallbacks).

## Principles

- One screen: greeting, six sleeves, one button. No other pages.
- The sleeves are slightly tilted like records on a table; a picked sleeve straightens, lifts and gets a gold ring.
- Gold (`--sun`) means “chosen” or “do this next”. Don’t use it decoratively.
- Every card has its own Play button, between the sleeve and the title, so the buttons line up across a row.
- Albums without art get a gradient placeholder with the title.
- Mobile first: three by two on phones, one row of six from 900px.
- Copy: sentence case, plain verbs, typographic apostrophes, no all-caps labels.
- Respect `prefers-reduced-motion` and keep visible focus rings.
