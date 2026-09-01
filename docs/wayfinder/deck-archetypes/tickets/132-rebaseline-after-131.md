# Ticket 132 — every balance number on record is now stale

**Status:** OPEN. The biggest outstanding item from the ticket-131 arc.

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
