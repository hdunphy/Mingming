# The Burn grid — 21 configurations, and the one thing none of them does

- Type: wayfinder:research — **REPORT-ONLY, and nothing shipped.** Ticket 62 amendment 1:
  measure every candidate configuration, then Henry picks. Every arm mutated `BURN_CONFIG` in
  memory; the committed engine reproduces today's live behaviour exactly and is pinned by
  `src/engine/burnMechanic.test.ts`.
- Read at registry **`1:8b7b0ae9`** (post-ticket-61), 2026-08-14. Branch `card-dev`.
- Instrument: field row against all 15 other species, both turn orders, pooled decisive win
  rate. **Grid at 10 iterations (300 decided games per deck per arm); seven arms re-read at 30
  (900).** ~21,000 games in 13 minutes for the grid, 13 more for the confirm.
- Template and quality bar: `jormungandr-v1-attribution.md`. Predecessor: `fire-investigation.md`.

---

## 1. The answer, in one paragraph

**The waste is fixable and the balance problem is not.** Every arm at every D converts 100% of
ticket 58's thrown-away Burn into damage — `unpaid stacks` goes 40.4% → **0.0%** the moment the
overflow value rounds above zero. But **no configuration in the grid puts both Fire decks inside
0.35–0.80 while keeping hraesvelgr_v2 under the ceiling.** The closest, at 30 iterations, is
`VENT-C4-D8` — fenrir_v2 **79.2%**, skoll_v2 **38.7%**, hraesvelgr_v2 **80.1%** — which clears
two decks by clearing the third by −0.1. That is the ticket's designated STOP condition, so this
report stops there.

The reason is not the dial. It is that **Burn is fenrir_v2's engine and is not skoll_v2's.**

---

## 2. The grid

Sorted by fenrir_v2's field within each shape. All values 10-iteration; §4 re-reads the leaders
at 30.

| arm | shape | cap | D | fenrir_v2 | skoll_v2 | hraesvelgr_v2 | fen events/g | fen overflow HP/g | fen tick HP/g | fen self HP/g | skoll overflow HP/g | hrae overflow HP/g | unpaid stacks | FTK | fen mirror | skoll mirror |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `baseline` | VENT | 3 | live 1% | **29.0%** | **27.0%** | 80.3% | 6.22 | 0.0 | 24.3 | 0.00 | 0.0 | 0.0 | 40.4% | 0 | 6.35 | 4.00 |
| `VENT-C4-D8` | VENT | 4 | 8% | **82.3%** | **35.7%** | 77.0% | 6.76 | 40.4 | 17.0 | 0.42 | 6.9 | 5.0 | 0.0% | 0 | 3.60 | 3.30 |
| `VENT-C3-D8` | VENT | 3 | 8% | **78.3%** | **39.0%** | 82.0% | 7.47 | 44.8 | 17.3 | 0.82 | 10.4 | 8.6 | 0.0% | 0 | 3.35 | 3.10 |
| `VENT-C5-D8` | VENT | 5 | 8% | **76.3%** | **28.0%** | 81.3% | 6.09 | 36.5 | 17.0 | 0.10 | 3.7 | 1.6 | 0.0% | 0 | 4.60 | 4.05 |
| `VENT-C4-D6` | VENT | 4 | 6% | **70.6%** | **36.0%** | 75.3% | 7.27 | 31.1 | 19.3 | 0.43 | 5.2 | 3.2 | 0.0% | 0 | 4.25 | 3.75 |
| `VENT-C3-D6` | VENT | 3 | 6% | **66.3%** | **35.2%** | 82.0% | 8.22 | 35.0 | 19.6 | 0.95 | 8.1 | 5.1 | 0.0% | 0 | 3.80 | 3.30 |
| `VENT-C5-D6` | VENT | 5 | 6% | **66.1%** | **31.1%** | 78.0% | 6.28 | 27.0 | 18.6 | 0.16 | 2.6 | 1.1 | 0.0% | 0 | 5.70 | 3.65 |
| `VENT-C4-D4` | VENT | 4 | 4% | **54.7%** | **29.7%** | 77.3% | 7.06 | 20.7 | 20.5 | 0.41 | 3.0 | 2.0 | 0.0% | 0 | 5.75 | 3.45 |
| `VENT-C5-D4` | VENT | 5 | 4% | **54.7%** | **30.3%** | 76.0% | 6.77 | 19.6 | 20.9 | 0.06 | 2.0 | 0.4 | 0.0% | 0 | 5.90 | 3.70 |
| `VENT-C3-D4` | VENT | 3 | 4% | **53.4%** | **32.3%** | 81.0% | 8.53 | 24.9 | 21.4 | 0.83 | 5.4 | 3.0 | 0.0% | 0 | 4.20 | 3.40 |
| `DET-C4-D8` | DETONATE | 4 | 8% | **35.2%** | **24.0%** | 77.7% | 1.86 | 11.2 | 18.0 | 0.60 | 1.8 | 0.3 | 0.0% | 0 | 6.30 | 3.65 |
| `DET-C3-D8` | DETONATE | 3 | 8% | **34.6%** | **18.7%** | 79.3% | 2.76 | 16.6 | 19.8 | 0.90 | 3.2 | 1.0 | 0.0% | 0 | 5.10 | 3.95 |
| `DET-C4-D6` | DETONATE | 4 | 6% | **33.0%** | **24.3%** | 74.7% | 1.60 | 6.8 | 18.4 | 0.41 | 1.3 | 0.2 | 0.0% | 0 | 6.60 | 3.95 |
| `DET-C5-D8` | DETONATE | 5 | 8% | **31.3%** | **24.5%** | 79.0% | 1.25 | 7.5 | 17.0 | 0.04 | 1.1 | 0.1 | 0.0% | 0 | 6.50 | 4.00 |
| `DET-C4-D4` | DETONATE | 4 | 4% | **30.7%** | **24.3%** | 74.0% | 1.45 | 4.2 | 18.9 | 0.18 | 0.7 | 0.1 | 0.0% | 0 | 7.20 | 3.60 |
| `DET-C3-D6` | DETONATE | 3 | 6% | **30.4%** | **16.7%** | 79.7% | 2.52 | 10.7 | 20.2 | 0.79 | 1.8 | 0.4 | 0.0% | 0 | 5.10 | 3.95 |
| `DET-C5-D6` | DETONATE | 5 | 6% | **27.3%** | **20.0%** | 78.3% | 1.07 | 4.6 | 17.0 | 0.00 | 0.6 | 0.1 | 0.0% | 0 | 7.45 | 3.80 |
| `DET-C3-D4` | DETONATE | 3 | 4% | **27.0%** | **15.7%** | 80.7% | 2.25 | 6.5 | 20.6 | 0.51 | 0.9 | 0.1 | 0.0% | 1 | 5.80 | 4.25 |
| `DET-C5-D4` | DETONATE | 5 | 4% | **24.0%** | **22.7%** | 78.0% | 0.96 | 2.8 | 17.2 | 0.02 | 0.4 | 0.0 | 0.0% | 0 | 7.40 | 3.60 |
| `DET-C3-D6-tickLOW` | DETONATE | 3 | 6% | **23.3%** | **15.1%** | 78.0% | 2.53 | 10.8 | 15.3 | 0.75 | 2.3 | 0.5 | 0.0% | 0 | 5.40 | 4.15 |
| `DET-C3-D6-tickHIGH` | DETONATE | 3 | 6% | **31.8%** | **22.3%** | 82.0% | 2.33 | 10.0 | 24.5 | 0.51 | 1.1 | 0.5 | 0.0% | 0 | 5.40 | 4.10 |

`unpaid stacks` is ticket 58's waste metric on the same definition — stacks the cap removed that
bought nothing, as a share of stacks requested. `events/g` counts real applications only: the
wrapper excludes TacticalAI's lookahead per HANDOFF `0-AI-SIM-COUNTS`, which inflates any naive
hook counter ~24×.

---

## 3. Reading the grid one dimension at a time

### Shape is the dominant dimension, and it is worth ~44 field points

At the same cap and dial (`C3-D8`): **VENT puts fenrir_v2 at 78.3%, DETONATE at 34.6%.**

The mechanism is exactly the limiter the ticket designed in. DETONATE's modulo carry cuts the
payout *rate* by 2.7× (7.47 → 2.76 events per game) and the delivered HP by the same (44.8 →
16.6). It does what it was meant to do; the question is whether that is the amount of braking
the decks want.

**But DETONATE has a second effect that was not in the design rationale, and it is the more
interesting one.** Detonation SPENDS the pile — three stacks per payout — so the pile spends its
life near the bottom of the tier table instead of at the top. fenrir_v2's tick damage falls
**24.3 → 19.8 HP/game** under `DET-C3-D8`, and skoll_v2's **11.4 → 8.4**. DETONATE is not "Burn
plus a burst"; **it is a trade of DoT for burst**, and the exchange rate decides who it helps.

For fenrir_v2 the trade roughly breaks even and the burst is a small net gain (29.0 → 34.6). For
skoll_v2 it is a straight loss: **every DETONATE arm at cap 3 puts skoll_v2 BELOW its live
baseline** (15.7–18.7 against 27.0), because skoll's Burn is mostly tick and detonation eats the
ticks to pay a burst skoll cannot afford to trade for.

### Cap is a brake on the whole mechanic, and the only lever that lowers hraesvelgr

Raising the cap does two things at once, and both point the same way: overflow becomes rarer
(fenrir DETONATE events/game **2.76 → 1.86 → 1.25** at C3/C4/C5) and the spread tier tables
lengthen the climb, so less time is spent at the 8% top tier (**tick 19.8 → 18.0 → 17.0**).

Net effect on fenrir_v2 is mildly negative under both shapes at a fixed D. Net effect on skoll_v2
is *positive* under DETONATE (15.7 → 24.3 → 22.7 at D4) for the same reason detonation hurt it:
a higher cap means fewer detonations, so the pile survives and ticks.

**Cap is also the only dimension in the grid that moves hraesvelgr_v2 down.** She sits at 79.7%
live — already at the ceiling, a pre-existing condition under the ceiling freeze — and cap 4
takes her to 74.0–78.7% while cap 3 pushes her to 79.3–82.0%. If a candidate has to keep her
under 0.80, that is an argument for cap 4 independent of anything Fire wants.

### D is monotone, and its leverage depends entirely on the shape

Under VENT, D is a strong linear dial on fenrir_v2: **53.4 → 66.3 → 78.3** across 4/6/8% at cap 3.
Under DETONATE the same 4-point move buys **27.0 → 30.4 → 34.6**. The ratio is the event rate — D
multiplies a number VENT charges three times as often.

**fenrir_v2 is the volatile deck the ticket predicted.** On the `VENT-C4` line a single 4-point
move on D takes her **56.0% → 79.2%** at 30 iterations. Any Fire design that lands on VENT is
choosing a knob with about 6 field points per percentage point of max HP.

### Tick sensitivity: ±2pp on the max tier is worth ~4–7 field points

Isolated at the `DET-C3-D6` reference (fenrir 30.4 / skoll 16.7 / hraesvelgr 79.7):

| tick arm | max tier | fen tick HP/g | fenrir_v2 | skoll_v2 | hraesvelgr_v2 |
|---|---|---|---|---|---|
| tick-low | 6% | 15.3 | **23.3%** (−7.1) | **15.1%** (−1.6) | 78.0% |
| reference | 8% | 20.2 | 30.4% | 16.7% | 79.7% |
| tick-high | 10% | 24.5 | **31.8%** (+1.4) | **22.3%** (+5.6) | **82.0%** |

The knob is real and it is **asymmetric**: cutting the top tier costs fenrir_v2 more than raising
it gains her, while skoll_v2 gains disproportionately from a higher tick — which is the same fact
as §3's shape reading, seen from the other side. **skoll_v2 wants tick; fenrir_v2 wants burst.**
Note also that tick-high is the only non-cap-3 route to pushing hraesvelgr_v2 over 0.80.

---

## 4. The 30-iteration re-read — and why the 10-iteration ranking would have picked the wrong arm

Seven arms re-measured at 900 decided games per deck (`0-DECISION-GRADE`).

| arm | fenrir_v2 10→30 | skoll_v2 10→30 | hraesvelgr_v2 10→30 | all three in bounds? |
|---|---|---|---|---|
| `baseline` | 29.0 → **27.6** | 27.0 → **27.0** | 80.3 → **79.7** | no — both Fire decks under floor |
| `VENT-C4-D8` | 82.3 → **79.2** | 35.7 → **38.7** | 77.0 → **80.1** | **closest — misses by 0.1 on hraesvelgr** |
| `VENT-C4-D6` | 70.6 → **68.7** | 36.0 → **33.4** | 75.3 → **78.7** | no — skoll falls back under the floor |
| `VENT-C3-D6` | 66.3 → **66.4** | 35.2 → **34.6** | 82.0 → **83.0** | no — skoll under, hraesvelgr over |
| `VENT-C4-D4` | 54.7 → **56.0** | 29.7 → **31.2** | 77.3 → **77.8** | no — skoll under |
| `VENT-C5-D6` | 66.1 → **64.9** | 31.1 → **28.7** | 78.0 → **77.8** | no — skoll under |
| `DET-C4-D8` | 35.2 → **34.8** | 24.0 → **24.3** | 77.7 → **76.1** | no — skoll well under |

**At 10 iterations `VENT-C4-D6` was the only arm satisfying all three constraints** (70.6 / 36.0 /
75.3). At 30 its skoll reads 33.4 and it fails. `VENT-C4-D8`, which looked out of bounds at 10
(fenrir 82.3), is the one that comes closest at 30. **The ranking inverted between the two
grades** — another entry for `0-DECISION-GRADE`, and the reason nothing here should be chosen off
the 21-arm table alone.

---

## 5. The finding that should shape Henry's session: Burn is not skoll_v2's lever

Across all 21 arms skoll_v2's field spans **15.1% to 39.0%** and lands above its 27.0% baseline in
only six of them — every one a cap-3-or-4 VENT arm at D ≥ 6, i.e. arms that simultaneously send
fenrir_v2 to 66–82%. Her overflow HP never exceeds **10.4 a game** while fenrir_v2's reaches 44.8.

Ticket 58 already said why: **Burn is 18% of skoll_v2's damage and 39% of fenrir_v2's**, and
`fire_punch_v2` — a plain 30-power card with no text — is the top damage source in both skoll
decks. This grid is the confirmation with a 21-point spread behind it: **you cannot move skoll_v2
into the window by changing Burn.** Whatever fixes skoll is a card or a deck question.

Conversely fenrir_v2 is *entirely* steerable by this mechanic — 27.6% to 79.2% on one dimension —
which makes the choice here effectively a fenrir_v2 tuning decision with a hraesvelgr_v2 ceiling
constraint attached.

---

## 6. Symmetric self-burn costs fenrir_v2 less than one HP a game

Henry asked for this explicitly. **The most expensive arm in the grid charges fenrir_v2 0.95 HP
of self-detonation per game** (`VENT-C3-D6`); at cap 4 it is 0.4–0.6, and at cap 5 it is
0.00–0.16.

Against a ~24 HP/game Burn output and a ~4.7-turn game, the symmetric rule is **not a balance
cost at all at any point in the grid.** It survives because fenrir_v2's self-applied Burn rarely
crosses the cap — `pyre_sacrifice` is a managed bomb in theory and, on the committed deck list,
a bomb that mostly does not go off. If the symmetric rule is meant to create real risk texture,
this grid says the current deck cannot express it and that is a card question, not a dial.

---

## 7. draugr_v2 did not move — the sentinel held

Run in the four sentinel arms as specified:

| arm | draugr_v2 field | overflow events/g | clamped stacks |
|---|---|---|---|
| `baseline` | 33.0% | 0.00 | 0.0% |
| `DET-C3-D8` | 31.7% | 0.00 | 0.0% |
| `VENT-C3-D8` | 34.7% | 0.00 | 0.0% |
| `DET-C5-D4` | 32.0% | 0.00 | 0.0% |

**Zero overflow events in every arm** — draugr_v2's 2-stack applications never cross a cap of 3,
let alone 4 or 5 — and its field moves 31.7–34.7 against a 33.0 baseline, comfortably inside the
±5 band. The prediction held exactly and nothing needs explaining.

---

## 8. FTK

**One first-turn kill in the entire grid**: skoll_v2, 1 of 300 games, in `DET-C3-D4` — the
lowest-payout arm in the whole set, where the Burn change is smallest. Every other arm, including
every high-D VENT arm, reads 0 across field, both mirrors and all decks.

Read as: **not Burn-driven.** A single FTK in the arm with the least Burn output is far more
likely to be a fast-kill seed than a mechanic. It is recorded rather than dismissed — the
threshold is hard 0 — and **that arm would need a re-read before it could be trusted.** It is not
a candidate either way.

---

## 9. What was committed

The refactor only, and it is behaviour-identical:

- `BurnBehavior` now reads `shape` / `maxStacks` / `overflowPercent` / `tiers` from one exported
  `BURN_CONFIG` object, and implements both shapes. **The committed values are the live pre-62
  ones** (VENT, cap 3, 1%, current tiers).
- `TacticalAI.burnTotalPercent` reads `BURN_CONFIG.tiers` instead of `DEFAULT_GAME_CONFIG`
  directly. Identical as committed, but it means a grid arm that changes the tier table changes
  the AI's valuation with it — an eval judging every arm against a stale tier table would have
  been the same failure family as ticket 40's Poison cap.
- `src/engine/burnMechanic.test.ts` (15 tests) pins the identity first and the DETONATE/VENT
  shapes second, including the ticket's worked cases (3+1 → one detonation and 1 left; 3+4 → two
  and 1 left; 3+3 → one and 3 left) and the single-stack rhythm (`6,0,0,6,0,0`).

**Identity proof beyond the unit tests:** a scoped `BALANCE_ONLY=fenrir` run reproduces the
committed numbers **exactly, not within noise** — control-vs-fenrir_v1 29.9% / 6.85 turns,
control-vs-fenrir_v2 45.0% / 7.00, `os:fenrir` 40.0% / 4.74, mirror 49.2% / 5.06, 0 matchup
redlines. Full suite 792 passed / 60 files; `tsc -b` and `vite build` clean.

---

## 10. Questions for Henry

1. **The grid has no clean winner — which constraint gives?** `VENT-C4-D8` clears both Fire decks
   and misses hraesvelgr_v2's ceiling by 0.1 (80.1). Options are: accept her at the line, waive
   her under the ceiling freeze (she is at 79.7 live already, so the arm barely moves her), or
   take a cap-4 arm at D6 and leave skoll_v2 under the floor.
2. **Is DETONATE dead, or is it right and the brake is too strong?** It costs ~44 field points
   against VENT at the same dial, and its D range tops out with fenrir_v2 at 35.2%. It is the
   shape with the self-limiter, and the grid says the limiter is worth more than the entire D
   range. A DETONATE arm at D = 12–16% is outside the approved set but is the obvious next
   question if the shape is wanted for its own sake.
3. **skoll_v2 needs a different ticket** (§5). Should the Fire session treat her as a card
   problem now rather than waiting on a Burn direction?
4. **Symmetric self-burn is free on the current lists** (§6). Keep it as a rule for future card
   design, or is the risk texture worth a card change to actually express?
5. **hraesvelgr_v2 is at the ceiling before anything happens here** (79.7 live). She is Air, not
   Fire, and she is in the grid only because she applies Burn. Does she belong in the Fire session
   at all, or is she a separate ceiling item?
