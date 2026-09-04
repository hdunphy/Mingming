# Ticket 132 — every balance number on record is now stale

**Status:** CLOSED 2026-09-04 — the re-baseline it asked for has been run and promoted seven times since.

`docs/balance/deck_grid.json` was last regenerated on **2026-08-28** (commit `48bc586`). Five
balance-affecting changes have landed since:

| commit | change | why it moves win rates |
|---|---|---|
| `fd720af` | `whirlpool_v2` gains 1 Dazed | measured +4 field at 1v1, +8.3 on the 3v3 panel |
| `4b083ff` | **+1 cardDraw on all 17 species** | the refill goes from ~5.4 to ~8.2 cards at 3v3 |
| `4b083ff` | **+50% HP on every frame** | frames 73–80 → 109–120 |
| `43994f8` | hand cap 9 → 15 | the refill stops being clipped (was losing ~1 card/turn) |
| `c772cd1` | `feedback_loop_daemon` 2e → 1e, proc 5 → 7 power | a reward card, not in a deck list, so small |

**`1f69e37` (the ×10 scale) should move nothing** — damage and health scaled by the same factor, so
the pace is identical and every card price was verified unchanged. It is listed here only so nobody
assumes it needs re-measuring.

## What this means in practice

Every number in the grid, in the EA subset report, and in every ticket that quotes a deck's field
is **from before the draw and HP changes**. The roster mean of 50.3%, `fafnir_v1` at 34.7%,
`kraken_v1` at 52.5%, the control-vs-zoo 66.7% — all of them predate a change that gives every deck
three more cards a turn and half again as much health.

**Nothing should be tuned off those numbers until the grid is re-run.**

## What to run

```
node scratch/rebaseline.mjs          # resumable by deck; ~2h cold on an 8-core machine
```

Two things worth deciding before it runs, because they change what the grid means:

1. **The beam is on in the browser and off under Node** (ticket 127). The grid runs under Node and
   is therefore beamless, which is correct — it is the ship gate, and ticket 108's rule is to
   confirm anything actionable at full and beamless. Worth knowing the players' AI is not the one
   the grid measures.
2. **More draw and more HP both lengthen the deck's exposure**, so archetypes that build over time
   (poison attrition, momentum, discard) should read better than they did. If they do not, that is
   a finding rather than noise.

## Also worth re-running

- `scratch/handeconomy.ts --width 3 --iter 10` — the shipped configuration at a sample big enough to
  settle the turn count. Everything on record is 3–6 battles a panel, and the arc showed twice that
  this cannot resolve half a turn.
- The EA subset (Nature/Water/Fire) — that is the shipping set, and it is the one that matters.

---

## RESULT, 2026-09-01: the roster is badly out of balance and we know why

Re-run at 30 iterations, seed base `grid`, 32 decks, 960 cells — the same basis as the committed
grid. Raw rows in `results/rebaseline/`.

### The headline

| | before (2026-08-28) | after |
|---|---|---|
| decks **in band** (35–65%) | **28 / 32** | **15 / 32** |
| spread | 34.6 – 68.2 | **17.8 – 91.8** |
| standard deviation | 9.2 | **19.4** |

**Half the roster fell out of band and the dispersion more than doubled.** Sixteen decks moved by
more than ten points; the biggest gain is `ratatoskr_v1` at **+34.6** and the biggest loss `ymir_v2`
at **−24.3**.

This is not a reason to undo the changes. Henry's ruling stands — *"Feel always carries more weight
than decisions or numbers we picked in the past"* — and the changes did what they were meant to do.
It means **the roster now needs a re-tune around the new economy**, and the useful part is that we
know what predicts a deck's shift.

### What actually moved it — tested, not assumed

Correlation of each deck's field change against three candidate explanations:

| candidate | r |
|---|---|
| **share of 0-cost cards** | **+0.571** |
| **average card cost** | **−0.568** |
| share of percentage-denominated cards (heal / Burn / Poison / Regen) | +0.298 |

**The dominant driver is card cost, not percentages.** +1 card draw only helps a deck that can
*afford* to cast the extra card — energy did not move. So a cheap deck converts the extra draw
straight into extra plays, and an expensive deck just holds it. `ratatoskr_v1` averages **0.73**
energy a card and gained 34.6; `ymir_v2` averages **1.50** with no 0-cost cards at all and lost 24.3.

**Henry's percentage worry is real and is the second factor.** Power-based damage does not read
maxHp, while heals, Burn, Poison and Regen are all a fraction OF maxHp — so the +50% frame left
percentage effects untouched in bar-fraction terms and cost attack cards a third of their reach.
**65 of 219 cards** are percentage-denominated. It shows up clearly where cost does not explain the
move: `nidhoggr_v1` (80% percentage cards) gained 26.1, `fenrir_v2` (67%, the Burn deck) gained 18.9.

It is weaker than cost because the two often pull against each other — `nidhoggr_v2` is 50%
percentage-denominated and still lost 18.5, because it is the more expensive of the pair.

### This is the 1v1 grid, and 3v3 is probably worse

The draw formula is `sum(cardDraw) − alive + 1`, so **+1 cardDraw is +1 card at 1v1 and +3 at 3v3.**
The mechanism that re-ordered this grid is three times stronger in the mode the game ships. The 3v3
panels should be re-measured before any deck is re-tuned off these numbers.

### What I did NOT do

`docs/balance/deck_grid.json` is **not overwritten** — `rebaseline.mjs` never does, deliberately.
The new rows sit in `results/rebaseline/` for comparison. Promoting them is a decision, and it
should probably wait until after the re-tune rather than enshrining a broken roster as the baseline.

### Suggested order

1. **Playtest first.** The feel changes are the point; confirm they land before tuning numbers.
2. **Re-measure the 3v3 panels** — that is the shipping mode and the effect is larger there.
3. **Then re-tune, using average card cost as the lever.** The decks that lost are the expensive
   ones; they need either cheaper cards or a reason to hold them. That is a deck-design pass, not a
   knob turn, and it is ticket 114's territory.
4. **Consider whether heals and DoT should be re-priced** now that they are worth 1.5× relative to
   attacks — or whether that is the game you want, since it favours the attrition archetypes that
   `powerscale`'s pace notes say never got room to exist.

---

# Resolution — CLOSED 2026-09-04

This ticket asked for one thing: the grid was stale after ticket 131, so regenerate and promote it.
That has happened repeatedly since, and `scratch/promotegrid.mjs` now derives its own provenance
note (date from the newest measured row, build from the commit the promotion ran against), so the
failure mode this ticket named — *"a correct instrument reporting a build that no longer exists"* —
cannot recur silently.

Promotions since, each in its own commit with its own measurement directory: post-136 round one,
post-138 (glass_cannon), post-percent-recoil, ticket 137, round two, round three, and 136u. The
live grid is `results/rebaseline-valk/`: **mean 49.9, sd 8.6, 31 of 32 in band**, against the
sd 19.4 / 22-in-band the roster carried when this ticket was written.
