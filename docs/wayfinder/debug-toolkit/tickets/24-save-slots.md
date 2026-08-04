# Save slots

- Type: wayfinder:task
- Status: open
- Assignee:
- Blocked by: —

## Question

**This is the guard that stops debug work destroying a real save, and it blocks
[Scenario launcher panel](23-scenario-launcher-panel.md).**

Today there is no isolation at all. Injecting a battle is safe (it only touches `state.battle`),
but when a battle *ends* `BattleArena` dispatches `syncPartyStats` (`:428`), `applyRewardBundle`
(`:443`), `addRelic` (`:445`) and the gauntlet actions into `gameSlice`, and `store.ts:18-31`
autosaves every `state.game` change straight to localStorage. `syncPartyStats` matches by
`member.id`, and the launcher's primary action — `Mirror my save party` — reuses **real roster
ids**, so fabricated levels and XP land on real mingmings. This already applies to the shipped
God Tools and snapshot import, not just the launcher.

Decided 2026-08-03 with Henry: solve it with **multiple save files**, not a single hardcoded debug
key. He wants to spin up a scratch save per scenario, and to branch a copy of a real run to test
what happens after a battle and into the next one. Scope agreed: **engine support plus a
debug-panel switcher now; a player-facing picker in `MainMenuView` is explicitly deferred** and is
game-feature work rather than part of this map.

Effort was measured before choosing: `SAVE_KEY` is one module-level const (`SaveSystem.ts:9`) and
there are six non-test callers — `loadGame` in `App.tsx:55` and `SaveEditorPanel.tsx:167`,
`saveGame` in `store.ts:46`, `deleteSave` in `BattleArena.tsx:343,421` and `HubScreen.tsx:48`.
None of them pass a key, so all six keep their signatures.

Checklist:

- `SaveSystem`: replace the `SAVE_KEY` const with slot-aware key derivation
  (`mingming_save__<slotId>`), plus `listSlots`, `getActiveSlotId`, `setActiveSlotId`,
  `createSlot(name, copyFromSlotId?)`, `renameSlot`, `deleteSlot`. Slot index lives at
  `mingming_saves`.
- `saveGame` / `loadGame` / `deleteSave` / `hasSave` keep their current signatures and operate on
  the active slot, so **`store.ts` needs no edit** and the gate invariant survives.
- Migration: on first read, if legacy `mingming_save` exists and no index does, adopt it as the
  first slot and make it active. **Copy, do not move** — leave the legacy key in place as a
  one-time recovery net.
- Switching slots must clear any live battle (`setBattleState(null)`) before loading the new save,
  or a battle started in slot A can end and write its rewards into slot B.
- Debug-panel switcher: create / switch / duplicate ("branch this run") / rename / delete. Route
  writes through the same `prepareEdit` + `PlayerSaveSchema` dry-run discipline `saveEdit.ts` uses,
  so a bad slot can never wedge autosave silently (audit gap #18).
- Tests: legacy adoption; autosave lands in the active slot only; switching does not cross-write;
  deleting a slot leaves neither an orphaned index entry nor an orphaned key.

Deferred, deliberately: the player-facing slot picker in `MainMenuView` (126 lines today, so it is
mostly new UI).
