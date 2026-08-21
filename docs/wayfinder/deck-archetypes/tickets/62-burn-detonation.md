# Burn detonation rework (ticket 62): the overflow finally pays — Henry's original design, with the self-limiter it was missing

- Type: wayfinder:task — Henry-approved design (2026-08-14, off ticket 58's Fire
  investigation). This ticket IS the implementation brief; implementing session flips it
  closed and appends its Resolution.
- Status: **CLOSED** (2026-08-15) — shipped `DET-C4-D14` on Henry's pick
- Assignee: implementation agent (grid)
- Blocked by: run AFTER ticket 61 (one worker per tree; 61 re-baselines first).
- DEEP-PHASE POLICY binds. Branch card-dev; author `Henry Dunphy <hdunphy15@gmail.com>`;
  line-ending law; locks → `_to_delete/git-locks/`.

## Context

Ticket 58 measured: 32.1% of ALL Burn applied roster-wide is wasted at the 3-stack cap,
and `BURN_OVERFLOW_PERCENT = 0.01` floors to zero on every current frame — 0 damage paid
on 54,767 requested stacks. The mechanic's history is in the BurnBehavior comment block:
overflow originally paid 0.08 (full max-tier rate) PER EXCESS STACK with the target
staying at cap, which let decks farm a capped target forever — measured as ~half of
fenrir_v2's output, turn-3 games. It was floored to zero instead of redesigned. Henry's
redesign restores the burst WITH the self-limiter the old version lacked: **detonation
resets the pile, so detonation rate is bounded by application rate ÷ 3, not by every
excess cast.**

## Part 1 — the mechanic (`src/engine/StatusBehaviors.ts`, `BurnBehavior.onApply`)

New rule, replacing the current overflow branch:

- `total = currentStacks + incomingStacks`. **While `total > 3`: one DETONATION fires and
  `total -= 3`.** Remaining `total` is the new stack count.
  - 3 existing + 1 incoming = 4 → one detonation, 1 stack remains.
  - 3 + 4 = 7 → TWO detonations, 1 remains. 3 + 3 = 6 → one detonation, 3 remain (6−3=3,
    not >3 — exactly-divisible stays at cap).
  - Single-stack appliers (`ignite`) therefore detonate at most every 3rd cast into a hot
    target — the rebuild rhythm is the balance mechanism; do not special-case them.
- **Each detonation deals `floor(maxHp × D)` immediate damage to the BURNED entity** —
  %-denominated (level-proof by construction, same as the tick), bypasses defense like
  the old burst did. `D` is the sweep value (Part 2); implement as one constant
  `BURN_DETONATION_PERCENT`.
- **SYMMETRIC (Henry's ruling): self-applied Burn detonates on yourself.** No
  source-dependent branch — the burned entity takes the detonation, full stop.
  `pyre_sacrifice` becomes a managed bomb; `ash_communion` becomes its release valve
  (eats stacks pre-detonation) WITHOUT any text change — do not touch ash_communion,
  its scorer price, or any card this ticket.
- Tick tiers, 1-stack/turn decay, and the cap of 3: **UNTOUCHED.**
- Log per detonation: `  🔥 {target} — Burn overload! Detonation deals {n} damage`.
- Rewrite the BURN_OVERFLOW_PERCENT comment block: keep the 0.08 history, add the
  rev-note that detonation-with-carry is the redesign and why the reset bounds it.
- `docs/power_curve_spec.md`: append the Burn detonation rev note to the Burn passage
  (match the file's endings).

## Part 2 — the sweep, then ship one value

Arms: **D ∈ {0.04, 0.06, 0.08}** (all pre-approved; anything else → STOP). In-memory per
arm, ticket-60 style. Instrument per arm: field rows for **fenrir_v2, skoll_v2,
hraesvelgr_v2, draugr_v2** (every Burn applier), detonations/game per deck,
self-detonation damage taken (fenrir_v2 — the symmetric rule's cost, report it
explicitly), mirror turns, **FTK (hard 0 in every arm)**.

**Shipping rule:** pick the D that moves skoll_v2 and fenrir_v2 furthest INTO 0.35–0.80
subject to: hraesvelgr_v2 ≤ 0.80 and FTK 0. Confirm the shipped arm at 30 iterations
(`0-DECISION-GRADE`). Predicted shapes (guides, not gates): skoll_v2 +2-3 detonations/game
≈ +12-14 HP; fenrir_v2 is the volatile one (53.8% waste becomes fuel, molten_core's 64%
waste becomes its function). **If fenrir_v2 overshoots the window at every D, or no D
satisfies the rule → STOP with the table; that is Henry's session, not a knob.**
draugr_v2 (0% waste, 2-stack applications) should not move beyond noise — if it does,
report why before committing.

## Part 3 — gates, docs, commit

Unit tests (LF): detonation count math (4 / 6 / 7-stack cases above), carry correctness,
symmetric self-burn, log lines, and the old zero-overflow tests updated. `npx tsc -b` ·
`npx vitest run` (suite AFTER last edit) · `npx vite build` · scoped runs:
`BALANCE_ONLY=fenrir`, `=skoll`, `=hraesvelgr` (all bands: control ≥0.60, dead ≤0.35 both
sides, mirror ≥60% ≤30 turns, FTK 0; §2.3 diagnostic-only). Full `npm run balance`;
8-DIFF the table — Burn touches four species, everything else stays inside noise; the
control applies no Burn, so control rows must NOT move. ONE commit: engine + tests +
spec note + report + ticket Resolution + map line + HANDOFF refresh (include: floor-list
membership is now decided at 150 iterations — the fenrir_v1 seed-spread finding). Message:
`Burn detonation (ticket 62): overflow pays again - D% maxHp per cap-crossing with modulo carry, symmetric self-burn; the 32% waste becomes the payoff`

## Deliverable

Commit hash, the three-arm sweep table (all four Burn decks × all metrics), shipped D
with 30-iteration confirm, fenrir_v2's self-detonation cost, all gate numbers,
deviations — or findings if STOPPED.

## Amendment 1 (Henry, 2026-08-14): the FULL GRID before any direction ships

Henry's call, superseding Part 2's shipping rule: **measure every candidate configuration,
then he picks.** Nothing ships from this ticket. Part 1's mechanic description stands as the
DETONATE shape's spec; this amendment adds the competing shape and two new dimensions.
Symmetric self-burn (Henry's Part-1 ruling) applies in EVERY arm.

### The grid — 21 arms

Dimensions:
- **Shape S:** DETONATE (modulo carry per Part 1) vs VENT (stacks hold at cap; each excess
  stack pays D% maxHp immediately - the historical 0.08 design, now measured on equal terms
  rather than pre-judged).
- **Cap C:** 3 (current) / 4 / 5. Henry's concern: cap 3 may make overflow too easy to
  trigger. Higher caps use SPREAD tick tiers that keep the 8% + 5%-shred top tier identical
  and lengthen the climb (damagePercent / defShredPercent):
  - C=4: 1.5/0 · 3/1 · 5/2.5 · 8/5
  - C=5: 1.5/0 · 2.5/0.5 · 4/1.5 · 6/3 · 8/5
- **Overflow value D:** {4, 6, 8}% maxHp.

Arms: S x C x D = 18, plus TWO tick arms at the reference point (DETONATE, C=3, D=6) with
max-tier moved: tick-low 1.5/3/6 and tick-high 2/4.5/10 (Henry's per-turn-% knob, isolated),
plus the live baseline re-measured on the same instrument = **21**.

### Implementation for the grid

Refactor BurnBehavior to read shape/cap/D/tiers from named constants (one config object).
**Committed defaults reproduce today's live behavior EXACTLY** (cap 3, vent at 0.01 flooring
to zero, current tiers) - vitest must prove identity, and one scoped BALANCE_ONLY=fenrir run
must match current numbers within noise before any arm runs. Arms mutate the config in
memory, ticket-60 style.

### Instrument per arm

Field rows (10-iter) for fenrir_v2, skoll_v2, hraesvelgr_v2; detonation-or-vent events/game
and HP delivered by them; wasted-stack % (should collapse to ~0 in DETONATE arms); fenrir_v2
self-detonation HP taken; mirror turns fenrir + skoll; **FTK (0 hard, every arm)**.
draugr_v2 (2-stack applications, 0% waste today) runs in three sentinel arms only
(DETONATE C=3 D=8, VENT C=3 D=8, DETONATE C=5 D=4) to confirm it never moves - if it does,
that is a finding. ~25k games total: note the wall-clock, run overnight if needed.

### Deliverable (replaces Part 2/3 shipping + gates)

REPORT-ONLY then **STOP**: `research/burn-grid.md` (CRLF) - the 21-arm table ranked by how
far skoll_v2+fenrir_v2 move toward the window with hraesvelgr_v2's ceiling distance and FTK
alongside; a per-dimension reading (what shape does, what cap does, what D does, tick
sensitivity); Henry's questions section. ONE commit: refactor (behavior-identical) + report
+ ticket status note. The direction pick and the ship are Henry's session; a second
amendment will carry them.


---

## Grid delivered (2026-08-14) — STOPPED as specified, nothing shipped

Full write-up: [research/burn-grid.md](../research/burn-grid.md). All 21 arms measured at 10
iterations (300 decided games per deck per arm); seven leaders re-read at 30 (900). Registry
`1:8b7b0ae9`.

**The STOP condition is met: no configuration satisfies the constraint set.** At 30 iterations
the closest is `VENT-C4-D8` — fenrir_v2 **79.2%**, skoll_v2 **38.7%**, hraesvelgr_v2 **80.1%** —
which clears both Fire decks and misses hraesvelgr's ceiling by 0.1. Direction is Henry's.

What the grid settled:

- **The waste is fixable.** `unpaid stacks` goes **40.4% → 0.0%** at every D in every arm — the
  moment the overflow value rounds above zero, ticket 58's thrown-away Burn becomes damage. That
  question is closed regardless of which direction is picked.
- **Shape is the dominant dimension and it is worth ~44 field points** (VENT 78.3% vs DETONATE
  34.6% at the same C3/D8). **DETONATE has a second effect that was not in the design rationale:
  it SPENDS the pile, so the pile lives at the bottom of the tier table** — fenrir_v2's tick falls
  24.3 → 19.8 HP/game. It is not "Burn plus a burst"; it is a trade of DoT for burst.
- **Every cap-3 DETONATE arm puts skoll_v2 BELOW its live baseline** (15.7-18.7 vs 27.0), because
  skoll's Burn is mostly tick and detonation eats the ticks.
- **Burn is not skoll_v2's lever.** Across 21 arms she spans 15.1-39.0% and beats her 27.0%
  baseline in only six, all of them arms that simultaneously send fenrir_v2 to 66-82%. Confirms
  ticket 58's 18%-of-damage reading with a 21-point spread behind it.
- **fenrir_v2 is entirely steerable**: 27.6% → 79.2% on one dimension. ~6 field points per
  percentage point of D on the VENT-C4 line.
- **Cap is the only dimension that lowers hraesvelgr_v2** (cap 4: 74.0-78.7; cap 3: 79.3-82.0).
  She is at 79.7% live — at the ceiling before this ticket touches anything.
- **Tick sensitivity, isolated:** ±2pp on the max tier is worth −7.1 / +1.4 to fenrir_v2 and
  −1.6 / +5.6 to skoll_v2. Asymmetric, and it points the same way as the shape reading:
  **skoll wants tick, fenrir wants burst.**
- **Symmetric self-burn is free**: the most expensive arm charges fenrir_v2 **0.95 HP/game**; at
  cap 4 it is 0.4-0.6, at cap 5 effectively zero. Not a balance cost anywhere in the grid.
- **draugr_v2 sentinel held**: **0 overflow events in all four sentinel arms**, field 31.7-34.7
  against a 33.0 baseline. Prediction exact.
- **FTK: one, in `DET-C3-D4`** (skoll_v2, 1 of 300) — the lowest-payout arm in the set, so read
  as a fast-kill seed rather than a mechanic. Recorded, not dismissed; that arm needs a re-read
  before it could be trusted, and it is not a candidate.
- **`0-DECISION-GRADE` again: the ranking inverted between grades.** At 10 iterations
  `VENT-C4-D6` was the ONLY arm satisfying all three constraints (70.6 / 36.0 / 75.3); at 30 its
  skoll reads 33.4 and it fails, while `VENT-C4-D8` — out of bounds at 10 — becomes the leader.

**Committed: the refactor only, behaviour-identical.** `BURN_CONFIG` (shape / cap / overflow
percent / tiers) with the live values; both shapes implemented; `TacticalAI` reads the live tier
table so an arm cannot be judged against a stale one; `burnMechanic.test.ts` (15 tests) pins the
identity first and the shapes second. Scoped `BALANCE_ONLY=fenrir` reproduces the committed
numbers **exactly, not within noise**. Suite 792/60 green, `tsc -b` and `vite build` clean.

Five questions returned for Henry in the report's §10 — the load-bearing one being **which
constraint gives**, since the grid contains no arm that satisfies all three.

## Amendment 2 (Henry, 2026-08-15): DETONATE at the price it actually needs

Henry's direction off the grid report: **DETONATE is the preferred shape** (the self-limiter
is wanted design), the grid just priced it 3x too low - its approved D range topped out with
fenrir_v2 at 34.6% (C3-D8). Extrapolation from the three measured C3 points (~2 overflow
HP/game per D point, ~0.75 field points per overflow HP, event rate stable ~2.5-2.8/game):
D=12 -> field ~40, D=14 -> ~44, D=16 -> ~48.

**Scope rulings that unlock the decision (both Henry's):**
- **skoll_v2 LEAVES the Burn decision** - grid SS5: Burn is not her lever (above baseline in
  only 6 of 21 arms, all of which send fenrir_v2 to 66-82%). She gets her OWN deck-revamp
  pass, queued. Known cost, accepted: she reads a few points lower under DETONATE until then.
- **hraesvelgr_v2 LEAVES it too** - Air, 79.7 live before any Burn change, plus the -33%
  first-mover flag; her own pass covers both. Her ceiling is NOT a constraint on this sweep.

### The mini-sweep

**DETONATE, cap 3, current tiers, symmetric self-burn, D in {10, 12, 14, 16}%** (all four
pre-approved; anything else -> STOP). In-memory arms on the committed BURN_CONFIG refactor;
same instrument as the grid (fenrir_v2 primary; report skoll_v2 and hraesvelgr_v2 as
telemetry, NOT constraints; draugr_v2 one sentinel arm at D16).

**Ship rule:** the D putting fenrir_v2 nearest 0.50 (mid-window with headroom, not the floor
edge - the seed-base law says a floor-adjacent read needs two bases). Confirm shipped arm at
30 iterations; if the confirm sits within 6 points of either band edge, run a second seed
base before calling it. **FTK is the watch item: a 12-16% maxHp burst is the first credible
Burn FTK vector - hard 0, and any FTK in any arm gets a re-read before that arm is judged.**
If no arm lands fenrir_v2 in 0.35-0.80 -> STOP; fallback VENT-C4-D8 (measured 79.2/38.7/80.1)
returns to Henry, not to a knob.

### Ship + gates (when an arm wins)

Write the winning config into BURN_CONFIG (shape DETONATE, cap 3, D, tiers unchanged) +
update the BurnBehavior comment + power_curve_spec.md rev note + status text anywhere Burn
overflow is described. Scoped BALANCE_ONLY=fenrir, =skoll, =hraesvelgr, =draugr (all bands;
FTK 0 hard; SS2.3 diagnostic). Full npm run balance + 8-DIFF (four Burn species move,
nothing else beyond noise, control rows frozen). ONE commit; Resolution appended here; map
line; HANDOFF refresh (Burn DONE -> next queue items: skoll revamp design session, kraken,
hel_v1, hraesvelgr pass). Deliverable: sweep table, shipped D + confirms, FTK accounting,
all gates, deviations.


### Amendment 2 sweep delivered (2026-08-15) — widened by Henry in session, REPORT-ONLY, nothing shipped

Henry ordered a superset in session: **DETONATE, cap 3-8 x D 6-16%** (36 arms + baseline at 10
iterations = 33,300 games; eight arms re-read at 30; three of those on a second seed base;
~46,000 games total). Full write-up:
[research/burn-detonate-deep-sweep.md](../research/burn-detonate-deep-sweep.md).

**FTK is 0 across every arm, every deck, both mirrors.** Amendment 2's headline watch item —
that a 12-16% maxHp burst is the first credible Burn FTK vector — is measured clean. Largest
single detonation seen anywhere: **14 HP**.

**Nearest 0.50 is `DET-C4-D14` at 48.5%** (49.4 / 47.5 on two seed bases). Inside amendment 2's
cap-3 constraint the answer is **`DET-C3-D12` at 47.6%**. They hit the same fenrir_v2 number and
differ entirely in what else they do:

| | fenrir_v2 | skoll_v2 | hraesvelgr_v2 | detonations/g | self-burn |
|---|---|---|---|---|---|
| live baseline | 24.9% | 25.4% | 78.4% | 0.00 | 0.00 |
| `DET-C3-D12` | 47.6% | **19.0%** (−6.4) | **83.0%** (over ceiling) | 3.10 | 1.37 HP/g |
| `DET-C4-D14` | **48.5%** | **27.2%** (+1.8) | **77.7%** (under) | 2.00 | 0.89 HP/g |

**The scope concession may not need spending.** Amendment 2 scoped skoll_v2 and hraesvelgr_v2
out as constraints and accepted "she reads a few points lower under DETONATE" as a known cost.
That cost is a CAP-3 cost, not a DETONATE cost: at cap 4 skoll_v2 is left where she started and
hraesvelgr_v2 comes DOWN off the ceiling. The cap-4 tier table is amendment 1's verbatim, so
choosing it opens no new design surface.

**Cap is a brake on the whole status, not just on the overflow.** C3 -> C8 at D16 takes
detonations 3.27 -> 0.77 AND total Burn output 55.2 -> 24.7 HP/game, because the spread tiers
lengthen the climb as well as raising the ceiling — tick alone falls 23.3 -> 15.2 before any
detonation is counted. By cap 7-8 the mechanic has largely stopped existing. **"Harder to reach
without making Burn worse" is not available from the spread-tier construction** — that needs a
cap raise with the climb held fixed, which is a different table and a design call.

**Cap and D multiply rather than adding.** `C3-D10` (46.2), `C4-D14` (49.7) and `C5-D16` (48.3)
are three routes to the same field number differing only in texture — 2.96 / 2.00 / 1.57
detonations a game at ~7.7 / ~10.9 / ~12.4 HP each. Many small pops vs few large ones is the
actual choice.

Also on record: **symmetric self-burn stays cheap and cap prices it** (1.2-1.4 HP/g at cap 3,
0.9 at cap 4, ~0 at cap 5+ — it only registers at all at cap 3); **draugr_v2's sentinel held
exactly** (0 detonation events, 0 clamped stacks, every arm); the **seed-base spread was 1.9
points**, much tighter than ticket 61's 5.5, so a Burn arm is a quieter measurement than a
firmware payoff arm; and **the live baseline itself reads 24.2-29.0 across bases and grades on
an unchanged deck**, so deltas here should be read against ~25 rather than a precise number.

**Two assumptions stated rather than resolved** (report §8): D steps of 2pp, and **tick tables
for caps 6-8, which did not exist and were GENERATED** from the curve amendment 1's C4/C5 tables
describe. No candidate depends on the generated tables — caps 6-8 all read below target — but
they are the agent's construction, not Henry's, and are printed in the report for review.

**HELD, not shipped.** Amendment 2's ship-and-gate section is keyed to a cap-3 arm; if the
answer is cap 4 that section needs an amendment first. Five questions returned in report §9, the
load-bearing one being **cap 3 or cap 4**.


---

## Resolution (2026-08-15) — SHIPPED `DET-C4-D14`

Henry picked cap 4 / D 14% off the deep sweep. **Burn detonates: crossing a 4-stack cap pays
14% of the burned entity's max HP and carries the remainder.** Amendment 2's ship-and-gate
procedure was applied to cap 4 rather than cap 3 on that instruction.

### What changed

| file | change |
|---|---|
| `StatusBehaviors.ts` | `BURN_CONFIG` → `DETONATE` / cap **4** / **0.14**; the overflow-rate comment rewritten with the full 0.08 → 0.01 → 0.14 history |
| `gameConfig.ts` | `burnStacks` → the FOUR-tier spread table `1.5/0 · 3/1 · 5/2.5 · 8/5` (amendment 1's C4 table verbatim) |
| `statusGlossary.ts` | player-facing Burn text — it described the *historical* 0.08 vent and was already wrong before this ticket |
| `power_curve_spec.md` | rev note appended; the stale "Burn caps at 3 stacks" line in the Regen section corrected |
| `burnMechanic.test.ts` | the identity block now pins the SHIPPED config (20 tests) |
| `AdvancedCombat.test.ts` | Burn tier test extended to 4 tiers, title corrected, values pinned absolutely |

**No card, deck, hook or firmware changed.** Registry hash is unchanged at `1:8b7b0ae9` — this
is an engine-constant ship, which is why the section-1.3 card budget redlines are untouched.

### Gates

| gate | threshold | measured | verdict |
|---|---|---|---|
| fenrir_v2 field | 0.35–0.80 | **49.4% / 47.5%** (two seed bases, 900 decided games each) | **PASS** |
| fenrir_v2 control floor | ≥0.60 | **93.0%** (was 55.0%) | **PASS** |
| hraesvelgr_v2 control floor | ≥0.60 | 100% | PASS |
| draugr_v2 control floor | ≥0.60 | 100% | PASS |
| skoll_v2 control floor | ≥0.60 | **52.0%** (was **39.0%**) | **still under — improved, see below** |
| FTK | hard 0 | **0** across all 67 matchups, 0 in 5,400 verification games, 0 across the sweep's ~46,000 | **PASS** |
| dead cards | ≤0.35 both sides | max 34.4% (`os:skoll`) | PASS |
| mirrors decided ≤30 turns | ≥60% | 100% — fenrir 5.1t · skoll 3.7t · hraesvelgr 3.2t · draugr 6.3t, **0 stalled** | PASS |
| §2.3 | diagnostic only | `os:fenrir` opens at 0.419; `os:draugr` 0.16→0.15; `os:hraesvelgr` 0.19→0.16 | noted, not gated |

`tsc -b` clean · `vitest` **797 passed / 60 files** (re-run AFTER the last content edit,
`0-DECK-SIZE-EXCEPTION`'s lesson) · `vite build` clean. Redlines **49 → 50**.

**The on-disk build was verified against the measured arm rather than assumed equal to it.**
The sweep set `BURN_CONFIG.tiers` in memory while `gameConfig` still held three tiers; the ship
moves both. A no-mutation re-read of the committed build reproduces the sweep exactly —
fenrir_v2 **49.4 / 47.5**, skoll_v2 **27.2 / 28.4**, hraesvelgr_v2 **77.7 / 77.0**, identical to
`DET-C4-D14`'s rows.

### 8-DIFF — 10 rows of 67 moved, 57 bit-identical

| row | before | after | Δ |
|---|---|---|---|
| `gauntlet:control-vs-fenrir:fenrir_v2` | 45.0% | **7.0%** | **−38.0** |
| `os:fenrir` | 40.0% | 8.1% | −31.9 |
| `gauntlet:control-vs-skoll:skoll_v2` | 61.0% | 48.0% | −13.0 |
| `os:skoll` | 64.0% | 54.0% | −10.0 |
| `gauntlet:control-overall:slot2` | 8.2% | 5.1% | −3.2 |
| `os:hraesvelgr` | 31.0% | 34.0% | +3.0 |
| `gauntlet:control-overall` | 7.8% | 6.2% | −1.6 |
| `os:draugr` | 34.0% | 35.0% | +1.0 |
| `control-vs-draugr:draugr_v2` · `control-vs-hraesvelgr:hraesvelgr_v2` | 0.0% | 0.0% | turns only |

**Exactly the four Burn species and nothing else.** The two `gauntlet:control-overall` rows are
aggregates over those matchups, not the control moving — **no control-vs-non-Burn row changed by
any amount**, and the control itself applies no Burn.

### Returned for Henry — three items, one of them load-bearing

1. **PRICING IS NOT UPDATED. `powerscale.ts` still prices Burn off the old three-tier table**
   (`BURN_TIER_POWER = [4.5, 15, 40]`) and prices overflow at
   `BURN_OVERFLOW_POWER_PER_STACK = 3` — a value derived when an excess stack was worth 1% of a
   pool and floored to zero damage. **Neither describes the shipped engine**, so every Burn card
   is now priced against a mechanic that no longer exists, and the 40 card-budget redlines are
   measuring the wrong thing. Carried forward at the table's own 3-power-per-1%-maxHP rate the
   arithmetic is **`[4.5, 13.5, 28.5, 52.5]`** and **42 power per DETONATION** — but that second
   number is also a change of SHAPE (per-event, not per-excess-stack: a card applying S stacks
   now causes `floor(S / cap)` detonations, not `S − cap`). Repricing moves section 1.3 and can
   indict cards, so it was **not** taken as part of the ship. Full working in the
   `power_curve_spec.md` rev note.
2. **skoll_v2's control floor is still under 0.60** at 52.0% — but it came UP from 39.0%, so
   detonation improved a deck the grid said Burn could not fix. Pre-existing, not caused here.
   Her revamp pass is already queued and now starts from a better place than expected.
3. **`os:fenrir` opened as a §2.3 redline at 0.419** — fenrir_v2 now beats fenrir_v1 **91.9%**.
   Diagnostic only under deep-phase policy, and the field says the same thing the valkyrie case
   did (v2 is simply strong now). Worth flagging because **fenrir_v1 is a floor-queue deck**, so
   the gap will be read again when that pass runs.

**Process note.** `AdvancedCombat.test.ts`'s Burn test read its expected values out of
`burnConfig`, so the tier-table change left it **green with a stale title** — it asserted
"2 stacks = 3.5%, 3 stacks = 8%" while measuring 3% and 5%. A green test asserting the wrong
sentence is worse than a red one. It now pins the tier values absolutely as well as relatively.


### Repricing follow-up (2026-08-15, Henry in session) — scorer fixed, cards re-scored, nothing else touched

The ship deliberately left `powerscale.ts` pricing the OLD mechanic (`0-BURN-PRICE-LAG`). Henry
ordered the fix. Full write-up: [research/burn-repricing.md](../research/burn-repricing.md).

**Section 1.3 stays at 40 redlines; membership changed. §2-3 redlines are byte-identical** — the
scorer is a static audit and cannot move a simulation.

| card | before | after | |
|---|---|---|---|
| `ash_communion` | 10.6 (over by 4.1) | **9.3** (over by 2.8) | still over |
| `sun_eaters_plunge` | 10.8 (over by 0.3) | **9.7** | **off the list** |
| `ash_reclamation` | 3.0 | **3.2** | **new redline** (registry orphan, in no deck) |

**Every Burn-carrying card in every deck got CHEAPER or stayed flat — not one got more
expensive**, which is the opposite of what "the scorer under-prices Burn" implied. The reason is
that the spread table lowered the middle rungs (2 stacks 3.5% -> 3%, 3 stacks 8% -> 5%) while
raising only the new 4th, and **no card in any deck applies four Burn in a single action.** Every
live card sits on the part of the curve that went down, and **the detonation is priced correctly
but reached by nothing a static per-action pass can see** - it happens through accumulation across
casts, which the dynamic instruments already measure (~22 HP/game for fenrir_v2).

**One card is materially mis-modelled, and it is pre-existing rather than new.** `molten_core`
applies Burn TWICE on one card (2+2); the scorer prices each action independently at 13.5 + 13.5 =
27 while the engine sees one pile of 4 worth 52.5. **Under-priced by 2.55 score points on a 3.0
budget** - modelled honestly it scores ~4.9 and is 1.9 over. The per-action independence is old;
what changed is that the new table is NON-LINEAR across the cap, so it now matters. Same card
ticket 58 measured throwing away 64% of the Burn it applies - the static and dynamic ends of one
fact. (`pyre_sacrifice` 3+3 lands within 0.15 by coincidence.)

**A property of the shipped mechanic that is now on record: Burn is NOT monotonic in stacks.**
Applying 5 delivers 15.50% of max HP against 4's 17.50%, because the detonation consumes the pile
that would otherwise tick down the whole table. Every multiple of the cap is a local maximum. On
an 80 HP frame, 4 stacks deal 13 and 5 deal 12.

**The scorer now DERIVES its Burn numbers from the engine rather than transcribing them** -
`BURN_TIER_POWER` reads `DEFAULT_GAME_CONFIG.status.burnStacks`, `BURN_DETONATION_POWER` reads
`BURN_CONFIG.overflowPercent`, and `burnPower` mirrors `onApply`'s carry arithmetic. Transcribing
the new values would have fixed today and left the same trap armed for the next tier edit.
`BURN_OVERFLOW_POWER_PER_STACK` is gone - it was the wrong SHAPE, not just a stale number.
`burnPricing.test.ts` (17 tests) pins scorer against engine by RUNNING `BurnBehavior` on a
10,000 HP frame and requiring the price to equal the damage actually delivered, so a future
one-sided edit fails there. Gates: `tsc -b`, **814 passed / 61 files**, `vite build`, full balance.

Four questions returned (report §7); the practical ones are **`ash_communion` is an
`ASSUMED_STATUS_COUNT` problem, not a Burn-table one** (still 2.8 over), and **what to do about
`molten_core`**.
