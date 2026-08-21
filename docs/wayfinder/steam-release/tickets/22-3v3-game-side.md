# 3v3 game-side completion: six-entity UI, shared hand, caster STAB, energy transfer decision (ticket 22)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md)
- Phase: Vertical Slice

## Deliverable

The engine and `BattleArena` already run 3v3 (audit: parties, shared deck/hand, per-entity energy, `sourceId`, W/E/R caster hotkeys, drag targeting). Finish the player-facing layer: the hand must read STAB and true damage **by selected caster** (preview-parity rule), per-member energy pips must be legible at six entities on a 1280×800 frame, target validity must be obvious, and the draw formula `sum(cardDraw) − (N−1)` is surfaced in a tooltip. `TRANSFER_ENERGY` exists in the reducer but no UI dispatches it and the 3v3 ruling never mentions it — **Henry decides keep-or-cut** (see Questions); do not build UI for it until ruled.

## Done when

A 3v3 fight is fully playable by mouse and by keyboard with no hidden numbers; a component test covers caster switching.

## Resolution

_(open)_

