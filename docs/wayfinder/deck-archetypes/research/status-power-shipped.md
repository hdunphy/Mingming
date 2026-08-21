# Statuses now add POWER — what shipped, and what it did to the roster

- Type: wayfinder:research + implementation. **Ticket 102.** Branch `archetype-web`.
- Henry, off ticket 95's grid: *"I like this change. I think we should implement it to the plus
  one power per stack of status. After you've done that, rework the pricing table and arithmetic
  as well as the valuation. Then tell me all the cards that red line that are either too far above
  their Target or below their Target, and rerun the 1v1 matchups to see which decks are now
  overpowered with this change or underpowered."*
- **851 tests green, `tsc` clean.** Full 960-cell grid re-run. Nothing else in the engine moved.

---

## 0. If you read one section

The change works, and it works about twice as hard as intended.

Statuses used to be a **percentage of your damage** — 2% per stack, capped at ±25%. At level 15
that was one or two points, which is why you couldn't feel them. They are now **flat power**: one
stack of Strengthened is +1 power on the card you play, and there is no cap. A 1-Energy attack has
about 40 power, so ten stacks is a quarter of a card's worth of damage stapled onto every attack
you make.

Three things came out of the re-run:

1. **Nothing about card PRICING changed.** Not one of the 210 priced cards moved by a single
   point. That is not a bug — it is the finding. No single card grants more than 5 stacks, and the
   old cap only bound at 13. The pricer has never been able to see the thing that actually matters
   here, which is what a deck *piles up over a turn*.
2. **Sleipnir v1 broke.** He went from 35.6% across the field to **83.9%** — the single largest
   move any deck has made in this project. His OS hands him 2 Strengthened every time he plays a
   0-Energy card, and 5 of his 12 cards cost 0. Ticket 95's grid predicted 85.5% and named this
   exact risk. It is not a surprise; it is the bill.
3. **The roster got more polarised, not less.** 32 of 32 decks were inside the healthy 35–80% band
   before. 28 of 32 are now. And the matchups that end 0% or 100% between decks with no type
   advantage — the ones that are genuinely broken rather than just lopsided — went from 20 to 34.

My recommendation is at the bottom: keep POWER, but bound how many stacks a deck can *generate*
in a turn, which is the thing ticket 95 said had to happen first and which I have not done yet.

---

## 1. What actually changed in the code

Three places, all behind one switch so it can be reverted or re-tuned in one line.

**`src/engine/core/Hooks.ts`** — the model itself:

```ts
export const STATUS_MODEL: StatusDamageModel = {
    shape: 'POWER',        // was 'PERCENT'
    pctPerStack: 0.02,     // kept, unused under POWER
    pctCap: 0.25,          // kept, unused under POWER
    powerPerStack: 1,      // Henry's pick
};
```

**`src/engine/combatUtils.ts`** — the arithmetic. The four duality statuses now resolve to a
single power adjustment applied **before** the damage divisor, which means it rides type advantage
and resistances like any other power (the ticket-26 law), instead of being a flat multiplier
bolted on at the end:

```ts
const statusPower =
      (myStrengthened - myWeakened)          // buffs and debuffs on the attacker
    + (theirDazed - theirSharp);             // and on the target
const effectivePower = Math.max(0, power + statusPower);
```

The `Math.max(0, …)` is the only floor: statuses can reduce an attack to zero damage but never
negative. There is no ceiling, which was the whole point.

**`src/debug/balance/powerscale.ts`** — the pricing table, re-derived. Under PERCENT a stack was
priced as a share of a horizon's damage; under POWER it is priced as power delivered over the
attacks it will survive for. I set that horizon at **5 attacks** (roughly two attacks a turn over a
two-and-a-half turn life), so an offensive stack prices at 5 power and a defensive one at 3.5.

**`src/engine/ai/TacticalAI.ts`** — the valuation. The AI used to value a stack as a capped
percentage of the target's max HP. It now values it as the fraction of a card that the power
represents:

```ts
fraction = (powerPerStack * stacks) / (POWER_PER_CARD * CARDS_PER_TURN);  // 40 power, 2 cards
```

Linear, uncapped, and it keeps paying — so the AI will now actually stack, rather than topping out
after 13 and moving on.

Four tests in `StatusCombat.test.ts` were re-pinned, and the re-pinning is worth reading because
it is the change in one line each: one stack at 40 power now rounds to 3 damage instead of 2; the
test that used to assert "the cap holds" now asserts "more stacks keep paying"; and the test that
used to check the negative-damage deadlock now checks that damage floors at 0.

---

## 2. The cards that red-line — and the finding hiding underneath

You asked for both ends: too far above target and too far below. Here it is. 210 priced cards:
**44 over budget, 55 under, 111 in band.**

### Worst over budget

| card | cost | scores | band | over by |
|---|---|---|---|---|
| `contagion` | 2e | 20.4 | 5.2–6.5 | **+13.9** |
| `umbral_feast` | 1e | 14.9 | 2.4–3 | **+11.9** |
| `hexbloom` | 2e | 16.5 | 5.2–6.5 | **+10.0** |
| `sun_devourer` | 2e | 8.4 | 5.2–6.5 | +1.9 |
| `stunning_strike` | 2e | 8.4 | 5.2–6.5 | +1.9 |
| `entangle` | 3e | 12.1 | 8.4–10.5 | +1.6 |
| `sleep_powder` | 1e | 4.5 | 2.4–3 | +1.5 |
| `lumen_surge` | 1e | 4.5 | 2.4–3 | +1.5 |
| `corrosive_leak` | 0e | 2.3 | 0.8–1 | +1.3 |

The top three are in a different league from everything else, and the remaining 35 over-budget
cards are all within about 1 point of their band — the long tail is a rounding argument, not a
balance problem.

### Worst under budget

| card | cost | scores | band | under by |
|---|---|---|---|---|
| `wither_feast` | 2e | **−10.8** | 5.2–6.5 | **−16.0** |
| `core_overclock_daemon` | 2e | 0.0 | 5.2–6.5 | −5.2 |
| `reprogram` | 2e | 0.0 | 5.2–6.5 | −5.2 |
| `einherjar_standard` | 2e | 0.0 | 5.2–6.5 | −5.2 |
| `hoarders_cache` | 2e | 0.0 | 5.2–6.5 | −5.2 |
| `glass_cannon` | 1e | −2.7 | 2.4–3 | −5.1 |
| `desperate_strike` | 0e | −3.1 | 0.8–1 | −3.9 |
| `dark_pact` | 0e | −3.1 | 0.8–1 | −3.9 |
| `slander` | 2e | 1.5 | 5.2–6.5 | −3.7 |
| `battery_pack` | 4e | 4.9 | 8.4–10.5 | −3.5 |

The four cards scoring **exactly 0.0** are the honest ones: the pricer has no rule for what they
do at all. `reprogram`, `hoarders_cache`, `core_overclock_daemon` and `einherjar_standard` are card
draw and deck manipulation, and the scorer values draw at nothing. That is a known gap, and it is
the same gap behind your "card draw and statuses are supposed to be another resource" note — a
resource the pricer cannot see is a resource that will always read as free.

The negative scores (`wither_feast`, `glass_cannon`, `desperate_strike`, `dark_pact`) are cards
whose costs the pricer charges for and whose upside it does not: they pay HP or discard, and get
credited nothing back.

### The finding: no card price moved. At all.

I built `scratch/priceshapediff.ts` to price the whole registry under both shapes in one process
and diff it. The result:

```
priced under PERCENT: 210   under POWER: 210
cards whose SCORE moved: 0
```

Zero. And the instrument is not broken — running it as POWER+1 against POWER+2 moves 63 cards, so
it detects change when there is change.

The reason is worth stating plainly, because it is the most useful thing in this report:

- The old cap bound at **13 stacks** (25% ÷ 2% per stack).
- **No single card in the game grants more than 5 stacks.**
- So when the pricer asked "how much of this card's stacks actually count?", the answer was always
  "all of them", under both shapes. The cap never applied *per card*.
- And I deliberately derived the new POWER constants to land on the same numbers at +1 per stack,
  so the arithmetic agrees too.

**Which means the repricing risk was theoretical, and the per-card pricer still cannot see the
real problem.** Sleipnir did not break because any one of his cards is mispriced. He broke because
five cheap cards *each* granting 2 stacks add up to a pile no single-card view will ever notice.
The pricing table is fine. It is measuring the wrong unit.

---

## 3. The 1v1 re-run — who got overpowered, who got left behind

Full 960-cell grid, before and after. Field win rate is a deck's average across the whole roster;
healthy is 35–80%.

### Decks that gained

| deck | before | after | change |
|---|---|---|---|
| **`sleipnir_v1`** | 35.6% | **83.9%** | **+48.2** |
| `ratatoskr_v2` | 40.4% | 64.1% | +23.7 |
| `gullinbursti_v1` | 50.6% | 65.1% | +14.6 |
| `hraesvelgr_v1` | 42.7% | 54.6% | +11.9 |
| `huldra_v1` | 55.3% | 63.1% | +7.8 |
| `fenrir_v1` | 38.7% | 44.9% | +6.2 |
| `gullinbursti_v2` | 37.6% | 43.6% | +6.0 |

### Decks that lost

| deck | before | after | change |
|---|---|---|---|
| `audhumbla_v1` | 66.4% | 53.6% | −12.8 |
| `nidhoggr_v1` | 66.3% | 53.6% | −12.7 |
| **`audhumbla_v2`** | 42.2% | **31.2%** | −11.1 |
| `nidhoggr_v2` | 66.5% | 57.4% | −9.1 |
| `hraesvelgr_v2` | 65.9% | 57.6% | −8.3 |
| `ymir_v2` | 66.7% | 59.5% | −7.2 |
| `ratatoskr_v1` | 42.2% | 35.0% | −7.2 |
| `jormungandr_v2` | 52.2% | 45.0% | −7.2 |
| **`kraken_v2`** | 35.6% | **29.7%** | −5.9 |

### Out of band now

Every one of the 32 decks was inside 35–80% before this change. Four are not any more:

| deck | field | verdict |
|---|---|---|
| `sleipnir_v1` | **83.9%** | overpowered — the runaway |
| `skoll_v2` | 34.3% | underpowered, marginally (was 36.5%, already borderline) |
| `audhumbla_v2` | 31.2% | underpowered — pushed out by this change |
| `kraken_v2` | 29.7% | underpowered — pushed out by this change |

The losers all lost for the same reason and it is not a nerf to them: **they are the decks that
don't play statuses.** Audhumbla, Nidhoggr, Kraken v2 and Ymir v2 win on shields, heals and raw
attacks. When statuses got twice as valuable, everything they don't do got better, and they got
worse by standing still. Nidhoggr v1 and Audhumbla v1 dropping from 66% into the low 50s is
arguably a *good* outcome — those were the top of the roster and they came back toward the middle.
Kraken v2 and Audhumbla v2 falling out the bottom is not.

### Where Sleipnir's 48 points came from

Not from one matchup. From nearly all of them:

| Sleipnir v1 vs | before | after |
|---|---|---|
| `audhumbla_v1` | 8.3% | **90.0%** |
| `valkyrie_v2` | 20.0% | **91.7%** |
| `fafnir_v2` | 15.0% | **86.7%** |
| `gullinbursti_v2` | 26.7% | **98.3%** |
| `huldra_v2` | 8.3% | **78.3%** |

A deck that was losing 8–20% of the time now wins 78–92%. That is not a tuning problem, it is a
different deck.

---

## 4. The absolutes got worse — the real cost

The stat I watch most closely is **neutral absolutes**: matchups that end 0% or 100% between two
decks with *no* type advantage either way. Typed blowouts are intended (that's what type advantage
means, and 3v3 has no switching). Neutral blowouts are bugs.

| | before | after |
|---|---|---|
| neutral 0% cells | 11 | **15** |
| neutral 100% cells | 9 | **19** |
| total neutral absolutes | **20** | **34** |
| all-buckets 0% | 49 | 42 |
| all-buckets 100% | 42 | 53 |
| FTK (first-turn kills) | 2 | 2 |

Nine old absolutes resolved — including the `gullinbursti_v1` ↔ `fafnir_v2` wall that ticket 94
declared untunable, which is a genuine win and was ticket 95's headline argument for POWER. But 23
new ones appeared, and they cluster exactly where you'd predict: `huldra_v1`, `audhumbla_v2`,
`gullinbursti_v1`, `sleipnir_v1`, `ratatoskr_v2` — the status decks and the decks with no answer
to them.

This is the honest cost of amplifying the currency. Making statuses matter makes the gap between
"applies statuses" and "doesn't" into a bigger gap, and at the extremes that gap becomes a wall.

---

## 5. The measurement the pricer was missing

Since the per-card view proved blind, I built `scratch/stackcensus.ts` to walk real games and
record what the piles actually reach. Mean is the pile at the *start* of my turn, before that
turn's cards go down; peak is the largest pile seen.

| deck | status | mean | peak |
|---|---|---|---|
| `sleipnir_v1` | Strengthened (self) | 4.85 | **24** |
| `huldra_v1` | Weakened | 6.00 | 20 |
| `ratatoskr_v2` | Dazed (on target) | 4.91 | **20** |
| `audhumbla_v2` | Sharp | 1.90 | 22 |
| `kraken_v2` | Sharp | 1.22 | 23 |
| `gullinbursti_v1` | Weakened | 1.82 | 12 |

Read the peaks against a 1-Energy attack's ~40 power. **A 24-stack pile is +24 power — sixty
percent of a whole extra card, on every attack, for free.** That is the number the per-card pricer
cannot see, because it arrives 2 stacks at a time from five different cards.

The mean matters too: Sleipnir carries ~5 stacks into every turn *before* he plays anything, and
his whole turn is 0-cost cards that each add 2 more.

---

## 5b. The other three items on ticket 102's blast-radius list

The ticket's rule is that all four re-derives ship together or the sim lies. Items 1 (pricing) and 3
(AI valuation) are in section 1. The other two:

**Item 4 — the tooltips were lying, and now they cannot.** `statusGlossary.ts` still read *"Deals
2% more damage per stack, up to +25% at 13 stacks"* for all four duality statuses. That is the
ticket-90 failure repeating: a hand-written tooltip goes stale silently and then misinforms the
player. The four descriptions are now **derived from `STATUS_MODEL`** rather than written out, so
they cannot drift from the engine again. Live text:

> **Strengthened** — Deals 1 more POWER per stack — no cap, and it rides type advantage and
> resistances like a card's own power. A typical 1-Energy attack is about 40 power, so ten stacks is
> a quarter of a card. Permanent, but incoming Weakened cancels it stack for stack.

**Item 2 — `CLEANSE_POWER` re-measured, and it holds at 10.** This was the one place un-clamping
could bite: ticket 46 derived the cleanse price from a measured *median debuff load* of 15 power,
and that measurement was taken while `streamStacks` still clamped a pile at 13. A 24-stack pile now
values at 24 instead of 13, so the load could have inflated. `scratch/cleansecensus.ts` re-samples
it (270 games, 2,481 side-turns, every held debuff valued through `statusPileValue`):

| | ticket 46 (PERCENT) | now (POWER) |
|---|---|---|
| carrying a debuff | 63.3% | 43.2% |
| **median load when loaded** | **15 power** | **10.5 power** |
| p25 / p75 | 7 / 38.5 | 7 / 28 |

The median did **not** rise. `CLEANSE_POWER = 10` is still at or just under the measurement, which
is where Henry wanted it, so **no change ships**. Caveat on the frequency row: my sampler uses each
species' first OS and half the games ticket 46 used, so 63.3% → 43.2% is very likely instrument
difference rather than a real drop. The median is the number that matters and it is the number that
held.

---

## 5c. Did the 24 single-resource decks get a second resource for free?

That was the thesis behind shipping this at all. Ticket 99 found that Henry's three favourite decks
each have a second thing to spend besides Energy, the four he called boring have none, and **24 of
32 decks are single-resource**. A duality pile you build, hold and cash is a second resource — so if
statuses became real, most of that backlog should fix itself.

`scratch/secondaxis.ts` reads it structurally rather than by win rate: how much of each deck
actually touches a duality status.

**20 of the 24 backlog decks touch a duality pile.** On the headline number the thesis holds. But
the tail is thin, and the tail is where it matters:

| tier | decks | stacks a full deck can mint |
|---|---|---|
| **a real pile** (≥6) | `gullinbursti_v1` 24, `gullinbursti_v2` 22, `skoll_v2` 17, `fafnir_v2` 16, `huldra_v1` 14, `draugr_v2` 11, `ymir_v1` 8, `hel_v1` 8, `skoll_v1` 6, `ratatoskr_v2` 6, `valkyrie_v1` 6 | **11 decks — genuinely gained an axis** |
| **a token** (1–4) | `fenrir_v1` 4, `sleipnir_v1` 4, `valkyrie_v2` 4, `huldra_v2` 2, `nidhoggr_v1` 2, `nidhoggr_v2` 2, `fenrir_v2` 1, `kraken_v2` 1, `jormungandr_v1` 1 | 9 decks — one card is not a resource |
| **nothing at all** | `audhumbla_v2`, `jormungandr_v2`, `kraken_v1`, `ratatoskr_v1` | 4 decks — the change did nothing |

So the honest score is **11 of 24 clearly better off, 9 nominally, 4 not at all** — not "most get
real choices for free", but a real dent in the backlog for one engine change.

And it explains the losers exactly. `audhumbla_v2` (0 duality cards, fell to 31.2%) and `kraken_v2`
(1 stack in the whole deck, fell to 29.7%) are the two decks that fell out of band, and they are
sitting in the bottom two tiers of this table. They did not get nerfed; the currency was revalued
and they hold none of it. `ratatoskr_v1` (0 cards, −7.2 points) is the same story one tier up.

**That makes the fix for those four a design fix, not a numbers fix** — give each a card that reads
or clears a pile, and they are participating in the new economy instead of being taxed by it.
`audhumbla_v2` already has ticket 101 open for exactly this kind of rework (Regen as ammo), which
now has a second, independent reason to happen.

---

## 6. What I recommend

**Keep POWER +1. Bound the generation.** This is the condition ticket 95 attached to the
recommendation and it has now been demonstrated rather than predicted.

The lever is *not* a cap on the stack count — you've been clear that arbitrary caps are not a
design shape you want, and capping the effect is precisely what made statuses invisible in the
first place. The lever is on the **source**: `sleipnir_v1`'s MOMENTUM_DRIVE grants 2 stacks per
0-cost card with no condition on it at all, and his deck is built to trigger it five times a turn.
Candidate shapes, in the order I'd try them:

1. **Make the OS trigger less often** — grant on the *first* 0-cost card each turn rather than
   every one. Preserves the deck's shape and the "0-cost cards are my engine" identity; removes the
   multiplication.
2. **Make it grant less** — 1 stack instead of 2. Simplest, but halves an engine that was tuned
   around 2 and doesn't address decks that hit the same pile a different way.
3. **Give the stacks a reason to leave** — spend-on-attack, so Strengthened is a resource you cash
   rather than a pile you sit on. Biggest change, best long-term shape, touches every duality
   status not just Sleipnir's.

Separately, and per section 5c: `kraken_v2` (29.7%), `audhumbla_v2` (31.2%), `ratatoskr_v1` (35.0%)
and `jormungandr_v2` (45.0%) hold none of the new currency. The fix is not a numbers buff — it is
one card each that reads or clears a pile. `audhumbla_v2` has ticket 101 open for exactly that.

**I have shipped none of this.** The four decks are out of band as of this commit, and the
generation bound is the next ticket, not this one.

---

## 7. What I'd want measured before the next move

- **The tug-of-war is untouched.** `draugr_v2` vs `huldra_v1` was bad under every arm ticket 95
  tried. It still needs the cancel rule or a second lever for Draugr — a denomination change was
  never going to fix it.
- **The 0.0-scoring cards** (`reprogram`, `hoarders_cache`, `core_overclock_daemon`,
  `einherjar_standard`) are a pricer gap, not a card problem. Pricing draw is its own ticket and
  ties directly into your "card draw is another resource" note.
- **Nothing here is a low-iteration read.** The grid is 60 games per cell, both turn orders, and
  the deck-level numbers average 30 cells each. The card audit is deterministic arithmetic. The
  stack census is the softest number in the report at 24 games per deck — treat the means as solid
  and the peaks as "at least this big".
