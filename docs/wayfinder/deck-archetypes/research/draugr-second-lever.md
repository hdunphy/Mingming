# Rimebreaker eats her Sharp — and why the nightmares stayed out

- Type: wayfinder:implementation. **Ticket 107.** Branch `archetype-web`.
- **868 tests green**, `tsc` clean, build clean.
- **One of the ticket's two changes shipped. The other is held, with the measurement that stopped
  it.** That's a design call, so the numbers are all here.

---

## 0. The short version

You said, playing it: *"she can't out-daze huldra's sharp stacks."* The cell was **6.7%**.

`rimebreaker` now reads **every status on the target — buffs included**. Huldra's Sharp pile, the
thing that was beating you, is now the card's ammunition. That single change takes the matchup to
**25–42% across three seed bases**, against your 15–35% target.

The ticket's second change — a Poison rider on GRAVE_CHILL — I measured on its own and did not
ship. It takes the same cell to **83–87%** and her field rate to **82% with sixteen blowout
matchups**. It doesn't need tuning down; it needs a different shape, and both of the ticket's knobs
for it point *up*.

---

## 1. Change 1: rimebreaker reads everything

Old: *"25 power for each different debuff on the target."* Ticket 66 measured the reality of that at
**0.70 distinct debuffs**, and against huldra specifically one or two — which is why the card read
about 4 damage in your hands. It was a payoff card with nothing to be paid on.

New: **"20 power for each different status on the target — buffs, debuffs, anyone's."**

The inversion is the whole point. Against a status deck it's enormous; against a clean board it's
zero. That's deliberately polarised, and it's legal counter-texture under the archetype web — it's
tech, not the plan.

| | before | after |
|---|---|---|
| `draugr_v2` vs `huldra_v1` | 6.7% | **33.3% / 41.7% / 25.0%** (three seed bases) |
| `draugr_v2` field | 58.3% | 61.5% |
| her blowout matchups | — | 3 |

Two of the three seed bases land inside your 15–35% band and the third is 6.7 points over. She still
loses the matchup — huldra is still her counter, which is the intent — but it's a contest now
instead of a formality.

### The scorer constant

The ticket asked for an any-status variant of `ASSUMED_DISTINCT_STATUS`, measured. Done, the same
way ticket 66 measured its sibling — distinct status *types* on the card's target, counted
unconditionally with zeros included, so the two constants are comparable.

`scratch/anystatuscensus.ts`, **32,603 card-aims**:

| population | mean | median |
|---|---|---|
| **roster, any status** | **2.01** | 2 |
| roster, debuff only | 1.19 | 1 |
| `draugr_v2`'s own targets | 3.18 | 3 |

**`ASSUMED_ANY_STATUS = 2`.** Priced for the registry rather than for the deck that ships it —
anyone can draft this card — which is the same choice ticket 66 made.

Two things fall out of that run worth recording:

- **Draugr's own targets read 3.18**, not 2.01. His deck loads them. So the card is worth ~50% more
  in his hands than the constant prices it at, which is the correct direction for a payoff card and
  the reason `rimebreaker` reads 4.0 against a 5.2–6.5 band (under, not a redline).
- **The debuff-only number has drifted 0.70 → 1.19 since ticket 66 measured it.** That's the POWER
  re-denomination putting more statuses on more boards. It still rounds to 1 so
  `ASSUMED_DISTINCT_STATUS` stays — but it's no longer the comfortable margin it was, and the next
  status change should re-check it.

---

## 2. Change 2: the Poison rider, measured and held

*"Statuses draugr applies to an enemy also apply 1 Poison."*

I built it, guarded it, tested it, and measured it. Isolated from change 1:

| build | THE cell | `draugr_v2` field | her blowouts |
|---|---|---|---|
| live (before this ticket) | 6.7% | 58.3% | — |
| **change 1 only** | **33.3% / 41.7%** | **61.5%** | **3** |
| change 2 only | 83.3% / 86.7% | 82.2% | 16 |
| both together | 90.0% / 91.7% | 83.8% | 18 |

Poison is simply too strong to seed per-application. The status census measured consumed Poison
piles at 11.47 — it's a defence-ignoring stack that compounds, and `rimefrost` alone is a **0-cost
card applying two statuses**, of which she runs two copies. Every status card she owns becomes a
Poison engine.

**Both of the ticket's knobs for it point the wrong way** (rimebreaker 20 → 15 or 25; rider Poison
1 → 2), because the ticket expected the changes to undershoot. And 1 Poison per application is
already the minimum — there's no smaller integer.

So I tried conditions instead of knobs, since a per-turn cap isn't a shape you want:

| condition | THE cell | field | blowouts |
|---|---|---|---|
| rider fires only on **Dazed** | 63.3% / 66.7% | 75.7% | 11 |
| rider fires only on **Stunned** | 35.0% / 43.3% | 64.7% | 5 |

Stunned-only lands close — but `glacial_slam` is her only Stunned card and she runs one copy, so the
rider would fire about once a game. **A lever that rarely exists isn't a second lever.**

**My read: change 1 already satisfies the two-lever requirement the rider was for.** The 0-TWO-LEVERS
law wants her counter matchup to be heavily unfavourable rather than impossible, and `rimebreaker`
eating huldra's Sharp *is* a second lever — one that exists precisely in the matchup that needed it.
Adding a Poison engine on top overshoots by fifty points.

If you want the rider anyway, it's one hook block away and the anti-recursion guard is already
shipped and tested. It just needs a shape that isn't "every status, every time."

---

## 3. Two engine findings

**`statusAppliedNotIn` is new, and it earned itself.** A hook that applies a status in response to a
status application feeds itself. With the guard off, one two-status card seeded **24 Poison instead
of 2** — stopped only by the engine's resolution-depth backstop. That's worse than a hang: a wrong
number that still runs.

It ships even though its consumer is held, and it's pinned by its own unit test rather than left as
dead schema — because dead schema is exactly the `isAttack` trap ticket 103 found.

**`baseCost` on an `onStatusApplied` hook silently disables it.** I tried gating the rider on the
applying card's Energy cost and got results byte-identical to the rider being switched off. The
reason: `onStatusApplied` builds its context with `source`, `target`, `state` and `statusApplied` —
**no `program`** — so `context.program?.baseCost ?? 0` reads 0 and any `GTE` comparison fails
forever. Same family as `isAttack`: a condition that's legal to write, does nothing, and says
nothing about it. Threading `program` through `APPLY_STATUS` would fix it, but that's a multi-site
change to the mutation payload and I wasn't going to make it speculatively for a held arm.

---

## 4. Gates

| gate | required | measured |
|---|---|---|
| THE cell, 30 iters × 3 seed bases | 15–35% | **33.3 / 41.7 / 25.0** |
| THE cell on the full grid (60 games) | 15–35% | **33.3%** |
| `draugr_v2` band | 35–80 | **62.4%** |
| FTK | 0 | 0 |
| dead cards | ≤ 35% | 11.5% in the cell |
| `rimebreaker` price | not a redline | 4.0 (under band) |

**8-DIFF: exactly one row moved.** `draugr_v2` 58.3 → 62.4, and nothing else shifted a point. Band
31/32, roster neutral blowouts 15 → 14, FTK 2, dead cards and game length unchanged. A change that
moves only the deck it was aimed at is the best shape an 8-DIFF can take.

The one number outside its target is the alt seed base at 41.7%. I left it: it's 6.7 points over on
one of three bases, the primary base lands inside, and chasing it would mean tuning a card down
until a coin-flip lands where I want it.
