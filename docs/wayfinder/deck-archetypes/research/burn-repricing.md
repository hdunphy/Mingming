# The Burn repricing — every Burn card got CHEAPER, and the detonation is priced but unreachable

- Type: wayfinder:research — the record for ticket 62's follow-up repricing, ordered by Henry
  in session (2026-08-15). **Scorer only: no card, deck, hook or engine value changed.**
- Read at registry `1:8b7b0ae9`. Branch `card-dev`.
- Scope taken: **fix the model and re-score.** Card costs and card data were NOT edited — that
  is a design session, and "report any redline cards after the repricing" reads as a request
  for the re-scored list rather than for the list to be emptied.

---

## 1. The answer, in one row

**Section 1.3 stays at 40 redlines, but the membership changed and the direction is the
opposite of what the ship note predicted.**

| | before | after |
|---|---|---|
| card-budget redlines (§1.3) | 40 | **40** |
| matchup redlines (§2–3) | 10 | **10** — byte-identical |
| `ash_communion` | 10.6 (over by 4.1) | **9.3** (over by 2.8) |
| `sun_eaters_plunge` | 10.8 (over by 0.3) | **9.7** — **off the list** |
| `ash_reclamation` | 3.0 (at budget) | **3.2** — **new redline**, over by 0.2 |

**Every Burn-carrying card in every deck got cheaper or stayed flat. Not one got more
expensive.** That is not what "the scorer under-prices Burn" implied, and §3 explains why.

---

## 2. Every Burn card, old model against new

Twelve cards across all 32 decks carry a Burn action.

| card | cost | stacks | old | new | Δ | budget | verdict |
|---|---|---|---|---|---|---|---|
| Ash Communion | 2 | consume | 10.5 | **9.3** | −1.2 | 6.5 | **OVER by 2.8** |
| Scorch | 2 | 3 | 6.4 | 5.4 | −1.0 | 6.5 | |
| Sun-Eater's Plunge | 3 | 3 | 10.7 | 9.7 | −1.0 | 10.5 | |
| Molten Core | 1 | 2+2 | 2.6 | 2.3 | −0.3 | 3.0 | see §4 |
| Slag Shed | 1 | −2 | 2.7 | 2.5 | −0.2 | 3.0 | |
| Purify | 1 | −2 | 2.7 | 2.5 | −0.2 | 3.0 | |
| Baseline Purge | 2 | −2 | 5.7 | 5.5 | −0.2 | 6.5 | |
| Pyre Sacrifice | 2 | 3+3 | 6.4 | 6.3 | −0.1 | 6.5 | |
| Frost Bite | 1 | 2 | 3.0 | 2.9 | −0.1 | 3.0 | |
| Ignite | 0 | 1 | 0.5 | 0.5 | 0.0 | 1.0 | |
| Fire Poke | 1 | 1 | 2.7 | 2.7 | 0.0 | 3.0 | |
| Cinder Gust | 1 | 1 | 2.0 | 2.0 | 0.0 | 3.0 | |

`ash_reclamation` (1e, Burn-consume heal) is a registry ORPHAN — in no deck — which is why it
is absent here and present in the redline list. It moved the other way (**3.0 → 3.2**) because
consuming an enemy's Burn is scored as a downside, and the pile being consumed is now worth
less.

---

## 3. Why everything got cheaper: the tier table went DOWN in the middle

The cap went 3 → 4, but the *rungs* moved too. The spread table keeps the 8% top tier and
lengthens the climb, so at the stack counts cards actually apply it prices lower:

| stacks | old tick | new tick | old cumulative price | new cumulative price |
|---|---|---|---|---|
| 1 | 1.5% | 1.5% | 4.5 | **4.5** |
| 2 | 3.5% | **3%** | 15 | **13.5** |
| 3 | 8% | **5%** | 40 | **28.5** |
| 4 | — (over cap) | **8%** | 43 (3 + overflow) | **52.5** |

**No card in any deck applies four Burn in a single action.** The most any single action
applies is three. So every live card sits on the part of the curve that went *down*, and the
detonation — the thing that made the mechanic worth shipping — is priced correctly and reached
by nothing the scorer can see.

That is not a scorer defect. **Detonation happens through accumulation across casts and turns,
which a static per-action pass structurally cannot model.** The dynamic instruments already
measure it: ticket 62's sweep put fenrir_v2's detonation output at ~22 HP/game.

---

## 4. The one card the model gets materially wrong — and it is not new

`molten_core` applies Burn **twice on one card** (2 + 2). The scorer prices each action
independently; the engine sees one pile.

| | scorer | engine |
|---|---|---|
| `molten_core` (2+2) | 13.5 + 13.5 = **27** | one pile of 4 = **52.5** |
| `pyre_sacrifice` (3+3) | 28.5 + 28.5 = **57** | one pile of 6 = **55.5** |
| `scorch` (3) | 28.5 | 28.5 |

**`molten_core` is under-priced by 25.5 power — 2.55 score points on a 3.0 budget.** Modelled
against the pile it actually creates it scores ~4.9 and is 1.9 over budget; as scored it reads
2.3 and passes comfortably.

Two things worth separating here. The per-action independence is **pre-existing** — the old
model had it too. What changed is that it now *matters*, because the new table is non-linear
across the cap: two 2-stack applications are worth far less than one 4-stack pile, where under
the old flat-ish table the gap was small. And this is the same card ticket 58 measured throwing
away **64% of the Burn it applies** — the two findings are the same fact seen from the static
and dynamic ends.

`pyre_sacrifice` happens to land within 0.15 by coincidence (its second application crosses the
cap and detonates, which roughly cancels the under-count).

---

## 5. A property of the shipped mechanic worth knowing: Burn is not monotonic in stacks

Applying **five** Burn deals **less** than applying four.

| stacks applied to a fresh target | engine delivers (% max HP) |
|---|---|
| 3 | 9.50% |
| **4** | **17.50%** |
| **5** | **15.50%** (14% burst + a 1-stack pile) |
| 8 | 31.50% |
| **9** | **29.50%** |

The detonation consumes the pile that would otherwise have ticked down through the whole table.
On an 80 HP frame, 4 stacks deal 13 HP and 5 stacks deal 12. **Every multiple of the cap is a
local maximum**, and the stack just past it is a local minimum. This is priced correctly now
(`burnPower` is non-monotonic to match), but it is a real design property: a card that pushes a
target from 4 to 5 makes things *better* for the target.

---

## 6. What changed in the scorer

**The numbers are now DERIVED from the engine, not transcribed from it.** That is the part that
matters more than the values.

```
BURN_TIER_POWER      ← DEFAULT_GAME_CONFIG.status.burnStacks, cumulated, × 3 power per 1% maxHP
BURN_DETONATION_POWER ← BURN_CONFIG.overflowPercent × 100 × 3
burnPower(N)          ← mirrors BurnBehavior.onApply: ceil(N/cap) − 1 detonations, remainder ticks
```

Transcribing ticket 62's new numbers would have fixed today and left the same trap armed for
the next tier edit — which is exactly how `0-BURN-PRICE-LAG` happened. There is now one table,
and the scorer reads it.

`BURN_OVERFLOW_POWER_PER_STACK` is **gone**, replaced by a per-EVENT price. The old constant
was not merely stale, it was the wrong shape.

**`burnPricing.test.ts` (17 tests) pins scorer against engine.** It does not assert transcribed
values: it runs `BurnBehavior` on a 10,000 HP frame so nothing floors, measures the damage
actually delivered for 1–12 stacks, and requires `burnPower` to equal that share at the spec
rate. A future edit that moves one side and not the other fails there.

Gates: `tsc -b` clean · **814 passed / 61 files** · `vite build` clean · full balance re-run,
**§2–3 redlines byte-identical** (the scorer is a static audit and cannot move a simulation).

---

## 7. Questions for Henry

1. **`ash_communion` is still 2.8 over budget at 9.3** — down from 4.1 over, but the repricing
   did not fix it and was never going to. Ticket 58 already named the cause: it is charged for
   consuming `ASSUMED_STATUS_COUNT` stacks while measuring 1.5 stacks actually consumed. That is
   an `ASSUMED_STATUS_COUNT` question, not a Burn-table one.
2. **`molten_core` (§4).** Options: model multi-action Burn as one pile in the scorer (correct
   but a scorer change with roster-wide effects on any multi-action status card), hand-price the
   card, or accept it as a known under-count. It is the only card in the roster where the gap is
   material.
3. **`ash_reclamation` is a new redline and is in no deck** — one of the 53 registry orphans
   ticket 59 is meant to triage. Worth fixing, or does it wait for that pass?
4. **The non-monotonicity (§5)** is a live design property now. Fine as texture, or should
   `burnPower`'s shape inform a future cap/dial choice?
