# Ticket 156 — The run log records the fights, not just that they happened

**Type:** instrument (engine event → run log → export). **Status:** OPEN, asked by Henry 2026-09-20
after his Emberglass run: *"Is that all the logs? Do we not save the actual battle logs? That might
be useful for debugging."* **Relates to:** 155 (the defect pass — this is how the next playtest
report comes with evidence), 148/153 (the progression questions need per-fight deck snapshots to
be answerable), 142 §6, runLog ticket lineage.

## 1. What the log has today

`runLog.ts` records fifteen event kinds — node entered, fight started (enemy species), fight ended
(turns, won, party HP), picks with offers, scrap deltas, market and workshop actions, run ended —
each stamped with `deckSize` and `scrap`. **Nothing from inside a fight survives it.** The engine's
combat log (`IBattleState.logs`, the strings the top bar shows) and every `globalBattleEventBus`
event die with the battle state. So a run that ended "Fenrir + Sköll + Sköll elite, 0 turns
recorded, defeat" cannot say what killed the party, who was focused, what was cast, or what the
deck was when it walked in.

## 2. What to record — per fight, appended to `FIGHT_ENDED`'s neighbourhood

- **`FIGHT_DECK`** at `FIGHT_STARTED`: the active deck as `dataId[]` (sorted), the party as
  `{memberId, species, osId, hp/maxHp}`, the enemies as `{species, osId}`, the encounter kind and
  biome. This is what 148/153 need: deck-at-fight-N across a run is the progression curve.
- **`FIGHT_TURN`** per turn, both sides: `{turn, side, cardsPlayed: [{dataId, casterId, targetId}],
  damageDealt, damageTaken, statusesApplied: [{status, stacks, targetId}], partyHp after}` — from
  the bus (`PROGRAM_PLAYED`, `DAMAGE_TAKEN` with 146b's `cause`, `STATUS_APPLIED` with `source`,
  `HOOK_FIRED`, `TURN_END`). Twelve lines a fight, not a transcript.
- **`FIGHT_LOG`**: the combat log strings, verbatim, capped at 400 lines (the reducer's own cap).
  This is the "what happened" a bug report needs; the turn rows are the "how much".
- On `RUN_ENDED` with `outcome: 'defeat'`, the last fight's rows are already there — no special
  case. Also fix: `FIGHT_ENDED` is not emitted on a defeat today (the Emberglass log has
  `RUN_ENDED` and no `FIGHT_ENDED` for fight 3, so the elite's turn count is lost); emit it before
  `RUN_ENDED` with `won: false`.
- **Active time**, not wall clock: the summary shows *5h 01m* for a three-fight run because
  `startedAt → endedAt` spans a day away from the app. Sum only intervals with input (or
  pause on `visibilitychange`), keep wall clock as a second field.

## 3. Size and cost

A fight's rows are ~2–6 KB; a 14-fight run ~60 KB; the export stays a single JSON. The listener
is `runLogMiddleware`'s existing subscription; nothing per-frame, nothing in the reducer. Under
`isSimulating()` nothing is recorded (the balance suite must stay byte-identical).

## 4. Then, the read

`scratch/runread.ts <export.json>`: per fight — deck size, mean powerscale of the deck (the 149c
score), who died on which turn, damage by caster, statuses by source; per run — the deck-power
curve fight by fight and the picks that moved it. That table is what the 148/153 session reads
instead of Henry's memory of the run.

## 5. Tests

A fixture run of two fights through the middleware produces exactly the rows above; a defeat
produces `FIGHT_ENDED(won:false)` then `RUN_ENDED`; the export round-trips through `runLog`'s zod
schema; nothing is recorded under `runMuted`.
