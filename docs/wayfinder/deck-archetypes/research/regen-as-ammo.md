# Audhumbla drinks her own milk

- Type: wayfinder:implementation. **Ticket 101** — the rebuild you ruled the numbers for on
  2026-08-20. Branch `archetype-web`.
- **862 tests green**, `tsc` clean, build clean.

---

## 0. The short version

She had no clock and no choices. Ticket 94 found she owned **13 of the roster's 20 blowout
matchups**; your playtest said *"it felt hard to deal damage."* Ticket 103's light tuning got her
into the band but didn't fix either problem — her blowout count actually went *up*.

She now banks her healing and drinks it.

| | before | after |
|---|---|---|
| **her blowout matchups** | **8** | **0** |
| **ROSTER-WIDE neutral blowouts** | **30** | **15** |
| field | 39.9% | 47.1% |
| her game length | 8.67 turns | 7.04 turns |
| dead cards | 6.5% | 18.9% |

**The roster's neutral blowout count halved.** Not hers — the whole roster's. She owned eight of
them outright, and each one was also a 100% row on somebody else's line, so removing her eight
removed fifteen. Ticket 94 measured her as owning 13 of the roster's 20 absolutes and concluded she
had no clock; she has one now, and this is the single biggest improvement to roster health in the
whole arc.

---

## 1. What shipped

**`PRIMORDIAL_MILK`** replaces NOURISH_ROUTINE: *"Every heal card Audhumbla casts also grants her 3
Regen."*

**`morning_dew`** — 2 Energy, Light Skill: *"Gain 5 Regen."* The battery.

**`drink_deep`** — 2 Energy, Light Attack: *"Consume all your Regen and deal 15 Light damage per
stack consumed."* `sun_devourer`'s machinery pointed at Regen, at its price.

**Deck** (nine cards, four damage dealers): `pale_mercy`, `healing_light`, `sacred_spring`,
`morning_dew`, `drink_deep`, `smite`, `radiant_spark`, `dawnstrike` ×2. `purify` leaves.

One thing worth knowing about the mechanic, because it isn't obvious from the card text: **a Regen
stack is a TURN, not an intensity.** Ticket 34 made Regen a flat 3% of max HP per turn with stacks
as duration. So her pile is a *duration she's hoarding*, and drinking it trades "N more turns of 3%"
for "15N power right now." That's a cleaner hold-or-cash than intensity-stacking would have been —
the longer you wait, the more you're giving up by drinking.

It also means the OS grant is on a knife edge. Regen decays 1 stack per turn, so **3 per heal card
accumulates; 1 per heal card would exactly cancel and never bank anything.** That's the same
knife-edge ticket 34 found on huldra_v1 (2 per play won 79% of its matchup, 1 per play won 1%).

---

## 2. Choosing the arm: your criterion was drink-dependence, so I measured it

You left the damage-dealer count as a composition arm and said to ship *"the one that lands the band
with the least drink-dependence."* That's the right criterion — a deck that only wins when it draws
its payoff has one turn in it — but it needs a number, so `scratch/drinkcensus.ts` walks real games
and records what share of her damage `drink_deep` accounts for.

| arm | dealers | field | drink-dependence | blowouts |
|---|---|---|---|---|
| A2 | 2 | 32.2% | — | 2 |
| A3 | 3 | 34.2% | 67.8% | 3 |
| A4 | 4 | 32.5% | — | 3 |
| A3 ×2 drinks | 3 | 41.7% | — | 4 |

None of the base arms reached the band, so I went to the knobs you ruled — one change per run:

| arm + knob | field | drink-dependence | blowouts |
|---|---|---|---|
| A3 + OS 3 Regen | 56.2% | 77.2% | 1 |
| A3 + drink 20/stack | 54.9% | 78.1% | 0 |
| **A4 + OS 3 Regen** | **50.4%** | **67.9%** | 2 |
| A4 + drink 20/stack | 50.4% | 69.9% | 1 |

**The A4 arms are ten points less drink-dependent for the same field rate**, which is your criterion
answering the question cleanly. And raising the **battery** (the OS grant) rather than the **payoff**
(the drink's power) is the less drink-centric of the two knobs in principle as well as in
measurement: more Regen pays even in the games where she never draws the drink.

So: **A4, OS grant 3.** Final measured drink-dependence **67.6%**.

That number is still high in absolute terms — two-thirds of her damage comes from one card. I don't
think that's wrong for a deck whose whole identity is "hoard, then cash," but it's worth saying
plainly rather than burying: **she is a one-big-turn deck by construction now.** If that plays badly
in your hands, the fix is a fifth damage dealer, not a knob.

---

## 3. The pricing, and a card the scorer can't see

You asked me to seed `ASSUMED_CONSUMED_STACKS[Regen]` from the measured pile and expected ~6.

**Measured: mean 9.73, median 9, p90 16, max 22**, across 60 games. Higher than expected because
PRIMORDIAL_MILK grants 3 per heal card against Regen's 1-per-turn decay, so the battery fills faster
than a 2-per-heal version would. Seeded at **10**.

Before seeding, the pricer had no Regen entry at all and fell back to *one* stack — it read
`drink_deep` at **1.3** against a 5.2–6.5 band, a card it fundamentally could not see. With the
measurement in, it reads **4.2**.

That's still under the band, and I shipped it anyway. Two reasons:

- **Under-budget is not a redline** (the report only flags over-budget cards).
- **The sim disagrees with the pricer, and the sim is the better witness here.** `drink_deep` does
  **68% of her damage**. A card the pricer calls under-costed while it carries two-thirds of a
  deck's offence is a card the pricer is under-reading, not a weak card. Raising it to 20/stack
  would price in band — and would push her drink-dependence *up*, which is the thing you told me to
  minimise. I'd rather ship the ruled 15 and record the disagreement than tune the card to flatter
  the scorer.

`morning_dew` did need moving. At 1 Energy, **even 3 Regen prices over the ceiling** (3.2 against
3.0) — the pricer values Regen as healing, and 3% of a max-HP pool per turn isn't cheap. At 2 Energy
the band opens to 5.2–6.5 and 5 Regen lands at **5.4, in band**.

---

## 4. Gates

| gate | required | measured |
|---|---|---|
| band standard | 35–80% | **47.5%** |
| neutral blowouts | down | **12 → 0** |
| control matchup | ≥ 0.60 | **1.00** |
| FTK | 0 | 0 |
| dead cards | ≤ 35% | 18.9% |
| game length | down from ~11 turns | **7.04** |

Two tests needed re-pinning (`OSGapClosures.test.ts`), and what they now protect is worth naming:
the OS must fire on a heal **card** and must **not** fire on an engine flat heal. That matters more
than it did before — **Regen's own end-of-turn tick is an engine heal, and if the OS read it, the
pile would feed itself forever.** The `last_heal_power > 0` discriminator that ticket 56 introduced
for a completely different reason is what makes this rebuild loop-safe for free, so the tests now
pin it explicitly.

---

## 5. Two loose ends

**`purify` is now unused.** Ticket 103 reworked it into her shed card (remove Weakened and Dazed);
the rebuild removes it from her deck. It's still in the registry carrying its +0.3 budget overage
for nobody. Either revert it to its printed form or slot it back over a `pale_mercy` — your call,
and neither is urgent.

**Her dead-card rate went 6.5% → 18.9%.** That's the honest cost of a two-Energy battery and a
two-Energy payoff on a two-Energy frame: some turns she holds a card she can't afford alongside
what she's casting. Well inside the 35% gate, but it's a real change in texture and you'll feel it
as "sometimes I'm sitting on the drink."
