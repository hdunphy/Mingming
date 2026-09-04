# valkyrie_v2 REBIRTH re-denomination — the unit fix, the sweep, and what a power actually buys

- Type: wayfinder:research — the implementation record for **ticket 61**. Unlike ticket 60 this
  one SHIPPED: `hooks.json`, the registry deck list and one test line changed.
- Shipped at registry **`1:8b7b0ae9`** (baseline re-measured on the same instrument at
  `1:3466b533`), 2026-08-14. Branch `card-dev`.
- Instrument: field row against all 15 other species, both turn orders, pooled decisive win
  rate. Sweep arms at 10 seeds (~300 decided games); the shipped arm confirmed at 30
  (~900). `0-DECISION-GRADE` applies — a 10-iteration read is a ranking, not a verdict.
- Template and quality bar: `jormungandr-v1-attribution.md`. Predecessor: `valkyrie-knockout.md`.

---

## 1. The answer, in one row

**Shipped: N = 15.** Both halves of REBIRTH_CYCLE_OS are now power-denominated and run the
normal pipeline.

| | before | after |
|---|---|---|
| **field (30-iteration)** | 86.7% | **59.1%** |
| damage per proc | 8.5 | 3.1 |
| heal per proc | 2.0 | 3.0 |
| procs per game | 3.48 | 4.05 |
| game length (field) | 4.88 turns | 5.80 turns |
| deck size | 7 | **8** (`glimmer` back) |
| dead cards (her side) | 13.4% | 7.8% |
| control | 100% | 100% |
| FTK | 0 | 0 |

She leaves the top cluster. The ceiling freeze's sanctioned exception did what it was opened
for: an engine named by measurement, fixed at the unit level, landing in the middle of the
window rather than at its edge.

---

## 2. The four-arm sweep

Every arm mutated the firmware hook's data definition IN MEMORY; only the shipped value was
written to disk. `baseline` is the committed raw-HP version, re-measured on the same seeds.

| arm | field | procs/game | dmg/proc | heal/proc | v2-mirror turns | field turns | dead (her/opp) | FTK |
|---|---|---|---|---|---|---|---|---|
| baseline (raw `-10` HP) | 86.7% | 3.48 | 8.5 | 2.0 | 4.75 | 4.88 | 13.4% / 17.6% | 0 |
| **N = 10** | 53.3% | 3.78 | 1.7 | 2.0 | 10.55 | 5.72 | 7.1% / 14.2% | 0 |
| **N = 15** | **60.3%** | 4.05 | 2.7 | 3.0 | 8.90 | 5.80 | 8.4% / 14.7% | 0 |
| **N = 20** | 64.3% | 4.18 | 3.8 | 3.9 | 8.55 | 5.74 | 9.1% / 14.4% | 0 |
| **N = 25** | 72.0% | 4.34 | 4.8 | 4.9 | 8.20 | 5.83 | 11.1% / 15.3% | 0 |

Every arm is inside 0.35–0.80. **N = 15 is nearest 0.60 and was shipped**, per the ticket's rule.

30-iteration confirm (900 decided games each): **N = 15 → 59.1%**, N = 20 → 64.0%. The ordering
held and neither read moved more than 1.2 points off its 10-iteration value.

---

## 3. What a point of printed power is actually worth here

This is the number the ticket most needed and did not have.

**Measured: ~0.20 HP of damage per printed power, and ~0.20 HP of healing per printed power.**
The two halves land within a few percent of each other at every N, which is what "both halves
always share one value" is supposed to mean and is now true in HP as well as in text.

| N | dmg/proc | heal/proc | dmg per power | heal per power |
|---|---|---|---|---|
| 10 | 1.7 | 2.0 | 0.175 | 0.199 |
| 15 | 2.7 | 3.0 | 0.182 | 0.198 |
| 20 | 3.8 | 3.9 | 0.192 | 0.197 |
| 25 | 4.8 | 4.9 | 0.193 | 0.195 |

**Two corrections to the record fall straight out of that table.**

1. **The ticket's interpolation guide was off by ~40%.** It estimated the raw `-10` mutation at
   "~33 power per proc" from a 0.30 damage-per-power rate. The measured rate on this frame is
   ~0.19, and the raw mutation measures **8.5 damage per proc** — so it was worth about **42-45
   printed power**, not 33. That is why N = 25 still reads 14 points under baseline.
2. **The gap between 8.5 and 3.1 damage is not the nerf; it is the pipeline.** A raw `HP`
   mutation skips attack, defence, elemental multipliers and every status. 15 printed power
   *does* enter as a real Light attack — it is simply that a real attack against a defended
   target at level 15 is worth about 3 HP, and a raw mutation is worth its face value against
   everyone forever. **That is the whole unit bug in one comparison**, and it is why the fix had
   to be a re-denomination rather than a smaller number.

---

## 4. The nerf partially pays for itself, and the mechanism is game length

Cutting the payoff *raised* the proc count.

| | baseline | N = 15 |
|---|---|---|
| procs / game | 3.48 | **4.05** |
| field game length | 4.88 turns | **5.80 turns** |
| v2-mirror length | 4.75 turns | **8.90 turns** |

She is not reshuffling faster; her games are lasting longer, and the once-per-turn cap converts
extra turns directly into extra procs. **~19% of the payoff cut comes back as frequency**, which
is worth knowing before anyone reads a future REBIRTH dial as linear. It also means the
shuffle-throttle — Henry's designated second axis — is now a *stronger* lever than it was when
ticket 60 measured it, because there are more capped turns to throttle.

The once-per-turn guard still binds: across 1,742 field turns in which she reshuffled at all,
**380 (21.8%) had more than one reshuffle and paid out only once.** (Ticket 60's 34.7% was
measured over mirror turns, not field turns — the two numbers are not directly comparable, but
both say the cap is load-bearing rather than decoration.)

---

## 5. `starfall` post-fix — the read the ticket ordered

| | before (ticket 60) | after |
|---|---|---|
| damage / cast | 7.1 | **6.7** |
| casts / game | 3.11 | **4.02** |
| damage / game | ~22 | **~27** |

Longer games bought it 29% more casts and it still deals under 7 per cast on a card priced as a
1e scaler. **It earns more of its slot than it did and is still the weakest card in the list.**
The whole deck's dead-card ratio nearly halved (13.4% → 7.8%), so the dead-card cleanup queue
will not find valkyrie_v2 by that instrument — if `starfall` is cut it will be on damage per
energy, not on it rotting in hand.

---

## 6. The finding that needs Henry: valkyrie_v1 now reads as the stronger deck head-to-head, and the field disagrees

**§2.3 `os:valkyrie` moved 0.38 → 0.89 and re-opened as a redline** (diagnostic-only under
deep-phase policy, so it did not gate — but it is the single largest movement in the whole
matchup table).

Read alone it says v1 crushes v2 89-11. The field says something else:

| | field (30-iteration, same seed base) | control | game length |
|---|---|---|---|
| valkyrie_v1 | **55.0%** | 100% | 7.93 turns |
| valkyrie_v2 | **64.6%** | 100% | 5.59 turns |

**Both decks are in the window, both beat the control outright, and v2 is still the stronger of
the two against the roster.** What the 89-11 measures is one matchup: v1's long grinding game
against v2's short one, on a frame where v1 outlasts her. This is the ratatoskr lesson (8-COUNTER)
in its cleanest form yet — a §2.3 extreme with a field check that contradicts it — and it is
recorded here rather than acted on, per policy.

**A sampling note that belongs with those numbers.** The two independent 30-iteration reads of
valkyrie_v2's field, on different seed bases, are **59.1%** and **64.6%** — a 5.5-point spread at
900 decided games each. That is the same order as ticket 58's fenrir_v1 finding (0.101 spread
across five seed bases). Both readings are comfortably inside the window, so nothing turns on it
here, but **the seed base is a real variance source at 30 iterations and any future decision
within ~6 points of a band edge needs more than one of them.**

---

## 7. Gates at the shipped value

| gate | threshold | measured | verdict |
|---|---|---|---|
| field | 0.35–0.80 | 0.591 / 0.646 (two seed bases, 900 games each) | PASS |
| control floor | ≥0.60 | **1.000** (control wins 0 of 100) | PASS |
| FTK | 0 | 0 across the 900-game field, the mirror, the control row and all 67 full-suite matchups | PASS |
| dead cards | ≤0.35 both sides | 0.078 hers / 0.142 opponent | PASS |
| mirror decided ≤30 turns | ≥60% | **100%** (v2 mirror, 8.90 turns; committed v1 mirror row 400/400 at 13.64, 0 stalled) | PASS |
| deck size | 8–12 | **8** — the named 7-card exception is reversed and the rule is whole again | PASS |
| §2.3 | diagnostic only | 0.39, re-opened (see §6) | noted, not gated |

`liveness.ts` after the `hooks.json` edit: **zero static findings, 32 of 32 OSes LIVE.**
`npx tsc -b` clean · `npx vitest run` **777 passed / 59 files** · `npx vite build` clean.

Full-suite redlines **48 → 49**; the one addition is `os:valkyrie` above. All 40 section-1.3
card-budget redlines are unchanged — no card was touched.

---

## 8. The 8-DIFF — two rows moved, and 65 did not

Both full runs were done on this machine at the same iteration counts, baseline first.

| row | before | after | Δ |
|---|---|---|---|
| `os:valkyrie` | 38.0% | 89.0% | **+51.0** |
| `gauntlet:control-vs-valkyrie:valkyrie_v2` | 0.0%, 4.56 turns | 0.0%, **5.53 turns** | win rate flat, **+0.97 turns** |
| every other row (65 of 67) | — | — | **bit-identical** |

The control's own aggregate moved 6.71 → 6.74 turns, entirely from the valkyrie_v2 row. **The
control never beat her before and does not now** — the fix cost her speed, not the matchup.

---

## 9. Two process findings worth carrying forward

**a) A hook wrapper counts TacticalAI's lookahead, not the game.** The first pass of this sweep
read 81–103 REBIRTH procs per game against ticket 60's 3.34. Nothing was wrong with the hook:
`runOne` calls `getBestAction(state)`, and the AI evaluates candidate plays by pushing them
through the reducer, so every firmware hook fires ~24 times per real proc. **Any instrument that
counts hook invocations must exclude the AI's simulation**, or it is measuring the search rather
than the battle. The fix here was a second runner that raises a flag around `getBestAction` and
counts only unflagged invocations; it reproduces ticket 60's 3.34 exactly (3.48 on this seed
base). Recommended as a HANDOFF entry — it is a trap that produces plausible numbers rather than
obviously broken ones.

**b) Per-turn attribution is off by one boundary if you use the loop's own turn counter.** Her
start-of-turn draw — and therefore her reshuffle — resolves inside the reducer call that ends the
OPPONENT's turn. Bucketing by the loop's current segment puts 77% of procs on the wrong side of
the boundary; bucket by `ctx.state.turn`/`activeSide` read at the moment the hook fires.

---

## 10. Questions for Henry

1. **Is 59-65% where valkyrie_v2 should sit, or is the shuffle-throttle still wanted?** She is
   mid-window and the fix was a unit correction, not a tuning pass. The throttle is now a
   *bigger* lever than ticket 60 measured (§4) if it is ever wanted.
2. **`os:valkyrie` at 0.89 with v2 ahead on the field** (§6) — accept as texture per the
   ratatoskr precedent, or does valkyrie_v1's long game against v2 read as a defect?
3. **The 0.19 damage-per-power rate** (§3) is a general fact about firmware payoffs at level 15,
   not a valkyrie fact. Every other power-denominated OS payoff was priced without it. Worth a
   sweep of its own?
4. **`starfall`** (§5) still under 7 damage a cast. Cut, reprice, or leave — the dead-card
   instrument will no longer flag it either way.
