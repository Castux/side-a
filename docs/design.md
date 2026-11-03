# Design

The app should feel like pulling records off a table in morning light: quiet, a little tactile, quick on a phone.

## Tokens (src/styles.css)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | #E6ECF1 mist | #0F1628 night | Page background |
| `--surface` | #F7F9FB | #18213A | Inputs, panels |
| `--ink` | #17203A | #E7ECF3 | Text, Play buttons |
| `--ink-2` | #56617A | #98A3BA | Secondary text |
| `--line` | #C8D1DB | #2B3654 | Borders, rules |
| `--sun` | #E7B13A | #F1C453 | Selection and the primary action only |

Type: Young Serif for greetings and headings, Familjen Grotesk for everything else (Google Fonts, with system fallbacks).

## Principles

- The one bold element is the round of five sleeves: slightly tilted like records on a table, a picked sleeve straightens, lifts and gets a gold ring.
- Gold (`--sun`) means “chosen” or “do this next”. Don’t use it decoratively.
- Every card has a Play button; the ritual can end at any round.
- Placeholder covers are generated from the mood vector so the art hints at the feel.
- Mobile first: three-then-two sleeves on phones, one row of five from 760px.
- Copy: sentence case, plain verbs, typographic apostrophes, no all-caps labels.
- Respect `prefers-reduced-motion` and keep visible focus rings.
