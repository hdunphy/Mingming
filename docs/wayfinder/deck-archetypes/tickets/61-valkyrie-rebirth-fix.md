# valkyrie_v2 REBIRTH re-denomination (ticket 61): power, not raw HP — and the legal deck back

- Type: wayfinder:task — Henry-approved design (2026-08-14, off the ticket-60 knockout
  study). This ticket IS the implementation brief; implementing session flips it closed
  and appends its Resolution.
- Status: **closed** (2026-08-14)
- Assignee: implementation agent
- Blocked by: none. DEEP-PHASE POLICY binds. Branch card-dev; author
  `Henry Dunphy <hdunphy15@gmail.com>`; line-ending law; locks → `_to_delete/git-locks/`.
- Ceiling-freeze note: valkyrie_v2 (87.7 field, roster #1) is the freeze's sanctioned
  exception — an engine NAMED by measurement (ticket 60: the OS is 50 of her 88 points).

## Context

Ticket 60 proved REBIRTH_CYCLE_OS is the entire engine: os_off reads 37.7% vs 87.7%
baseline, while all seven card arms sit inside ±3.3 (noise). The root cause is a UNIT BUG:
the damage half is a raw `HP` mutation (`"amount": -10`) that skips the damage pipeline —
no attack stat, no defense, no status interaction, level-broken flat damage worth ~33
power per proc free (measured damage ≈ 0.30 × power). The heal half is already
power-denominated (~2.2 HP/proc on her frame). Henry's rulings: **both halves become
power-denominated** (the hel %-denomination law: nothing ships in flat HP); the reshuffle
gimmick and the once-per-turn cap (proven load-bearing — it eats 35% of her turns' extra
shuffles) are UNTOUCHED; +1-energy and shuffle-throttle variants are REJECTED (energy is
a ~35-power lateral per the status table, and collides with GENESIS's identity).

## Part 1 — the unit fix (hooks.json, LF, edit as text)

In `valk_v2_rebirth`'s `do` block, replace the raw mutation:

```json
{ "type": "HP", "target": "RANDOM_ENEMY", "element": "Light", "amount": -10 }
```

with a pipeline ATTACK at power N against RANDOM_ENEMY — **copy the exact mechanism
ticket 56 built for NOURISH_ROUTINE** (audhumbla_v2's conversion runs as an ATTACK so it
respects attack/defense/statuses; reuse that pattern verbatim, Light element). The HEAL
action stays, `power` set to the same N. Description becomes: *"Whenever Valkyrie's
discard pile is shuffled back into her deck, she attacks a random enemy with N power of
Light damage and heals herself with N power. Once per turn."* Both halves always share
one value.

## Part 2 — the sweep (report-style arms, then ship one)

Arms: **N ∈ {10, 15, 20, 25}** (all four pre-approved by Henry — anything outside the
set → STOP). In-memory registry mutation per arm like ticket 60; instrument = 10-iteration
field row + procs/game + actual damage/proc + mirror turns + FTK. Interpolation guide
(not gates): 30 power ≈ the old raw 10 ≈ 87.7; expect roughly 55–78 across the set.
**Ship the arm nearest 0.60 field, then confirm it at 30 iterations** (`0-DECISION-GRADE`
— a 10-iter read within ~5 of a band edge is not a verdict). If no arm lands inside
0.35–0.80 at 30 iterations → STOP with the table; the shuffle-throttle is Henry's
designated second axis and needs his sign-off, not yours.

## Part 3 — the legal deck

`glimmer` returns to valkyrie_v2 (8 cards — Henry's pick, the measured arm). **Reverse
the `0-DECK-SIZE-EXCEPTION` named line in `baseDecks.test.ts`** ("reverse the line, not
the rule") — every deck pins 8–12 again. Re-run the unit suite AFTER the last content
edit (the 0-DECK-SIZE-EXCEPTION lesson).

## Part 4 — gates, docs, commit

`liveness.ts` (hooks.json edited — standing policy) · `npx tsc -b` · `npx vitest run` ·
`npx vite build` · scoped `BALANCE_ONLY=valkyrie`: field 0.35–0.80 at the shipped N,
control ≥0.60, FTK 0, mirror ≥60% decided ≤30 turns, dead ≤0.35 both sides; §2.3
diagnostic-only. Report `starfall` damage/cast at the shipped value — post-fix games
lengthen toward the 9.6-turn os_off shape and the draw-scaler may start earning its slot;
this feeds the dead-card cleanup read. Full `npm run balance`; 8-DIFF the matchup table
(valkyrie rows move; nothing else should move beyond noise). ONE commit: hooks edit +
registry deck + test reversal + report + ticket Resolution + map line + HANDOFF refresh
(valkyrie_v2 leaves the top cluster if she lands ~0.60; census next-read note). Message:
`REBIRTH re-denominated (ticket 61): raw 10 HP -> N power through the pipeline, glimmer restored, 8-card rule whole again`

## Deliverable

Commit hash, the four-arm sweep table, shipped N with its 30-iteration confirm, all gate
numbers, starfall's post-fix read, deviations — or findings if STOPPED.


---

## Resolution (2026-08-14)

**SHIPPED N = 15.** Registry `1:3466b533` → `1:8b7b0ae9`. Full write-up:
[research/valkyrie-rebirth-fix.md](../research/valkyrie-rebirth-fix.md).

**Part 1 — unit fix.** `valk_v2_rebirth`'s raw `{"type":"HP","amount":-10}` is now
`{"type":"ATTACK","element":"Light","power":15}` — the ticket-56 NOURISH_ROUTINE mechanism
verbatim, minus the `scaling` (this one is flat printed power, not a heal-power multiple). The
`HEAL` half moved 10 → 15 so both halves share one value. Description rewritten to the ticket's
text. `liveness.ts`: zero static findings, 32/32 LIVE.

**Part 2 — the sweep.** All four arms landed inside 0.35–0.80; N = 15 was nearest 0.60 and
shipped.

| arm | field (10-iter) | procs/game | dmg/proc | heal/proc | v2-mirror | FTK |
|---|---|---|---|---|---|---|
| baseline (raw −10 HP) | 86.7% | 3.48 | 8.5 | 2.0 | 4.75 | 0 |
| N = 10 | 53.3% | 3.78 | 1.7 | 2.0 | 10.55 | 0 |
| **N = 15** | **60.3%** | 4.05 | 2.7 | 3.0 | 8.90 | 0 |
| N = 20 | 64.3% | 4.18 | 3.8 | 3.9 | 8.55 | 0 |
| N = 25 | 72.0% | 4.34 | 4.8 | 4.9 | 8.20 | 0 |

**30-iteration confirm: N = 15 → 59.1%** (900 decided games), N = 20 → 64.0%. A second
independent seed base reads N = 15 at **64.6%** — a 5.5-point seed-base spread at 900 games,
same order as ticket 58's fenrir_v1 finding; both inside the window.

**The ticket's interpolation guide was off by ~40% and the report says why.** Measured rate is
**~0.19 HP of damage per printed power** (and ~0.20 HP of healing per power — the two halves now
agree in HP, not just in text), so the raw `-10` mutation was worth **42–45 power per proc**, not
the estimated 33. That is why N = 25 still reads 14 points under baseline.

**Part 3 — the legal deck.** `glimmer` restored; valkyrie_v2 is 8 cards. The
`0-DECK-SIZE-EXCEPTION` line in `baseDecks.test.ts` is REVERSED — every deck pins 8–12 again and
the rule never moved. Unit suite re-run AFTER the last content edit: **777 passed / 59 files.**

**Part 4 — gates at N = 15.** field 0.591 / 0.646 · control **1.000** · FTK **0** everywhere ·
dead 0.078 hers / 0.142 opponent · v2 mirror 100% decided at 8.90 turns · deck size 8. `tsc -b`,
`vitest`, `vite build` all clean. §2.3 diagnostic-only.

**`starfall` post-fix:** 6.7 damage/cast at 4.02 casts/game (~27 a game, up from ~22) — longer
games bought it 29% more casts and it is still the weakest card in the list. Her dead-card ratio
nearly halved (13.4% → 7.8%), so the dead-card cleanup pass will not find her by that instrument.

**8-DIFF: two rows moved, 65 were bit-identical.** `os:valkyrie` 38.0% → 89.0% (+51.0) and
`gauntlet:control-vs-valkyrie:valkyrie_v2` lengthened 4.56 → 5.53 turns with the win rate flat at
0.0%. Redlines 48 → 49, the addition being `os:valkyrie`.

**Returned for Henry (four questions in the report):** the §2.3 re-open at 0.89 is contradicted
by the field — **v1 reads 55.0% and v2 64.6% on the same seed base, both in window, both beating
the control** — so it is recorded as texture, not acted on. Also: the payoff cut partly pays for
itself (procs/game rose 3.48 → 4.05 because games lengthened 4.88 → 5.80 turns), which makes the
banked shuffle-throttle a bigger lever than ticket 60 measured.

**Process finding worth a HANDOFF entry:** a hook wrapper counts **TacticalAI's lookahead**.
`runOne` calls `getBestAction`, which pushes candidate plays through the reducer, so every
firmware hook fires ~24× per real proc — the first pass of this sweep read 81–103 procs/game
against ticket 60's 3.34. Any instrument counting hook invocations must exclude the AI's search.
