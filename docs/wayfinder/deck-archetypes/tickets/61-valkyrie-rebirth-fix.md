# valkyrie_v2 REBIRTH re-denomination (ticket 61): power, not raw HP — and the legal deck back

- Type: wayfinder:task — Henry-approved design (2026-08-14, off the ticket-60 knockout
  study). This ticket IS the implementation brief; implementing session flips it closed
  and appends its Resolution.
- Status: **open**
- Assignee: —
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
