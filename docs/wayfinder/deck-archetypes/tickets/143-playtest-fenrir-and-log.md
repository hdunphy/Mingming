# Ticket 143 — Playtest 2026-09-05: fenrir_v1's two attacks, and the combat log

> **Status: CLOSED 2026-09-08** — done — ragnarok_edge, unbound_fang and the collapsed log all shipped. Closed in the ticket audit (`../TICKET-AUDIT-2026-09-07.md`).

**Status:** Henry's playtest notes (Rootfall, Fire starter, did not reach the first elite), costed;
ready for Legion. One commit per row, authored as Henry.

---

## 143a — `ragnarok_edge` is dead in hand

**Henry:** *"Ragnarok's Edge is dead in my hand most turns."*

**Why, from the card.** `ragnarok_edge` is 2e, *"30 power. +0.7 power per 1% of your max HP
missing (max 50%)."* — 30 power at full HP, 65 at its cap, on a body with 2 Energy whose other
eight cards cost 0 or 1 (`war_pact` ×2 at 0e, `unbound_fang` ×2 at 1e, `blood_rite` ×2,
`battle_rhythm`). Casting it is the whole turn, and at the 2e rung the curve is 75: it is under
curve even at its ceiling and less than half curve at full HP. Every turn `unbound_fang` +
`war_pact` is the better 2 Energy, so the card waits for an HP band it may never reach. That is a
cost problem, not a scaling problem — the missing-HP hook is the deck's identity.

**Two arms, numbers in 5s, both on the same curve logic (base under, ceiling on):**

- **a1 — make it the 1e card:** 1e, *"20 power. +0.7 power per 1% of your max HP missing
  (max 50%)."* → 20–55. Under curve at full HP, on curve when bleeding. The deck becomes all 0/1e,
  so two attacks a turn is always possible.
- **a2 — keep 2e, pay for it:** 2e, *"50 power. +0.7 power per 1% of your max HP missing
  (max 50%)."* → 50–85. Under curve at full HP (the 2e rung is 75), over it when bleeding — the big
  swing the berserk frame is for, and the only 2e card in the pile stays a decision.

Gate: single-deck 1v1 row each (fenrir_v1 is 54.4 now; band 35–80, ship whichever is nearer 50 and
whose `ragnarok_edge` cast rate in the deck report moves off the floor). Then the ticket-141 gym
comp (fenrir_v1 + skoll_v1 + ratatoskr_v2) vs the three Nature-gym builds, 6 battles a cell, to
confirm the counter still holds ≥ 55.

## 143b — `unbound_fang` gets out of hand

**Henry:** *"Unbound Fang gets out of hand quickly; it should at least reduce Str."* Screenshot:
Fenrir at 19 Strengthened on turn ~4, `unbound_fang` reading 840 damage, lethal on a 1080-HP body.

**Why.** *"Deal 5 power for each stack of Strengthened you hold."* — 1e, uncapped, and it does not
spend the pile. Fenrir's OS pays 2 Strengthened per attack (plus 1 per ally attack since 141b),
`war_pact` pays 2 for 0e, `battle_rhythm` 2 more. By turn 3 the pile is 12–20 and the card is
60–100 power for 1 Energy, twice per deck, and it *grows* the pile it reads because it is an attack.
At 1v1 the grid says fenrir_v1 is 54.4 — in band — so the number is not wrong on average; what
Henry is reporting is the shape: a reader that never spends is a ramp with no top. Sun Devourer is
the same idea done right (consume all, 30 per stack).

**Row:** 1e, *"Deal 5 power for each stack of Strengthened you hold, then lose half of them."*
(`STATUS` action with `consume: 'HALF'` — or, if the action schema has no half-consume, remove
`floor(stacks / 2)` via a scaled negative `STATUS`; Legion to say which is expressible.) The card
still reads the whole pile — the 19-stack turn still hits for 95 power — but the next cast reads 9,
so the pile has to be rebuilt, and the OS/`war_pact` rebuild *is* the deck's loop. It also turns the
second copy into a real decision (cash now, or stack first).

Alternative if half-consume is not expressible without an engine row: *"Deal 5 power per stack of
Strengthened you hold. Lose 5 Strengthened."* (floor at 0). Same tax at the stack counts that
matter, flat number, visible on the card.

Gate: the same two measurements as 143a, run together (one fenrir_v1 row with both rows applied,
plus each alone so the ship note can attribute the move).

## 143c — Combat log: collapsed by default, latest line always visible

**Henry:** *"Log should start untoggled but show latest message still. Toggling it shows a handful
and lets you scroll."*

`src/ui/components/CombatLog.tsx` (71 lines; `isCollapsed` starts `false`, auto-scrolls to the end).
Spec:

- Initial state: **collapsed**. Collapsed renders a single-line strip with the most recent log entry
  (truncated with an ellipsis if it overflows), the toggle affordance, and nothing else. It updates
  live as entries arrive.
- Expanded: the last **8** entries in a fixed-height panel that scrolls (newest at the bottom,
  auto-scroll to newest on new entries unless the user has scrolled up — the usual chat-log rule:
  if `scrollTop` is not at the bottom, do not yank).
- The toggle state is per session (a `useState`, not persisted); the strip must not push the hand or
  the card tray around when it changes height — reserve the strip's height in the arena layout
  (`BattleArena.tsx` line ~1242 is where it mounts).
- Keyboard: no new binding; the strip is clickable and the existing toggle stays.

Test: a render test that the collapsed strip shows the last entry and that expanding shows ≤ 8 and
scrolls; a screenshot before/after in the write-back so Henry can eyeball it.

---

## What to write back

The two 1v1 rows (each arm alone and together), the gym-comp check, the ship choice for 143a with
the cast-rate number, which consume shape 143b used, and the log screenshots.

---

## RESULTS — measured 2026-09-05

### The two card rows only make sense together

Full `fenrir_v1` 1v1 row, 30 opponents × 30 iterations, against a **post-141 baseline of 53.46**.
(`deck_grid.json` still says 54.35; that is pre-141, and it is his OPPONENTS that moved.)

| arm | field |
|---|---|
| a1 — `ragnarok_edge` 1e / 20 base | 63.44 |
| a2 — `ragnarok_edge` 2e / 50 base | 54.85 |
| b — `unbound_fang` half-consume | **34.56** |
| **a1 + b — SHIPPED** | **54.77** |
| a2 + b | 38.44 |

**Ship a1, not a2**, and the gate's "whichever is nearer 50" has to be read on the COMBINATION.
Alone, a2 (54.85) beats a1 (63.44) on that test. But 143b lands in the same nine cards and takes 19
points off whatever it is paired with: a1+b is 54.77, a2+b is 38.44 — the bottom of the band. Each
row alone is a 10-to-19-point swing; together they cancel, and the deck ends up 1.3 points from
where it started with both of Henry's complaints answered.

### The cast rates, which are what the complaints actually were

`npm run balance:deck -- --subjects fenrir_v1 --suites vs-control`, 60 iterations:

| card | before | after |
|---|---|---|
| `ragnarok_edge` | **0.105** | **0.562** |
| `unbound_fang` | **0.771** | **0.425** |
| `war_pact` | 0.875 | 0.898 |
| `battle_rhythm` | 0.674 | 0.647 |
| `blood_rite` | 0.533 | 0.617 |

"Dead in my hand most turns" was a 10.5% play rate — the lowest card in the deck by a factor of
five. "Gets out of hand" was the most-cast attack in the deck. Both are now mid-pack, and the two
cards have swapped places without either becoming the obvious pick.

### The gym comp still holds

`fenrir_v1 + skoll_v1 + ratatoskr_v2` against the three Nature-gym builds, 6 battles a cell:

| opponent | |
|---|---|
| `kraken_v1+ratatoskr_v1+huldra_v1` | 50.0% |
| `kraken_v1+ratatoskr_v1+ratatoskr_v2` | 83.3% |
| `kraken_v1+ratatoskr_v2+huldra_v2` | 100.0% |
| **total** | **77.8% over 18 battles** |

Against the ≥ 55 bar, and against 75.0 over 120 battles before 143. Games run 3.75–5.5 turns, no
truncations.

**But note what that number does NOT say.** The 141 ship read named 143b as the first trim on the
Fire Strength pair, and at 18 battles (±20) the pair has not visibly come down — 77.8 against 75.0
is noise in either direction. If the pair is still the outlier on the next full grid, the ship
read's own order says the next lever is 141b's ally hook, not another card.
