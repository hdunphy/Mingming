# Playtest run sheet — ticket 118

Six scenarios, in `src/debug/scenarios/playtest/ticket-118/`. All six are verified to load and build
a playable battle (`scratch/check118scenarios.ts`), so nothing here should fight you at the launcher.

**Order matters for two of them.** Play 04 → 06 back to back, and 02 → 03 back to back. Each pair is
a comparison; either one alone tells you much less.

**Budget:** about 20 minutes if you only want the headline answers, 45 if you want to be sure.

---

## The two questions

**Q1 — stacked species.** Three of one mingming on a team, legal since you removed the copy cap. The
sim says some of these comps are the strongest things on the board. Are they *fun*, and could a run
realistically assemble one?

**Q2 — coverage control.** Tickets 115/116 gave control's answer cards side-wide reach and moved
`panel-control` vs `panel-zoo` from 10% to 40% at 3v3. The win rate says it worked. **Nothing
measures whether the turns are enjoyable**, which is the only thing that can still sink it.

---

## Q2 — does coverage control feel good?

### `02-draugr-alone-vs-three` — start here
One draugr against the whole zoo panel. Deliberately unfair, and that is the point: it is the fastest
way to *see* the change. `killing_frost` puts 2 Weakened and 2 Dazed on all three enemies for 1
Energy. `rimefrost` does 1 and 1 to all three for **zero**.

**Watch for:** how long a side-wide card takes to resolve, and how much log it produces. The
suspected failure mode is not weakness, it is tedium — three bodies × two statuses × animation, every
turn, forever.

**Answers:** whether side-wide resolution needs to be faster or quieter before this ships for real.
(Related: your own bug note, *"3v3 enemies take a long time it feels so slow"* — this is where that
bites hardest.)

### `03-draugr-v2-vs-jormungandr-1v1` — immediately after 02
The same deck, same cards, one enemy. This is the load-bearing claim of the whole change: **a
side-wide card facing one body is just a single-target card**, so the 1v1 game is untouched. Measured
96.7% → 98.3%, and confirmed across all 960 grid cells at a mean delta of +0.00.

**Watch for:** whether the cards still *read* right. "Apply 2 Weakened and 2 Dazed to side" against a
single opponent is mechanically fine and might be confusing text. If it reads oddly here, that is a
wording problem worth knowing about now.

### `01-control-panel-vs-zoo-3v3` — the real matchup
kraken_v1 + huldra_v1 + draugr_v2 against the zoo panel. Everything that shipped is in this one: all
five side-scoped cards, plus kraken's Abyssal Ink now dazing the whole enemy side.

**Watch for:** whether the 40% *feels* like 40%. Also whether kraken finally feels like it does
something — before this it ran **zero** enemy-facing debuff cards and its whole contribution was a
random 1 Dazed on a draw.

**Answers:** whether 40% is the right place for control to sit, or whether it should be closer to
even. That is a design call and I can move it either way; side-scoping `hexbloom` is worth about +15
more points if you want it.

---

## Q1 — stacked species

### `04-triple-jormungandr-vs-zoo` — sim says 86.7%
Three copies of `jormungandr_v1`, one 27-card shared pile. For scale: ticket 109 threw 25 hand-built
stress comps at this same zoo panel and **none** of them beat it. This beats it 86.7%.

Suspected mechanism: three copies of `ink_stream`, an uncapped per-card-played scaler, in one pile.
The copy cap was quietly what bounded scaler density.

**Watch for:** whether it plays like a build or like a solved puzzle. Does the shared pile give you
decisions, or does every turn play itself?

### `05-triple-sleipnir-vs-control-panel` — sim says 100%
30 games, 30 wins, FTK 0, truncated 0. Nothing is broken — the ceiling just moved. **A 100% matchup
is worth feeling from the inside once** before deciding whether the copy cap needs a replacement.

### `06-triple-huldra-vs-zoo` — sim says 26.7%, and this is the important one
Play it right after 04. Same rule, same legality, and it **loses badly** — 26.7% — even though huldra
holds an elemental advantage against all three opponents.

**This is why "stacking is broken" is the wrong conclusion.** Whatever separates triple-jormungandr
from triple-huldra is the thing that actually needs bounding, and it is probably the uncapped
per-card scaler rather than the stacking. `0-NO-CAPS` rules out a ceiling anyway, so the lever would
be a *condition* that makes the scaler pay less often when the pile is dense.

**Answers:** whether this is a rule problem or a specific-card problem. If it is the card, it is a
much smaller fix than revisiting your duplicate ruling.

---

## What I need back from you

Only four things, and none of them need numbers:

1. **Is side-wide control fun, or tedious?** (from 02 and 01)
2. **Does "to side" text read badly at 1v1?** (from 03)
3. **Should control sit at 40% or nearer 50%?** (from 01)
4. **Is stacking the problem, or is `ink_stream` the problem?** (from 04 vs 06)

Anything else you notice is a bonus — drop it in `docs/bugs.txt` and I will pick it up.

---

## Note on the registry-hash banner

The files are stamped with the registry hash as of 2026-08-26 (`1:b72cdb3a`), so the launcher should
show no mismatch warning today. **After the next card change it will start warning** — that is the
banner working, not the file breaking. The scenarios stay loadable; regenerate them with
`npx vite-node scratch/gen118scenarios.ts` if you want the banner quiet again.
