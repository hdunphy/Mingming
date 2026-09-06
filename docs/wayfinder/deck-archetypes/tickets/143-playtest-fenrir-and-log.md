# Ticket 143 — Playtest 2026-09-05: fenrir_v1's two attacks, and the combat log

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
