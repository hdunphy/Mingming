# Burn is permanent again, and the first cut at the 0/100 cells (ticket 93)

- Type: wayfinder:task - Henry-directed, 2026-08-19. Branch `archetype-web`.
- Status: **closed** (2026-08-19)

Three things: Henry's Burn change, the analysis of his full playtest, and the first pass at the
neutral absolutes he asked for.

Analysis: [research/playtest-round-1-full.md](../research/playtest-round-1-full.md).

## 1. Burn is permanent (Henry's call)

`BURN_CONFIG.decayPerTurn` 1 -> **0**, plus `firestorm_talon` **15 -> 10 power** as the compensation
he asked for. Measured before shipping (ticket 92): permanence alone put `hraesvelgr_v2` at 75.5%
with twelve >90% cells, entirely through that card's Burn multiplier. At 10 power she lands at
**66.8% with ZERO blowout cells** - a better spread than she had before the change.

Full grid at 30 iterations, permanence only:

| deck | before | after |
|---|---|---|
| **`draugr_v2`** | 36.7% | **60.6%** |
| `fenrir_v2` | 46.7% | **56.5%** |
| `hraesvelgr_v2` | 61.0% | 66.8% |
| `skoll_v2` | 37.5% | 36.8% |

**`draugr_v2` is the surprise and it is a good one.** Her payoff counts DISTINCT negative statuses,
and Henry's B2 note was that huldra's Sharp annihilates his Dazed stack for stack so the payoff read
4 damage. **Burn has no counter-status to annihilate against**, so a permanent Burn is a permanent
distinct status - his payoff now always counts at least one. The change he asked for on feel
happens to fix the mechanic he complained about.

Roster after: 0% cells 50 -> 51, 100% cells 48 -> **45**, out-of-band 297 -> 293, all 32 decks in
band, FTK unchanged at 2. 8-DIFF 8 rows, every one a Burn species.

**Two consequences worth knowing:**

- **The pricing model had to change.** `powerscale` priced Burn as a decay sum - a pile of N ticks
  N, N-1, ... 1 and stops - which is unbounded under permanence. `burnPricing.test.ts` proved it by
  hanging the suite in an infinite loop. Permanent piles are now priced over a fixed
  `BURN_PERMANENT_HORIZON_TURNS = 2`, chosen because it nearly preserves the price of a FULL pile
  (17.5% of a pool over its old life, 16% over the horizon) while correctly **doubling** the price
  of a single stack. The table moves `[4.5, 13.5, 28.5, 52.5]` -> `[9, 18, 30, 48]`.
- **Crossing the cap is now better than sitting on it.** Under decay, 5 stacks priced BELOW 4
  because the detonation spent a pile that was going to tick anyway. Permanent, what survives the
  detonation never wears off, so Burn is monotonic again. Two cards went 0.1-0.3 over budget
  (`fire_poke` 3.1, `frost_bite` 3.3) - noise-level, and correctly identified.

## 2. The playtest analysis

The headline is in the research doc and it is not what I expected: **fun tracked resource decisions,
not power.** The three decks Henry rated highest for real choices are the only three with a rule
that breaks the strict card hierarchy - `ymir_v2`'s one card a turn (**5/5**), `fafnir_v1`'s
bankable Energy (**4/5**), `hel_v2`'s HP-as-currency (*"the most fun"*). Everything he called boring
plays its hand in a fixed order.

Two admissions in there: I flagged `ymir_v2`'s play cap as a measurement artifact in ticket 85, and
it is the best-rated mechanic on the roster. And ticket 87 said ramp could not exist in this engine,
while `fafnir_v1`'s hoard **is** ramp, shipped, and fun.

Also recorded: **statuses are numerically invisible** - 2% per stack against a 25% cap is 1-2 damage
at level 15, which is what he measured by feel. That wants its own decision.

## 3. First cut at the 0/100 cells

**`audhumbla_v2` was one side of 18 of the 25 neutral absolutes**, so the pass starts there, and the
diagnostic is the most clear-cut in the project:

- Her OS is worth **+37.5** (40.3% live, **2.8%** with it off - 28 of 31 matchups under 10%).
- Her deck was **nine cards with exactly ONE damage source** (`dawnstrike`, 15 power). Everything
  else healed. NOURISH_ROUTINE converts healing into damage, so her entire offence was a firmware
  conversion of her sustain.
- That is why she has no middle: the result is decided by one inequality - opponent throughput
  against her heal rate. She beat the three lowest-damage decks 100% and lost 0% to anything with a
  real clock, over 11-17 turn games. It is also why Henry scored her **choices 1/5, "very boring"**:
  with one damage card and eight heals there is no decision to make.

**Shipped: `hallow` -> `smite`, `uplift` -> `radiant_spark`.** Two heals become damage; she keeps
five heals and her identity. Measured against the alternatives:

| arm | field | blowout cells |
|---|---|---|
| baseline | 40.3% | 17 |
| `hallow`->`smite` | 39.9% | 13 |
| **`hallow`->`smite` + `uplift`->`radiant_spark`** | **42.6%** | **11** |
| `healing_light`->`smite` | 30.9% | 15 |
| `uplift`->`falling_star` | 52.4% | 13 (and >90% cells UP to 7) |

`falling_star` makes her stronger rather than less binary, which is the opposite of the point.

**Result on the full grid: 40.3% -> 42.2%, her 0% cells 6 -> 5 and her 100% cells 3 -> 1.** Roster
neutral absolutes **13 + 12 -> 11 + 9**, out-of-band cells 293 -> 286, all 32 decks still in band.

## What is left of the 0/100 list

`audhumbla_v2` is still in 13 of the 20 remaining - the swap flattened the cliff, it did not remove
it, and she needs a second pass (her games still run 11+ turns). After her: `fafnir_v2` (4) needs a
payoff card rather than another stat point, `gullinbursti_v1`/`v2` (7 between them), `kraken_v1`
(2), `huldra_v1` (2).

851 tests. `tsc` clean. Note on the balance report: `matchupsAudited` jumped 67 -> 99 and the 2.3
redlines doubled because the all-subject deck report from ticket 85 is now being aggregated
alongside the suite - the ten OS-variance rows are each counted twice. Not new failures.
