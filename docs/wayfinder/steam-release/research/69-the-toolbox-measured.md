# The toolbox, built and measured: it cannot pay for itself in a four-turn fight

**Ticket:** [69](../tickets/69-neutral-market-slot.md) / [72](../tickets/72-rootfall-build.md) · **Built and measured:** 2026-08-30 · **Spec:** [69-toolbox-printings.md](69-toolbox-printings.md) · **Raw:** [`69-runs/`](69-runs/)

All five remaining printings exist, the firmware-pairing bug is fixed, the gauntlet verdict grades
the compound, and the held Tidewrack arms have been re-run with the counters purchasable.

**The verdict the hold was waiting on: giving the player Tidewrack's three ruled answers makes the
fight WORSE, not better** — and the reason is arithmetic rather than card design.

---

## 1. The measurement

Tidewrack's boss cell, n = 30 per arm, mixed-firmware sampling, paired seeds. `--toolbox` gives the
party the gym's three ruled answers (`riptide`, `short_circuit`, `reactive_plating`).

| arm | result | vs its own bare arm |
| --- | --- | --- |
| favourable, bare | **26.7%** (8/30) | — |
| favourable + toolbox | **16.7%** (5/30) | 4 flips to it, 7 away · **p = 0.549** |
| control, bare | **50.0%** (15/30) | — |
| control + toolbox | **43.3%** (13/30) | 1 flip to it, 3 away · **p = 0.625** |

Neither delta is significant, and the direction is the same in both: **down**. The cards are not
merely failing to help.

### Why — and it is one line

Telemetry, 8 samples per arm, same seeds. **Every figure here is the PLAYER's own output** — an
earlier draft of this table labelled it "total damage", which read as the boss's:

| | **player** damage / battle | attributed to cards | **residual (hooks + DoT)** |
| --- | --- | --- | --- |
| bare | 197 | 180 | 16.6 |
| **+ toolbox** | **129** | **110** | **19.5** |

**The three cards add 2.9 damage a battle and cost 70.** They are drawn and they are cast —
`riptide` 0.75, `short_circuit` 0.88, `reactive_plating` 0.63 casts per battle — and their combined
output is inside the noise of what the deck gave up to draw them.

And the boss's side of the same samples, which is the half that explains the size of the drop:

| | player dmg/turn | **boss dmg/turn** | turns |
| --- | --- | --- | --- |
| bare | 47.7 | 46.9 | 4.1 |
| **+ toolbox** | **30.4** | **55.8** | 4.3 |

The toolbox cuts the player's rate by 36% **and raises the boss's by 19%** — because a deck that
kills nothing leaves all three boss bodies swinging. That asymmetry, not the dilution alone, is the
ten points of win rate.

`reactive_plating` is the clearest case: Sharp granted per battle goes **1.3 → 1.4**. Its cap is 3
a turn and it is nowhere near it.

### The mechanism is amortisation, not power

A 3-member party draws ~7 cards a turn and this fight lasts **4.3 turns**, so the deck sees ~30
cards. Three 2-energy installs into an 18-card deck is a **17% dilution** of every draw, paid on
turn 1–2, against a boss that has removed the party by turn 4. An installed answer has one or two
turns to earn 2 energy back, and none of them do.

This is the same finding the hand-built deck produced from the other side (13.3%, [the hand-built
arm](72-the-handbuilt-tidewrack-arm.md)) and it now has a controlled number attached: **the counters
are not underpowered, they are mistimed.** Nothing about their *effects* is wrong.

### 1.1 The scoping fix landed, and it barely moved the win rate — here is why

`CARDS_DRAWN_TRIGGERED` went per-Mingming in the previous session, and it did exactly what it was
supposed to do to the boss's engine card:

| boss `ink_stream` | before scoping | now |
| --- | --- | --- |
| damage per cast | 52.9 | **20.2** |
| triggered draws counted per cast | 6.6 | **2.5** |

**A 62% cut to the card that was 49% of the winning deck's output — and Tidewrack's win rate moved
23.3% → 26.7%.** That is not a contradiction, and the reason is structural enough to be worth
keeping:

| | boss dmg/turn | turns | **boss damage / battle** |
| --- | --- | --- | --- |
| before scoping | 55.8 | 3.5 | **195** |
| after scoping | 46.9 | 4.1 | **194** |

**Total boss damage is flat.** It has to be: the boss swings until someone dies, so its total
converges on the player's HP pool whatever its rate is. Cutting the rate bought *turns*, and turns
are handed to **both** sides.

The pools and rates are what make that near-neutral:

- boss HP pool **240**, player HP pool **235** — within 2%;
- player **47.7** dmg/turn, boss **46.9** — within 2%;
- the player takes 82% of the boss's pool; the boss takes 83% of the player's.

**This fight is a knife-edge race between two nearly identical sides.** A proportional damage nerf
lengthens it symmetrically and changes how long the coin takes to land, not which way it lands. It
took 8.9 points off the boss's rate for 3.4 points of win rate.

**The lever that moves this fight is asymmetry**, and the data already names two: *removing a body*
(cuts their rate, not yours — the mechanism behind the 73% control deck in the three-gym table) and
*raising the player's rate*. The toolbox arm is the same law running backwards — it cut the player's
rate and raised the boss's, and lost ten points.

Worth stating plainly for the knob decision: **the scoping fix nerfed Tidewrack ~16% on its rate for
free, and that is most of what a proportional nerf has to give.**

### What this does and does not decide

- It **does** rule out "Tidewrack is fine once its counters exist". They exist, they are stocked,
  they are cast, and the fight gets harder.
- It **does not** grade the printings for the other two gyms. Emberfall's and Rootfall's answers
  (`discharge`, `hamstring`; `scrubber`, `vent`, `drip_feed`) are untested in a fight — and both of
  those gyms are longer (4.4 and 5.6 turns), which is exactly the variable that broke here.

### The two knobs, and this is Henry's call

1. **Re-cost the installs to 1 energy**, or give them an effect on the turn they land. The doc's knob
   ranges are about power; this says the problem is *cost and timing*, which is outside them.
2. **Bring Tidewrack's damage down** until a 4-turn fight becomes a 6-turn one — but see §1.1
   first, because a proportional damage nerf has just been measured and it is nearly win-rate-neutral.
   The lever that works here has to be **asymmetric**.

They are the same question from two ends. **Nothing here supports a knob round on the cards' power
numbers** — a bigger `riptide` still arrives too late.

---

## 2. What was built

### 2.1 The five printings

| card | cost | type | effect |
| --- | --- | --- | --- |
| `reactive_plating` | 2e | Daemon · Uncommon | an ally hit by an enemy attack gains 1 Sharp; **max 3 per turn, team-wide** |
| `discharge` | 1e | Skill · Uncommon | remove up to 4 Strengthened from the target; 1 Burn per 2 removed |
| `scrubber` | 2e | Daemon · Uncommon | end of your turn, remove 1 Poison from each ally |
| `vent` | 0e | Skill · Common | remove 3 Poison from an ally |
| `drip_feed` | 2e | Daemon · Uncommon | end of your turn, each **poisoned** ally gains 1 Regen |

All None, all in `MARKET_NEUTRAL_UTILITY`, all printing their own numbers. `discharge` is the
renamed Overheat — `overheat` is a live 3e Fire attack and the collision is now pinned by a test.

### 2.2 Three engine additions, each the smallest that would do

1. **Capped removal records what it actually took.** `consume` was all-or-nothing, so "remove up to
   N, then pay off the amount removed" was inexpressible. A negative-stack `STATUS` now writes
   `lastStatusConsumed`, which makes `STATUS_CONSUMED` work after a capped removal exactly as it
   already worked after a consume. `discharge` against a target holding 2 Strengthened pays 1 Burn,
   not 2.
2. **Scaled stack counts are floored.** A no-op for every card that predates it (all integer × integer);
   what it buys is a ratio below 1, which is how "1 Burn per 2 removed" is printed.
3. **`targetHasStatus`, a per-target filter on hook actions.** `target: 'ALLIES'` resolves a *group*
   and a `when` clause tests the *context's* target, so "each **poisoned** ally" had no expression.

### 2.3 `vent` is `target: 'Self'`, and that is not a typo

`TacticalAI` aims a `Single` card with no HEAL action at the **enemy** party. A `Single` printing of a
cleanse would have the AI removing the boss's poison. `Self` puts the whole player party in the
candidate set and the action's `TARGET` resolves to the chosen ally.

**This is worth a look beyond this ticket: `overgrowth` (Nature, "Apply 3 Regen", `Single`, no HEAL
action) has exactly that shape today** and appears to hand the enemy 3 Regen. Not touched — it is a
live card outside this brief.

---

## 3. Harness fixes

### 3.1 The firmware-pairing bug

`drawFromElement` picked every slot as `firmwares[index % firmwares.length]` with the **same index**,
so an arm was all-v1 on even samples and all-v2 on odd ones and a mixed team was unreachable. Each
slot now reads a different **bit** of the sample index, so three members enumerate all eight v1/v2
combinations across samples 0–7. Measured: **2 distinct lineups → 8, six of them mixed.**

A second modulus would only produce alternating pairs — two more fixtures rather than a sample.
`blind` is untouched (it goes through `lineupFor`), so every pre-ruling number still reproduces.

**This is the mechanism behind the whole per-deck split in the three-gym table.** n = 30 was never
thirty decks; it was two decks fifteen times, and the v1 firmwares happen to share a draw-and-cantrip
idiom, so an all-v1 team was *accidentally* synergistic.

### 3.2 The gauntlet is graded on its compound

Ratified in the spec. `measureBand` now grades `gauntletCompound()` — **and only when all three
fight cells were measured**; a compound over a partial cell set is not a clear rate, and reporting a
single boss cell as "the chance of clearing all three fights" would be a worse misreading than the
one this fixes. With a partial set the band falls back to the pooled rate and says so in the report.

Pinned by a test that the Emberfall figures (83.3 / 90.0 / 80.0, product **60.0%**) now PASS, that a
genuinely unclearable gauntlet still FAILS, and that the single-fight bands are untouched.

### 3.3 A silent options bug — and the guard for its whole class

`handbuilt` and `toolbox` were declared on `MeasureOptions`, parsed from the CLI, printed in the
report banner — and **not passed at the one `sampleFight` call inside `measureCell`**. `--toolbox`
printed *"TOOLBOX ARM"* and measured the bare arm for thirty battles. `tsc` was happy (optional
parameters), lint was happy, the whole suite was green.

It was caught only because the toolbox arm came back **byte-identical** to the arm it was supposed to
differ from — a tell that exists only because the seeds are paired, and one that would be invisible
in any unpaired measurement.

`optionsThreading.test.ts` now asserts that each option reaches the built setup, by diffing the deck
rather than playing battles, and is written over the option list so a future option forgotten at the
call site fails there rather than in a run report.

**`--handbuilt` was inert on the merged tree for the same reason**, so any hand-built arm run since
the merge measured the generated arm. The 13.3% figure predates it and stands.

### 3.4 The loop audit, rewritten around the real property

The first draft accepted only a counter guard and flagged two shipped daemons that are in fact safe.
That was the audit being wrong. Three guard shapes are live in the tree, and they work the same way —
**the fed-back event cannot satisfy the condition that admitted the first one**:

- a **counter guard** (ROOT ROT's SIDE-scoped re-entry flag);
- a **`statusApplied` filter naming a different status than the one applied** (`cinder_armor_daemon`
  triggers on Burn, applies Sharp);
- **`isToken: false` when the thing generated is a token** (`echo_chamber_v2`).

The audit tests that property, carries a self-test so it cannot pass vacuously, and includes a
synthetic unguarded daemon it must still catch. The "creates no cards" law is scoped to the toolbox,
where it belongs: `echo_chamber_v2` does generate cards, safely, and is not in scope.

---

## 4. Gates

`eslint` 0 · `tsc -b` · `vite build` · **150 files / 2,075 tests** · `liveness.ts` all-LIVE · loop
audit clean · pin test updated to read `GYM_COUNTER_ANSWERS` rather than a second copy of the list.
